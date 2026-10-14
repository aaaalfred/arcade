import { effect, signal, type Signal } from "@preact/signals";
import type { PlayerInfo, SaveProgress, Settings } from "@arcade/protocol";
import type { KV } from "./storage";

export interface Store {
  player: Signal<PlayerInfo | null>;
  online: Signal<boolean>;
  /** Progreso por juego (valor/total) para tarjetas y perfil. */
  progress: Signal<Record<string, SaveProgress>>;
  /** Mejor puntaje local por `${juego}:${tablero}`. */
  bests: Signal<Record<string, number>>;
  /** Última posición conocida por `${juego}:${tablero}`. */
  ranks: Signal<Record<string, { all: number | null; weekly: number | null }>>;
  settings: Signal<Settings>;
  lastGame: Signal<string | null>;
  syncing: Signal<boolean>;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, haptics: true, locale: "es" };

export function createStore(): Store {
  return {
    player: signal(null),
    online: signal(true),
    progress: signal({}),
    bests: signal({}),
    ranks: signal({}),
    settings: signal({ ...DEFAULT_SETTINGS }),
    lastGame: signal(null),
    syncing: signal(false),
  };
}

/** Carga ajustes y último juego desde el KV y los vuelve a guardar cuando cambian. */
export async function bindPrefs(store: Store, kv: KV): Promise<() => void> {
  try {
    const s = await kv.get("settings");
    if (s) store.settings.value = { ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<Settings>) };
    store.lastGame.value = await kv.get("lastGame");
  } catch {
    /* preferencias corruptas: se usan las de fábrica */
  }
  let first = true;
  return effect(() => {
    const settings = store.settings.value;
    const last = store.lastGame.value;
    if (first) {
      first = false;
      return;
    }
    void kv.set("settings", JSON.stringify(settings));
    if (last) void kv.set("lastGame", last);
  });
}
