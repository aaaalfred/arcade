import { vi } from "vitest";

export const ORIGIN = "https://localhost";

/** Ventana falsa para modo host: captura listeners y los mensajes enviados al padre. */
export function makeHostWin() {
  const listeners: Record<string, Array<(e: any) => void>> = {};
  const parent = { postMessage: vi.fn() };
  const win: any = {
    parent,
    location: { origin: ORIGIN },
    addEventListener: (t: string, f: (e: any) => void) => ((listeners[t] ??= []).push(f)),
    removeEventListener: (t: string, f: (e: any) => void) => {
      listeners[t] = (listeners[t] ?? []).filter((x) => x !== f);
    },
  };
  const deliver = (data: unknown, o: { source?: unknown; origin?: string } = {}) => {
    const ev = { data, source: "source" in o ? o.source : parent, origin: o.origin ?? ORIGIN };
    (listeners.message ?? []).slice().forEach((f) => f(ev));
  };
  const sent = (): any[] => parent.postMessage.mock.calls.map((c) => c[0]);
  const last = () => sent().at(-1);
  const reply = (id: string, ok: boolean, payload?: unknown, error?: string) =>
    deliver({ arcade: 1, replyTo: id, ok, payload, error });
  return { win, parent, deliver, sent, last, reply };
}

export const SESSION = {
  player: { id: "p1", nickname: "Jugador1234" },
  state: { level: 3 },
  settings: { sound: true, haptics: true, locale: "es" },
  insets: { top: 20, right: 0, bottom: 10, left: 0 },
  mode: "host",
  sdk: 1,
} as const;

export function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
