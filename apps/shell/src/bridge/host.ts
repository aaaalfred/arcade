import { GameMessageSchema, type Board, type HostEvent, type Manifest, type Reply, type Session, type Settings } from "@arcade/protocol";
import type { AdsService } from "../services/ads";
import type { Native } from "../services/native";
import type { Store } from "../services/store";
import type { SyncEngine } from "../services/sync";

export interface HostHandle {
  dispose(): void;
  /** Pausa el juego (cuenta referencias: se reanuda cuando se liberan todas). */
  pause(): void;
  resume(): void;
  /** Avisa al juego de que cambiaron los ajustes. */
  notifySettings(): void;
}

export interface HostDeps {
  iframe: HTMLIFrameElement;
  manifest: Manifest;
  sync: Pick<SyncEngine, "pull" | "loadLocal" | "saveLocal" | "recordScore">;
  ads: AdsService;
  native: Native;
  store: Store;
  settings: () => Settings;
  onExit: () => void;
  onLeaderboard: (board?: string) => void;
  /** Origen esperado de los mensajes; por defecto `location.origin`. */
  origin?: string;
}

const PULL_TIMEOUT_MS = 1500;

/** Conecta un `<iframe>` de juego con los servicios del shell mediante `postMessage`. */
export function attachGameHost(deps: HostDeps): HostHandle {
  const { iframe, manifest, sync, ads, native, store } = deps;
  const origin = deps.origin ?? location.origin;
  const targetOrigin = origin === "null" ? "*" : origin;
  const gameId = manifest.id;
  let disposed = false;
  let pauseDepth = 0;

  function post(msg: Reply | HostEvent) {
    if (disposed) return;
    try {
      iframe.contentWindow?.postMessage(msg, targetOrigin);
    } catch (e) {
      console.warn("[host] no se pudo enviar al juego", e);
    }
  }
  const reply = (id: string, ok: boolean, payload?: unknown, error?: string) =>
    post({ arcade: 1, replyTo: id, ok, ...(payload !== undefined ? { payload } : {}), ...(error ? { error } : {}) });

  function pause() {
    if (pauseDepth++ === 0) post({ arcade: 1, type: "pause" });
  }
  function resume() {
    if (pauseDepth === 0) return;
    if (--pauseDepth === 0) post({ arcade: 1, type: "resume" });
  }

  async function withAdPause<T>(run: () => Promise<T>): Promise<T> {
    pause();
    try {
      return await run();
    } finally {
      resume();
    }
  }

  async function handleMessage(raw: unknown) {
    const parsed = GameMessageSchema.safeParse(raw);
    if (!parsed.success) {
      const r = raw as { arcade?: unknown; id?: unknown } | null;
      console.warn("[host] mensaje de juego inválido descartado", parsed.error.issues[0]?.message);
      if (r && typeof r === "object" && r.arcade === 1 && typeof r.id === "string") reply(r.id, false, undefined, "mensaje inválido");
      return;
    }
    const m = parsed.data;
    try {
      switch (m.type) {
        case "hello": {
          await sync.pull(PULL_TIMEOUT_MS);
          const local = await sync.loadLocal(gameId);
          const session: Session = {
            player: store.player.value,
            state: local.state,
            settings: deps.settings(),
            insets: native.insets(),
            mode: "host",
            sdk: 1,
          };
          reply(m.id, true, session);
          break;
        }
        case "save":
          await sync.saveLocal(gameId, m.payload.state, m.payload.progress);
          if (m.id) reply(m.id, true);
          break;
        case "score": {
          const board: Board | undefined = manifest.boards.find((b) => b.id === m.payload.board);
          if (!board) {
            reply(m.id, false, undefined, `tablero desconocido: ${m.payload.board}`);
            break;
          }
          reply(m.id, true, await sync.recordScore(gameId, board, m.payload.value, m.payload.meta));
          break;
        }
        case "ad.interstitial":
          await withAdPause(() => ads.interstitial(manifest));
          reply(m.id, true);
          break;
        case "ad.rewarded":
          reply(m.id, true, await withAdPause(() => ads.rewarded(manifest)));
          break;
        case "haptic":
          if (deps.settings().haptics) native.haptic(m.payload.kind);
          break;
        case "leaderboard.open":
          deps.onLeaderboard(m.payload.board);
          break;
        case "exit":
          deps.onExit();
          break;
      }
    } catch (e) {
      console.warn(`[host] error atendiendo "${m.type}"`, e);
      if ("id" in m && typeof m.id === "string") reply(m.id, false, undefined, e instanceof Error ? e.message : "error");
    }
  }

  function onMessage(ev: MessageEvent) {
    if (disposed) return;
    if (ev.source !== iframe.contentWindow || iframe.contentWindow === null) return;
    if (origin !== "null" && ev.origin !== origin) return;
    void handleMessage(ev.data);
  }
  window.addEventListener("message", onMessage);

  const offBackground = native.onBackground((bg) => (bg ? pause() : resume()));

  return {
    dispose() {
      disposed = true;
      window.removeEventListener("message", onMessage);
      offBackground();
    },
    pause,
    resume,
    notifySettings() {
      post({ arcade: 1, type: "settings", payload: deps.settings() });
    },
  };
}
