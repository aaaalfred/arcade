import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Network } from "@capacitor/network";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Haptic, Insets, Manifest } from "@arcade/protocol";

export interface Native {
  isNative: boolean;
  haptic(kind: Haptic): void;
  lockOrientation(o: Manifest["orientation"]): Promise<void>;
  unlockOrientation(): Promise<void>;
  /** `true` cuando la app pasa a segundo plano. */
  onBackground(fn: (background: boolean) => void): () => void;
  /** Botón atrás de Android. */
  onBackButton(fn: () => void): () => void;
  onNetwork(fn: (online: boolean) => void): () => void;
  insets(): Insets;
  setStatusBar(style: "light" | "dark", background?: string): Promise<void>;
}

/** Registra un listener de Capacitor (asíncrono) y devuelve un "desuscribir" síncrono. */
function listen(add: () => Promise<{ remove(): Promise<void> }>): () => void {
  let removed = false;
  let handle: { remove(): Promise<void> } | null = null;
  void add().then(
    (h) => {
      if (removed) void h.remove();
      else handle = h;
    },
    () => undefined,
  );
  return () => {
    removed = true;
    void handle?.remove();
  };
}

const quiet = <T>(p: Promise<T>) => p.catch(() => undefined);

export function createNative(): Native {
  const isNative = Capacitor.isNativePlatform();

  return {
    isNative,

    haptic(kind) {
      if (!isNative) {
        try {
          navigator.vibrate?.(kind === "heavy" ? 40 : kind === "medium" ? 20 : 10);
        } catch {
          /* sin vibración */
        }
        return;
      }
      if (kind === "success") void quiet(Haptics.notification({ type: NotificationType.Success }));
      else if (kind === "error") void quiet(Haptics.notification({ type: NotificationType.Error }));
      else {
        const style = kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
        void quiet(Haptics.impact({ style }));
      }
    },

    async lockOrientation(o) {
      if (!isNative || o === "any") return;
      await quiet(ScreenOrientation.lock({ orientation: o === "portrait" ? "portrait" : "landscape" }));
    },
    async unlockOrientation() {
      if (!isNative) return;
      await quiet(ScreenOrientation.unlock());
    },

    onBackground(fn) {
      if (isNative) return listen(() => App.addListener("appStateChange", (s) => fn(!s.isActive)));
      const h = () => fn(document.visibilityState === "hidden");
      document.addEventListener("visibilitychange", h);
      return () => document.removeEventListener("visibilitychange", h);
    },

    onBackButton(fn) {
      if (!isNative) return () => undefined;
      return listen(() => App.addListener("backButton", () => fn()));
    },

    onNetwork(fn) {
      if (isNative) {
        void quiet(Network.getStatus().then((s) => fn(s.connected)));
        return listen(() => Network.addListener("networkStatusChange", (s) => fn(s.connected)));
      }
      const on = () => fn(true);
      const off = () => fn(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      fn(navigator.onLine);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    },

    insets() {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const px = (v: string) => Number.parseFloat(v) || 0;
      const insets = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
      probe.remove();
      return insets;
    },

    async setStatusBar(style, background) {
      if (!isNative) return;
      // Style.Dark = texto claro (para fondos oscuros)
      await quiet(StatusBar.setStyle({ style: style === "dark" ? Style.Dark : Style.Light }));
      if (background && Capacitor.getPlatform() === "android") await quiet(StatusBar.setBackgroundColor({ color: background }));
    },
  };
}
