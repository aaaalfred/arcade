import { z } from "zod";
import type { PlayerInfo, SaveProgress, ScoreResult } from "./bridge";

export type { PlayerInfo, SaveProgress, ScoreResult };

const Progress = z.object({ value: z.number().int().min(0), total: z.number().int().min(0).optional() });

export const SetNicknameBody = z.object({ nickname: z.string() });
export const SaveBody = z.object({
  state: z.unknown(),
  progress: Progress,
  baseRev: z.number().int().min(0),
});
export const ScoreBody = z.object({
  board: z.string().min(1).max(32),
  value: z.number().finite(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export const ReportBody = z.object({
  targetPlayerId: z.string().min(1).max(64),
  reason: z.string().max(200),
});

export type SetNicknameBody = z.infer<typeof SetNicknameBody>;
export type SaveBody = z.infer<typeof SaveBody>;
export type ScoreBody = z.infer<typeof ScoreBody>;
export type ReportBody = z.infer<typeof ReportBody>;

export interface AuthResponse {
  playerId: string;
  secret: string;
  nickname: string;
}
export interface SaveRecord {
  gameId: string;
  rev: number;
  state: unknown;
  progress: SaveProgress;
  updatedAt: string;
}
export interface SaveResult {
  rev: number;
  resolution: "created" | "updated" | "server-wins";
  save: SaveRecord;
}
export interface BoardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  value: number;
  isMe: boolean;
}
export interface BoardResponse {
  entries: BoardEntry[];
  me: { rank: number; value: number } | null;
}
export interface ApiError {
  error: string;
  message?: string;
}
