import type { Manifest } from "@arcade/protocol";
import { isDark } from "./color";

/** Variables CSS con la paleta del juego (el hub toma prestado el color de cada juego). */
export function gameVars(m: Manifest): Record<string, string> {
  return {
    "--g-bg": m.theme.background,
    "--g-ink": m.theme.ink,
    "--g-accent": m.theme.accent,
    "--g-on-accent": isDark(m.theme.accent) ? "#ffffff" : "#111111",
  };
}
