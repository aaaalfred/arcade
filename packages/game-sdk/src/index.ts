import { createHostClient, type HostClient } from "./host";
import { createStandalone } from "./standalone";
import type { ArcadeApi, ArcadeEnv, ArcadeEvent, Haptic, SaveProgress, ScoreResult, Session, Settings, Timeouts } from "./types";

export type { ArcadeApi, ArcadeEnv } from "./types";

/** Debe coincidir con MAX_SAVE_BYTES de @arcade/protocol (lo verifica una prueba). */
export const SDK_MAX_SAVE_BYTES = 64 * 1024;

const DEFAULT_TIMEOUTS: Timeouts = { hello: 3000, score: 8000, rewarded: 120_000, interstitial: 120_000 };

function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

function cleanProgress(p?: SaveProgress): SaveProgress | undefined {
  if (!p || !Number.isFinite(p.value)) return undefined;
  const out: SaveProgress = { value: Math.max(0, Math.floor(p.value)) };
  if (p.total !== undefined && Number.isFinite(p.total)) out.total = Math.max(0, Math.floor(p.total));
  return out;
}

export function createArcade(env: ArcadeEnv): ArcadeApi {
  const timeouts: Timeouts = { ...DEFAULT_TIMEOUTS, ...env.timeouts };
  const listeners: Record<ArcadeEvent, Set<(payload?: any) => void>> = {
    pause: new Set(), resume: new Set(), settings: new Set(),
  };
  const emit = (name: ArcadeEvent, payload?: unknown) => {
    listeners[name].forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(`[Arcade] error en listener de "${name}"`, e); }
    });
  };

  const local = createStandalone(env);
  if (env.doc && env.win.parent === env.win) {
    env.doc.addEventListener("visibilitychange", () => emit(env.doc!.visibilityState === "hidden" ? "pause" : "resume"));
  }

  let host: HostClient | null = env.win.parent !== env.win ? createHostClient(env.win, emit) : null;
  let readyP: Promise<Session> | null = null;

  return {
    ready() {
      readyP ??= (async () => {
        if (!host) return local.ready();
        try {
          const s = await host.request<Session>("hello", undefined, timeouts.hello);
          return { ...s, mode: "host" as const };
        } catch (e) {
          console.warn("[Arcade] el shell no respondió; modo standalone", e);
          host.dispose();
          host = null;
          return local.ready();
        }
      })();
      return readyP;
    },

    save(state, opts) {
      let json: string | undefined;
      try {
        json = JSON.stringify(state);
      } catch (e) {
        console.warn("[Arcade] save: el estado no es serializable a JSON", e);
        return;
      }
      if (json === undefined) {
        console.warn("[Arcade] save: el estado es undefined o una función; no se guardó");
        return;
      }
      if (utf8Length(json) > SDK_MAX_SAVE_BYTES) {
        console.warn(`[Arcade] save: el estado supera ${SDK_MAX_SAVE_BYTES} bytes; no se guardó`);
        return;
      }
      const progress = cleanProgress(opts?.progress);
      if (host) host.post("save", progress ? { state: JSON.parse(json), progress } : { state: JSON.parse(json) });
      else local.save(json, progress);
    },

    async submitScore(board, value, meta): Promise<ScoreResult> {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        console.error("[Arcade] submitScore: el valor debe ser un número finito", value);
        return { accepted: false, best: 0, rank: { all: null, weekly: null }, offline: false };
      }
      if (!host) return local.submitScore(board, value);
      try {
        return await host.request<ScoreResult>("score", meta ? { board, value, meta } : { board, value }, timeouts.score);
      } catch (e) {
        const offline = /tiempo agotado/.test(String((e as Error).message));
        if (!offline) console.warn("[Arcade] submitScore rechazado", e);
        return { accepted: false, best: value, rank: { all: null, weekly: null }, offline };
      }
    },

    ads: {
      async interstitial() {
        if (!host) return local.interstitial();
        try { await host.request("ad.interstitial", undefined, timeouts.interstitial); } catch (e) { console.warn("[Arcade] anuncio omitido", e); }
      },
      async rewarded() {
        if (!host) return local.rewarded();
        try { return (await host.request("ad.rewarded", undefined, timeouts.rewarded)) === true; } catch (e) { console.warn("[Arcade] sin recompensa", e); return false; }
      },
    },

    haptic(kind: Haptic) {
      if (host) host.post("haptic", { kind });
      else local.haptic(kind);
    },
    openLeaderboard(board) {
      if (host) host.post("leaderboard.open", board ? { board } : {});
      else local.openLeaderboard(board);
    },
    exit() {
      if (host) host.post("exit");
      else local.exit();
    },
    on(event: ArcadeEvent, fn: (payload?: any) => void) {
      listeners[event].add(fn);
      return () => void listeners[event].delete(fn);
    },
  } as ArcadeApi;
}
