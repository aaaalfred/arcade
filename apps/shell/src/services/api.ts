import type {
  AuthResponse, BoardResponse, PlayerInfo, SaveBody, SaveRecord, SaveResult, ScoreBody, ScoreResult,
} from "@arcade/protocol";
import type { KV } from "./storage";

export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public body?: unknown,
  ) {
    super(message ?? code);
  }
}

export interface ApiClient {
  hasCredentials(): Promise<boolean>;
  auth(): Promise<AuthResponse>;
  me(): Promise<PlayerInfo>;
  setNickname(nickname: string): Promise<PlayerInfo>;
  getSaves(): Promise<SaveRecord[]>;
  putSave(gameId: string, body: SaveBody): Promise<SaveResult>;
  postScore(gameId: string, body: ScoreBody): Promise<ScoreResult>;
  getBoard(gameId: string, board: string, period: "all" | "weekly", limit?: number): Promise<BoardResponse>;
  report(targetPlayerId: string, reason: string): Promise<void>;
  deleteMe(): Promise<void>;
  clearCredentials(): Promise<void>;
}

interface Creds {
  playerId: string;
  secret: string;
}

export function createApiClient(opts: { baseUrl: string; kv: KV; fetch?: typeof fetch; timeoutMs?: number }): ApiClient {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const base = opts.baseUrl.replace(/\/+$/, "");

  async function creds(): Promise<Creds | null> {
    const raw = await opts.kv.get("creds");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Creds;
    } catch {
      return null;
    }
  }

  async function request<T>(method: string, path: string, body?: unknown, authed = true): Promise<T> {
    if (!base) throw new ApiError(0, "network", "API no configurada (VITE_API_URL)");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authed) {
      const c = await creds();
      if (!c) throw new ApiError(401, "unauthorized", "sin credenciales");
      headers.Authorization = `Bearer ${c.playerId}.${c.secret}`;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(base + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      throw new ApiError(0, "network", (e as Error).message);
    } finally {
      clearTimeout(timer);
    }
    let data: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError(res.status, "invalid_response", "la respuesta no es JSON");
      }
    }
    if (!res.ok) {
      const err = (data ?? {}) as { error?: string; message?: string };
      throw new ApiError(res.status, err.error ?? "http_error", err.message, data);
    }
    return data as T;
  }

  return {
    async hasCredentials() {
      return (await creds()) !== null;
    },
    async auth() {
      const r = await request<AuthResponse>("POST", "/v1/auth/anonymous", {}, false);
      await opts.kv.set("creds", JSON.stringify({ playerId: r.playerId, secret: r.secret }));
      return r;
    },
    me: () => request<PlayerInfo>("GET", "/v1/me"),
    setNickname: (nickname) => request<PlayerInfo>("PATCH", "/v1/me", { nickname }),
    getSaves: () => request<SaveRecord[]>("GET", "/v1/saves"),
    putSave: (gameId, body) => request<SaveResult>("PUT", `/v1/games/${gameId}/save`, body),
    postScore: (gameId, body) => request<ScoreResult>("POST", `/v1/games/${gameId}/scores`, body),
    getBoard: (gameId, board, period, limit = 50) =>
      request<BoardResponse>("GET", `/v1/games/${gameId}/boards/${board}?period=${period}&limit=${limit}`),
    async report(targetPlayerId, reason) {
      await request("POST", "/v1/reports", { targetPlayerId, reason });
    },
    async deleteMe() {
      await request("DELETE", "/v1/me");
      await opts.kv.remove("creds");
    },
    async clearCredentials() {
      await opts.kv.remove("creds");
    },
  };
}
