import type { PlayerInfo } from "@arcade/protocol";
import { ApiError, type ApiClient } from "./api";
import type { Store } from "./store";
import type { KV } from "./storage";

export interface Auth {
  /** Carga el jugador en caché (si existe) a la store. */
  init(): Promise<void>;
  /** Garantiza que hay cuenta; registra una anónima si hace falta. `false` si no hay red. */
  ensure(): Promise<boolean>;
  /** Descarta las credenciales y crea una cuenta nueva (el servidor ya no nos reconoce). */
  reregister(): Promise<void>;
  setNickname(nickname: string): Promise<PlayerInfo>;
  /** Borra la cuenta en el servidor. Lanza si no hay conexión. */
  deleteAccount(): Promise<void>;
}

export function createAuth(deps: { api: ApiClient; kv: KV; store: Store }): Auth {
  const { api, kv, store } = deps;
  let inflight: Promise<boolean> | null = null;

  async function register(): Promise<boolean> {
    try {
      const r = await api.auth();
      const player = { id: r.playerId, nickname: r.nickname };
      store.player.value = player;
      await kv.set("player", JSON.stringify(player));
      return true;
    } catch {
      return false;
    }
  }

  const auth: Auth = {
    async init() {
      try {
        const raw = await kv.get("player");
        if (raw) store.player.value = JSON.parse(raw) as PlayerInfo;
      } catch {
        /* caché corrupta */
      }
    },
    ensure() {
      inflight ??= (async () => {
        try {
          if (await api.hasCredentials()) return true;
          return await register();
        } finally {
          inflight = null;
        }
      })();
      return inflight;
    },
    async reregister() {
      await api.clearCredentials();
      store.player.value = null;
      await kv.remove("player");
      if (!(await auth.ensure())) throw new ApiError(0, "network", "sin red para crear la cuenta");
    },
    async setNickname(nickname) {
      if (!(await auth.ensure())) throw new ApiError(0, "network", "sin red");
      const p = await api.setNickname(nickname);
      store.player.value = p;
      await kv.set("player", JSON.stringify(p));
      return p;
    },
    async deleteAccount() {
      try {
        if (await api.hasCredentials()) await api.deleteMe();
      } catch (e) {
        // 401 = el servidor ya no conoce la cuenta: no hay nada que borrar allí.
        if (!(e instanceof ApiError && e.status === 401)) throw e;
      }
      await api.clearCredentials();
      store.player.value = null;
      await kv.remove("player");
    },
  };
  return auth;
}
