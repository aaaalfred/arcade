import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/** Almacén clave-valor asíncrono. En nativo usa Preferences (entra en Auto Backup / iCloud). */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Claves propias que empiezan por `prefix` (sin el prefijo interno). */
  keys(prefix: string): Promise<string[]>;
}

const PREFIX = "arcade:";

function webKV(): KV {
  const memory = new Map<string, string>();
  return {
    async get(key) {
      try {
        return localStorage.getItem(PREFIX + key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    async set(key, value) {
      memory.set(key, value);
      try {
        localStorage.setItem(PREFIX + key, value);
      } catch {
        /* sin localStorage: queda en memoria */
      }
    },
    async remove(key) {
      memory.delete(key);
      try {
        localStorage.removeItem(PREFIX + key);
      } catch {
        /* nada */
      }
    },
    async keys(prefix) {
      const out = new Set<string>([...memory.keys()].filter((k) => k.startsWith(prefix)));
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(PREFIX + prefix)) out.add(k.slice(PREFIX.length));
        }
      } catch {
        /* nada */
      }
      return [...out];
    },
  };
}

function nativeKV(): KV {
  return {
    async get(key) {
      return (await Preferences.get({ key: PREFIX + key })).value;
    },
    async set(key, value) {
      await Preferences.set({ key: PREFIX + key, value });
    },
    async remove(key) {
      await Preferences.remove({ key: PREFIX + key });
    },
    async keys(prefix) {
      const { keys } = await Preferences.keys();
      return keys.filter((k) => k.startsWith(PREFIX + prefix)).map((k) => k.slice(PREFIX.length));
    },
  };
}

export function createKV(): KV {
  return Capacitor.isNativePlatform() ? nativeKV() : webKV();
}
