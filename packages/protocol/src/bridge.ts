import { z } from "zod";
export { BRIDGE_VERSION } from "./limits";

export type Haptic = "light" | "medium" | "heavy" | "success" | "error";

export interface Settings {
  sound: boolean;
  haptics: boolean;
  locale: string;
}
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface PlayerInfo {
  id: string;
  nickname: string;
}
export interface SaveProgress {
  value: number;
  total?: number;
}
export interface Session {
  player: PlayerInfo | null;
  state: unknown | null;
  settings: Settings;
  insets: Insets;
  mode: "host" | "standalone";
  sdk: 1;
}
export interface ScoreResult {
  accepted: boolean;
  best: number;
  rank: { all: number | null; weekly: number | null };
  offline: boolean;
}

const Id = z.string().min(1).max(64);
const ProgressSchema = z.object({
  value: z.number().int().min(0),
  total: z.number().int().min(0).optional(),
});

/** Mensajes que un juego envía al shell. `id` presente ⇒ espera una respuesta (`Reply`). */
export const GameMessageSchema = z.discriminatedUnion("type", [
  z.object({ arcade: z.literal(1), id: Id, type: z.literal("hello") }),
  z.object({
    arcade: z.literal(1),
    id: Id.optional(),
    type: z.literal("save"),
    payload: z.object({ state: z.unknown(), progress: ProgressSchema.optional() }),
  }),
  z.object({
    arcade: z.literal(1),
    id: Id,
    type: z.literal("score"),
    payload: z.object({
      board: z.string().min(1).max(32),
      value: z.number().finite(),
      meta: z.record(z.string(), z.unknown()).optional(),
    }),
  }),
  z.object({ arcade: z.literal(1), id: Id, type: z.literal("ad.interstitial") }),
  z.object({ arcade: z.literal(1), id: Id, type: z.literal("ad.rewarded") }),
  z.object({
    arcade: z.literal(1),
    type: z.literal("haptic"),
    payload: z.object({ kind: z.enum(["light", "medium", "heavy", "success", "error"]) }),
  }),
  z.object({
    arcade: z.literal(1),
    type: z.literal("leaderboard.open"),
    payload: z.object({ board: z.string().min(1).max(32).optional() }).default({}),
  }),
  z.object({ arcade: z.literal(1), type: z.literal("exit") }),
]);
export type GameMessage = z.infer<typeof GameMessageSchema>;

/** Eventos del shell hacia el juego. */
export type HostEvent =
  | { arcade: 1; type: "pause" }
  | { arcade: 1; type: "resume" }
  | { arcade: 1; type: "settings"; payload: Settings };

/** Respuesta del shell a una petición con `id`. */
export interface Reply {
  arcade: 1;
  replyTo: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}
