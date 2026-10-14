import { MAX_SAVE_BYTES, type Board, type SaveProgress, type SaveRecord, type ScoreResult } from "@arcade/protocol";
import { ApiError, type ApiClient } from "./api";
import type { Auth } from "./auth";
import { DEFAULT_SETTINGS, type Store } from "./store";
import type { KV } from "./storage";

export interface LocalSave {
  state: unknown | null;
  rev: number;
  progress: SaveProgress | null;
}

export interface SyncEngine {
  /** Hidrata la store (progreso, mejores puntajes) con lo guardado en el dispositivo. */
  init(): Promise<void>;
  loadLocal(gameId: string): Promise<LocalSave>;
  saveLocal(gameId: string, state: unknown, progress?: SaveProgress): Promise<void>;
  recordScore(gameId: string, board: Board, value: number, meta?: Record<string, unknown>): Promise<ScoreResult>;
  /** Trae los guardados del servidor (con tope de tiempo); nunca lanza. */
  pull(timeoutMs: number): Promise<void>;
  /** Sube guardados y puntajes pendientes; nunca lanza. */
  flush(): Promise<void>;
  /** Escucha red/visibilidad y reintenta. Devuelve la función para detenerlo. */
  start(opts?: { immediate?: boolean }): () => void;
  /** Elimina todo dato local de la app. */
  wipe(): Promise<void>;
}

interface SaveRec {
  state: unknown;
  rev: number;
  progress: SaveProgress;
  dirty: boolean;
  seq: number;
}
interface ScoreRec {
  value: number;
  meta?: Record<string, unknown>;
  pending: boolean;
  rank?: { all: number | null; weekly: number | null };
}

const DEBOUNCE_MS = 2000;
const BACKOFF_BASE_MS = 2000;
const BACKOFF_MAX_MS = 5 * 60_000;
const NO_RANK = { all: null, weekly: null } as const;

const better = (a: number, b: number, sort: "asc" | "desc") => (sort === "desc" ? a > b : a < b);

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

/** Cola de promesas por clave: serializa lectura-modificación-escritura sobre el mismo registro. */
function createLocks() {
  const tails = new Map<string, Promise<unknown>>();
  return function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const run = (tails.get(key) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => undefined);
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}

export function createSyncEngine(deps: { kv: KV; api: ApiClient; store: Store; auth: Auth }): SyncEngine {
  const { kv, api, store, auth } = deps;
  const withLock = createLocks();

  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;
  let running: Promise<void> | null = null;
  let rerun = false;

  /* ---------- acceso a registros ---------- */
  async function readJson<T>(key: string): Promise<T | null> {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  const readSave = (g: string) => readJson<SaveRec>(`save:${g}`);
  const writeSave = (g: string, r: SaveRec) => kv.set(`save:${g}`, JSON.stringify(r));
  const readScore = (g: string, b: string) => readJson<ScoreRec>(`score:${g}:${b}`);
  const writeScore = (g: string, b: string, r: ScoreRec) => kv.set(`score:${g}:${b}`, JSON.stringify(r));

  function setProgress(gameId: string, progress: SaveProgress) {
    store.progress.value = { ...store.progress.value, [gameId]: progress };
  }

  /* ---------- reintentos ---------- */
  function schedule(delay: number) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void engine.flush();
    }, delay);
  }
  function scheduleRetry() {
    schedule(Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS));
    attempt++;
  }

  /* ---------- 401 ⇒ cuenta nueva y todo lo local vuelve a ser "pendiente" ---------- */
  async function markAllDirty() {
    for (const key of await kv.keys("save:")) {
      await withLock(key, async () => {
        const r = await readJson<SaveRec>(key);
        if (r) await kv.set(key, JSON.stringify({ ...r, rev: 0, dirty: true }));
      });
    }
    for (const key of await kv.keys("score:")) {
      await withLock(key, async () => {
        const r = await readJson<ScoreRec>(key);
        if (r) await kv.set(key, JSON.stringify({ ...r, pending: true }));
      });
    }
  }
  async function authed<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await auth.reregister();
        await markAllDirty();
        return await fn();
      }
      throw e;
    }
  }

  const isPermanent = (e: unknown) =>
    e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 409, 429].includes(e.status);

  /* ---------- guardados ---------- */
  async function adopt(gameId: string, save: SaveRecord) {
    await withLock(`save:${gameId}`, async () => {
      const prev = await readSave(gameId);
      await writeSave(gameId, { state: save.state, rev: save.rev, progress: save.progress, dirty: false, seq: (prev?.seq ?? 0) + 1 });
    });
    setProgress(gameId, save.progress);
  }

  /** @returns true si hubo un fallo que merece reintento */
  async function flushSaves(): Promise<boolean> {
    let failed = false;
    for (const key of await kv.keys("save:")) {
      const gameId = key.slice("save:".length);
      const first = await readSave(gameId);
      if (!first?.dirty) continue;
      if (!(await auth.ensure())) return true;
      try {
        const sent = { seq: first.seq };
        const res = await authed(async () => {
          const r = (await readSave(gameId)) ?? first;
          sent.seq = r.seq;
          return api.putSave(gameId, { state: r.state, progress: r.progress, baseRev: r.rev });
        });
        await withLock(key, async () => {
          const cur = await readSave(gameId);
          if (!cur) return;
          await writeSave(gameId, { ...cur, rev: res.rev, dirty: cur.seq !== sent.seq });
        });
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && (e.body as { save?: SaveRecord } | undefined)?.save) {
          await adopt(gameId, (e.body as { save: SaveRecord }).save);
        } else if (isPermanent(e)) {
          console.warn(`[sync] guardado de ${gameId} rechazado (${(e as ApiError).code}); se descarta la subida`);
          await withLock(key, async () => {
            const cur = await readSave(gameId);
            if (cur) await writeSave(gameId, { ...cur, dirty: false });
          });
        } else {
          failed = true;
        }
      }
    }
    return failed;
  }

  /* ---------- puntajes ---------- */
  async function sendScore(gameId: string, boardId: string, rec: ScoreRec): Promise<ScoreResult | "rejected" | null> {
    if (!(await auth.ensure())) return null;
    try {
      const body = rec.meta ? { board: boardId, value: rec.value, meta: rec.meta } : { board: boardId, value: rec.value };
      const res = await authed(() => api.postScore(gameId, body));
      await withLock(`score:${gameId}:${boardId}`, async () => {
        const cur = await readScore(gameId, boardId);
        // Si mejoró mientras se enviaba, sigue pendiente.
        const stillPending = cur !== null && cur.value !== rec.value;
        await writeScore(gameId, boardId, { ...(cur ?? rec), pending: stillPending, rank: res.rank });
      });
      store.ranks.value = { ...store.ranks.value, [`${gameId}:${boardId}`]: res.rank };
      return res;
    } catch (e) {
      return isPermanent(e) ? "rejected" : null;
    }
  }

  async function flushScores(): Promise<boolean> {
    let failed = false;
    for (const key of await kv.keys("score:")) {
      const [, gameId, boardId] = key.split(":");
      if (!gameId || !boardId) continue;
      const rec = await readScore(gameId, boardId);
      if (!rec?.pending) continue;
      const r = await sendScore(gameId, boardId, rec);
      if (r === null) failed = true;
      else if (r === "rejected") await dropScore(gameId, boardId);
    }
    return failed;
  }

  async function dropScore(gameId: string, boardId: string, restore?: ScoreRec | null) {
    await withLock(`score:${gameId}:${boardId}`, async () => {
      if (restore) await writeScore(gameId, boardId, restore);
      else await kv.remove(`score:${gameId}:${boardId}`);
    });
    const bests = { ...store.bests.value };
    if (restore) bests[`${gameId}:${boardId}`] = restore.value;
    else delete bests[`${gameId}:${boardId}`];
    store.bests.value = bests;
  }

  /* ---------- API pública ---------- */
  const engine: SyncEngine = {
    async init() {
      const progress: Record<string, SaveProgress> = {};
      for (const key of await kv.keys("save:")) {
        const r = await readJson<SaveRec>(key);
        if (r) progress[key.slice("save:".length)] = r.progress;
      }
      const bests: Record<string, number> = {};
      const ranks: Record<string, { all: number | null; weekly: number | null }> = {};
      for (const key of await kv.keys("score:")) {
        const r = await readJson<ScoreRec>(key);
        if (!r) continue;
        const id = key.slice("score:".length);
        bests[id] = r.value;
        if (r.rank) ranks[id] = r.rank;
      }
      store.progress.value = progress;
      store.bests.value = bests;
      store.ranks.value = ranks;
    },

    async loadLocal(gameId) {
      const r = await readSave(gameId);
      return r ? { state: r.state, rev: r.rev, progress: r.progress } : { state: null, rev: 0, progress: null };
    },

    async saveLocal(gameId, state, progress) {
      const json = JSON.stringify(state);
      if (json === undefined) throw new Error("El estado no es serializable");
      if (utf8Length(json) > MAX_SAVE_BYTES) throw new Error("El estado supera 64 KB");
      let saved: SaveProgress = { value: 0 };
      await withLock(`save:${gameId}`, async () => {
        const prev = await readSave(gameId);
        saved = progress ?? prev?.progress ?? { value: 0 };
        await writeSave(gameId, { state: JSON.parse(json), rev: prev?.rev ?? 0, progress: saved, dirty: true, seq: (prev?.seq ?? 0) + 1 });
      });
      setProgress(gameId, saved);
      schedule(DEBOUNCE_MS);
    },

    async recordScore(gameId, board, value, meta) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { accepted: false, best: 0, rank: { ...NO_RANK }, offline: false };
      }
      const v = value + 0; // normaliza -0
      const id = `${gameId}:${board.id}`;
      const prev = await readScore(gameId, board.id);
      if (prev && !better(v, prev.value, board.sort)) {
        return { accepted: false, best: prev.value, rank: store.ranks.value[id] ?? { ...NO_RANK }, offline: false };
      }
      const rec: ScoreRec = { value: v, pending: true, ...(meta ? { meta } : {}) };
      await withLock(`score:${id}`, () => writeScore(gameId, board.id, rec));
      store.bests.value = { ...store.bests.value, [id]: v };

      const res = await sendScore(gameId, board.id, rec);
      if (res === "rejected") {
        await dropScore(gameId, board.id, prev);
        return { accepted: false, best: prev?.value ?? v, rank: { ...NO_RANK }, offline: false };
      }
      if (res === null) {
        scheduleRetry();
        return { accepted: true, best: v, rank: { ...NO_RANK }, offline: true };
      }
      return res;
    },

    async pull(timeoutMs) {
      const work = (async () => {
        if (!(await auth.ensure())) return;
        const saves = await authed(() => api.getSaves());
        for (const s of saves) {
          const local = await readSave(s.gameId);
          if (!local || (!local.dirty && s.rev > local.rev)) await adopt(s.gameId, s);
        }
      })().catch(() => undefined);
      let t: ReturnType<typeof setTimeout>;
      const limit = new Promise<void>((resolve) => (t = setTimeout(resolve, timeoutMs)));
      await Promise.race([work, limit]);
      clearTimeout(t!);
    },

    flush() {
      if (running) {
        rerun = true;
        return running;
      }
      running = (async () => {
        store.syncing.value = true;
        let failed = false;
        try {
          do {
            rerun = false;
            const a = await flushSaves();
            const b = await flushScores();
            failed = a || b;
          } while (rerun);
        } catch (e) {
          console.warn("[sync] error inesperado", e);
          failed = true;
        } finally {
          running = null;
          store.syncing.value = false;
        }
        if (failed) scheduleRetry();
        else attempt = 0;
      })();
      return running;
    },

    start({ immediate = true } = {}) {
      const kick = () => void engine.flush();
      const onVisible = () => {
        if (document.visibilityState === "visible") kick();
      };
      window.addEventListener("online", kick);
      document.addEventListener("visibilitychange", onVisible);
      if (immediate) void auth.ensure().then(() => engine.pull(3000)).then(kick);
      return () => {
        window.removeEventListener("online", kick);
        document.removeEventListener("visibilitychange", onVisible);
        if (timer) clearTimeout(timer);
        timer = null;
      };
    },

    async wipe() {
      if (timer) clearTimeout(timer);
      timer = null;
      attempt = 0;
      for (const key of await kv.keys("")) await kv.remove(key);
      store.progress.value = {};
      store.bests.value = {};
      store.ranks.value = {};
      store.player.value = null;
      store.lastGame.value = null;
      store.settings.value = { ...DEFAULT_SETTINGS };
      store.syncing.value = false;
    },
  };
  return engine;
}
