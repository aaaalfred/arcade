import type { HostWindow } from "./types";

export interface HostClient {
  request<T = unknown>(type: string, payload: unknown, timeoutMs: number): Promise<T>;
  post(type: string, payload?: unknown): void;
  dispose(): void;
}

type EventName = "pause" | "resume" | "settings";
const EVENTS: ReadonlySet<string> = new Set(["pause", "resume", "settings"]);

/** Cliente del puente: solo acepta mensajes de `window.parent` y del mismo origen. */
export function createHostClient(win: HostWindow, onEvent: (name: EventName, payload: unknown) => void): HostClient {
  let seq = 0;
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const parent = win.parent as { postMessage(msg: unknown, origin: string): void };
  const origin = win.location.origin;
  const targetOrigin = !origin || origin === "null" ? "*" : origin;

  function handle(ev: { data: unknown; source: unknown; origin: string }) {
    if (ev.source !== win.parent) return;
    if (targetOrigin !== "*" && ev.origin !== targetOrigin) return;
    const d = ev.data as Record<string, unknown> | null;
    if (!d || typeof d !== "object" || d.arcade !== 1) return;
    if (typeof d.replyTo === "string") {
      const p = pending.get(d.replyTo);
      if (!p) return;
      pending.delete(d.replyTo);
      clearTimeout(p.timer);
      if (d.ok === true) p.resolve(d.payload);
      else p.reject(new Error(typeof d.error === "string" ? d.error : "error del shell"));
      return;
    }
    if (typeof d.type === "string" && EVENTS.has(d.type)) onEvent(d.type as EventName, d.payload);
  }
  win.addEventListener("message", handle);

  function send(msg: Record<string, unknown>) {
    try {
      parent.postMessage({ arcade: 1, ...msg }, targetOrigin);
    } catch (e) {
      console.warn("[Arcade] no se pudo enviar al shell", e);
    }
  }

  return {
    request(type, payload, timeoutMs) {
      return new Promise((resolve, reject) => {
        const id = `${Date.now().toString(36)}-${++seq}`;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`tiempo agotado esperando al shell (${type})`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        send(payload === undefined ? { id, type } : { id, type, payload });
      });
    },
    post(type, payload) {
      send(payload === undefined ? { type } : { type, payload });
    },
    dispose() {
      win.removeEventListener("message", handle);
      pending.forEach((p) => clearTimeout(p.timer));
      pending.clear();
    },
  };
}
