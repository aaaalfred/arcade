import type { Haptic, SaveProgress, ScoreResult, Session, Settings } from "@arcade/protocol";

export type { Haptic, SaveProgress, ScoreResult, Session, Settings };
export type ArcadeEvent = "pause" | "resume" | "settings";

export interface ArcadeApi {
  /** Handshake con el shell. Se cachea; entrega estado guardado, ajustes y área segura. */
  ready(): Promise<Session>;
  /** Guarda el estado del juego (JSON, ≤ 64 KB). No bloquea; nunca lanza. */
  save(state: unknown, opts?: { progress?: SaveProgress }): void;
  /** Envía un puntaje. Nunca rechaza: sin red resuelve con `offline: true`. */
  submitScore(board: string, value: number, meta?: Record<string, unknown>): Promise<ScoreResult>;
  ads: {
    /** Resuelve cuando el anuncio terminó, falló o se omitió. */
    interstitial(): Promise<void>;
    /** `true` solo si el jugador ganó la recompensa. */
    rewarded(): Promise<boolean>;
  };
  haptic(kind: Haptic): void;
  openLeaderboard(board?: string): void;
  exit(): void;
  on(event: "pause" | "resume", fn: () => void): () => void;
  on(event: "settings", fn: (settings: Settings) => void): () => void;
}

export interface Timeouts {
  hello: number;
  score: number;
  rewarded: number;
  interstitial: number;
}

/** Lo mínimo que el SDK necesita de `window` (permite pruebas con una ventana falsa). */
export interface HostWindow {
  parent: unknown;
  location: { origin: string };
  addEventListener(type: "message", fn: (e: any) => void): void;
  removeEventListener(type: "message", fn: (e: any) => void): void;
  fetch?: (url: string) => Promise<{ json(): Promise<unknown> }>;
}

export interface ArcadeEnv {
  win: HostWindow;
  gameId: string;
  storage?: Storage | null;
  vibrate?: (pattern: number | number[]) => boolean;
  /** Para leer `manifest.json` en modo standalone (orden de los tableros). */
  fetchJson?: (url: string) => Promise<unknown>;
  doc?: Pick<Document, "addEventListener" | "visibilityState"> | null;
  timeouts?: Partial<Timeouts>;
}
