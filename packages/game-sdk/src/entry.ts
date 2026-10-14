import { createArcade } from "./index";
import type { ArcadeApi } from "./types";

declare global {
  interface Window {
    Arcade?: ArcadeApi;
  }
}

if (!window.Arcade) {
  const script = document.currentScript as HTMLScriptElement | null;
  const gameId =
    script?.dataset.game ?? document.querySelector("script[data-game]")?.getAttribute("data-game") ?? "unknown";
  if (gameId === "unknown") console.warn('[Arcade] falta data-game="<id>" en la etiqueta <script> del SDK');
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* sin storage */ }
  window.Arcade = createArcade({
    win: window as any,
    gameId,
    storage,
    vibrate: typeof navigator.vibrate === "function" ? navigator.vibrate.bind(navigator) : undefined,
    doc: document,
  });
}
