import { signal } from "@preact/signals";
import { Capacitor } from "@capacitor/core";
import { MIN_INTERSTITIAL_GAP_MS, type Manifest } from "@arcade/protocol";

/** Implementación concreta de anuncios (simulada o AdMob). */
export interface AdsImpl {
  init(): Promise<void>;
  showInterstitial(): Promise<void>;
  /** `true` si el jugador ganó la recompensa. */
  showRewarded(): Promise<boolean>;
}

export interface AdsService {
  interstitial(game: Manifest): Promise<void>;
  rewarded(game: Manifest): Promise<boolean>;
}

const AD_TIMEOUT_MS = 120_000;

/**
 * Política central de anuncios: el hueco mínimo y los permisos del manifiesto los impone el shell,
 * nunca el juego. Cualquier fallo o cuelgue degrada a "sin anuncio".
 */
export function createAds(opts: {
  impl: AdsImpl;
  enabled: boolean;
  now?: () => number;
  minGapMs?: number;
  timeoutMs?: number;
}): AdsService {
  const now = opts.now ?? Date.now;
  const minGap = opts.minGapMs ?? MIN_INTERSTITIAL_GAP_MS;
  const timeout = opts.timeoutMs ?? AD_TIMEOUT_MS;
  let initP: Promise<boolean> | null = null;
  let lastShown = Number.NEGATIVE_INFINITY;

  const ready = () => (initP ??= opts.impl.init().then(
    () => true,
    (e) => {
      console.warn("[ads] no se pudo inicializar; se desactivan los anuncios", e);
      return false;
    },
  ));

  async function guarded<T>(show: () => Promise<T>, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const limit = new Promise<T>((resolve) => (timer = setTimeout(() => resolve(fallback), timeout)));
    try {
      return await Promise.race([show().catch((e) => {
        console.warn("[ads] fallo al mostrar el anuncio", e);
        return fallback;
      }), limit]);
    } finally {
      clearTimeout(timer!);
    }
  }

  return {
    async interstitial(game) {
      if (!opts.enabled || !game.ads.interstitial) return;
      if (now() - lastShown < minGap) return;
      if (!(await ready())) return;
      lastShown = now();
      await guarded(() => opts.impl.showInterstitial(), undefined);
      lastShown = now();
    },
    async rewarded(game) {
      if (!opts.enabled || !game.ads.rewarded) return false;
      if (!(await ready())) return false;
      lastShown = now();
      const ok = await guarded(() => opts.impl.showRewarded(), false);
      lastShown = now();
      return ok;
    },
  };
}

/* ---------- Simulados (web / desarrollo / E2E) ---------- */

export interface SimulatedAdRequest {
  kind: "interstitial" | "rewarded";
  /** `true` = el jugador vio el anuncio completo. */
  finish(completed: boolean): void;
}
/** La interfaz (SimulatedAdOverlay) muestra esta petición y la resuelve. */
export const simulatedAd = signal<SimulatedAdRequest | null>(null);

export class SimulatedAds implements AdsImpl {
  async init() {}
  private present(kind: SimulatedAdRequest["kind"]): Promise<boolean> {
    return new Promise((resolve) => {
      simulatedAd.value = {
        kind,
        finish: (completed) => {
          simulatedAd.value = null;
          resolve(completed);
        },
      };
    });
  }
  async showInterstitial() {
    await this.present("interstitial");
  }
  showRewarded() {
    return this.present("rewarded");
  }
}

/* ---------- AdMob (solo nativo) ---------- */

export interface AdMobConfig {
  interstitialId: string;
  rewardedId: string;
  testing: boolean;
}

/** IDs de prueba oficiales de Google (https://developers.google.com/admob/android/test-ads). */
const TEST_IDS = {
  android: { interstitial: "ca-app-pub-3940256099942544/1033173712", rewarded: "ca-app-pub-3940256099942544/5224354917" },
  ios: { interstitial: "ca-app-pub-3940256099942544/4411468910", rewarded: "ca-app-pub-3940256099942544/1712485313" },
} as const;

export function admobConfigFromEnv(): AdMobConfig {
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  const env = import.meta.env;
  const interstitial = platform === "ios" ? env.VITE_ADMOB_INTERSTITIAL_IOS : env.VITE_ADMOB_INTERSTITIAL_ANDROID;
  const rewarded = platform === "ios" ? env.VITE_ADMOB_REWARDED_IOS : env.VITE_ADMOB_REWARDED_ANDROID;
  const real = Boolean(interstitial && rewarded);
  return {
    interstitialId: interstitial || TEST_IDS[platform].interstitial,
    rewardedId: rewarded || TEST_IDS[platform].rewarded,
    testing: !real,
  };
}

export class AdMobAds implements AdsImpl {
  constructor(private cfg: AdMobConfig) {}

  async init() {
    const { AdMob, AdmobConsentStatus } = await import("@capacitor-community/admob");
    // 1) Consentimiento (UMP / GDPR)
    let info = await AdMob.requestConsentInfo();
    if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
      info = await AdMob.showConsentForm();
    }
    if (!info.canRequestAds) throw new Error("sin consentimiento para anuncios");
    // 2) Transparencia de seguimiento (iOS)
    const att = await AdMob.trackingAuthorizationStatus();
    if (att.status === "notDetermined") await AdMob.requestTrackingAuthorization();
    // 3) SDK
    await AdMob.initialize({ initializeForTesting: this.cfg.testing });
  }

  async showInterstitial() {
    const { AdMob, InterstitialAdPluginEvents } = await import("@capacitor-community/admob");
    const handles: Array<{ remove(): Promise<void> }> = [];
    try {
      const done = new Promise<void>((resolve) => {
        void AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => resolve()).then((h) => handles.push(h));
        void AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => resolve()).then((h) => handles.push(h));
      });
      await AdMob.prepareInterstitial({ adId: this.cfg.interstitialId, isTesting: this.cfg.testing });
      await AdMob.showInterstitial();
      await done;
    } finally {
      await Promise.all(handles.map((h) => h.remove().catch(() => undefined)));
    }
  }

  async showRewarded() {
    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");
    const handles: Array<{ remove(): Promise<void> }> = [];
    try {
      let rewarded = false;
      const done = new Promise<boolean>((resolve) => {
        void AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (rewarded = true)).then((h) => handles.push(h));
        void AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve(rewarded)).then((h) => handles.push(h));
        void AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve(false)).then((h) => handles.push(h));
      });
      await AdMob.prepareRewardVideoAd({ adId: this.cfg.rewardedId, isTesting: this.cfg.testing });
      await AdMob.showRewardVideoAd();
      return await done;
    } finally {
      await Promise.all(handles.map((h) => h.remove().catch(() => undefined)));
    }
  }
}

/** Elige la implementación según la plataforma y la configuración de compilación. */
export function createAdsImpl(): AdsImpl {
  return Capacitor.isNativePlatform() ? new AdMobAds(admobConfigFromEnv()) : new SimulatedAds();
}
