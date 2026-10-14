import { vi } from "vitest";
import type { ApiClient } from "../src/services/api";
import type { KV } from "../src/services/storage";

export function memoryKV(initial: Record<string, string> = {}): KV & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, v); },
    async remove(k) { m.delete(k); },
    async keys(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    dump() { return Object.fromEntries(m); },
  };
}

/** ApiClient falso: credenciales en memoria y respuestas configurables por método. */
export function fakeApi(over: Partial<{ [K in keyof ApiClient]: any }> = {}): { [K in keyof ApiClient]: ReturnType<typeof vi.fn> } & ApiClient {
  let creds = false;
  const api: any = {
    hasCredentials: vi.fn(async () => creds),
    auth: vi.fn(async () => ({ playerId: "p1", secret: "s3cret", nickname: "Jugador1" })),
    me: vi.fn(async () => ({ id: "p1", nickname: "Jugador1" })),
    setNickname: vi.fn(async (nickname: string) => ({ id: "p1", nickname })),
    getSaves: vi.fn(async () => []),
    putSave: vi.fn(async (_g: string, b: any) => ({ rev: (b.baseRev ?? 0) + 1, resolution: "updated", save: {} })),
    postScore: vi.fn(async (_g: string, b: any) => ({ accepted: true, best: b.value, rank: { all: 1, weekly: 1 }, offline: false })),
    getBoard: vi.fn(async () => ({ entries: [], me: null })),
    report: vi.fn(async () => undefined),
    deleteMe: vi.fn(async () => undefined),
    clearCredentials: vi.fn(async () => { creds = false; }),
  };
  Object.assign(api, over);
  const origAuth = api.auth;
  api.auth = vi.fn(async (...a: unknown[]) => { const r = await origAuth(...a); creds = true; return r; });
  return api;
}

export function fakeNative() {
  let bg: Array<(b: boolean) => void> = [];
  let back: Array<() => void> = [];
  return {
    isNative: false,
    haptic: vi.fn(),
    lockOrientation: vi.fn(async () => undefined),
    unlockOrientation: vi.fn(async () => undefined),
    onBackground: vi.fn((fn: (b: boolean) => void) => {
      bg.push(fn);
      return () => void (bg = bg.filter((f) => f !== fn));
    }),
    onBackButton: vi.fn((fn: () => void) => {
      back.push(fn);
      return () => void (back = back.filter((f) => f !== fn));
    }),
    onNetwork: vi.fn(() => () => undefined),
    insets: vi.fn(() => ({ top: 20, right: 0, bottom: 10, left: 0 })),
    setStatusBar: vi.fn(async () => undefined),
    emitBackground: (b: boolean) => bg.forEach((f) => f(b)),
    emitBack: () => back.forEach((f) => f()),
  };
}
