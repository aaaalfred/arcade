import { createContext } from "preact";
import { useContext } from "preact/hooks";
import { createApiClient, type ApiClient } from "./api";
import { createAds, createAdsImpl, type AdsService } from "./ads";
import { createAuth, type Auth } from "./auth";
import { buildCatalog, getCatalog, type CatalogGame } from "./catalog";
import { createNative, type Native } from "./native";
import { createKV, type KV } from "./storage";
import { bindPrefs, createStore, type Store } from "./store";
import { createSyncEngine, type SyncEngine } from "./sync";

export interface Services {
  kv: KV;
  store: Store;
  api: ApiClient;
  auth: Auth;
  sync: SyncEngine;
  ads: AdsService;
  native: Native;
  catalog: CatalogGame[];
  apiConfigured: boolean;
}

export function createServices(over: Partial<Services> = {}): Services {
  const kv = over.kv ?? createKV();
  const store = over.store ?? createStore();
  const env = import.meta.env;
  const baseUrl: string = env.VITE_API_URL ?? (env.DEV ? "http://localhost:8787" : "");
  const api = over.api ?? createApiClient({ baseUrl, kv });
  const auth = over.auth ?? createAuth({ api, kv, store });
  const sync = over.sync ?? createSyncEngine({ kv, api, store, auth });
  const adsEnabled = env.VITE_ADS_ENABLED !== "0";
  const ads = over.ads ?? createAds({ impl: createAdsImpl(), enabled: adsEnabled });
  return {
    kv, store, api, auth, sync, ads,
    native: over.native ?? createNative(),
    catalog: over.catalog ?? getCatalog(),
    apiConfigured: over.apiConfigured ?? Boolean(baseUrl),
  };
}

/** Arranque: carga lo local, escucha red y botones y empieza a sincronizar. Devuelve cómo detenerlo. */
export async function boot(s: Services): Promise<() => void> {
  const unbindPrefs = await bindPrefs(s.store, s.kv);
  await s.auth.init();
  await s.sync.init();
  const offNet = s.native.onNetwork((online) => (s.store.online.value = online));
  const stopSync = s.apiConfigured ? s.sync.start() : () => undefined;
  return () => {
    unbindPrefs();
    offNet();
    stopSync();
  };
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error("ServicesContext no disponible");
  return s;
}

export { buildCatalog };
