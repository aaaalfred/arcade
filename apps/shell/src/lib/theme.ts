import type { Manifest } from "@arcade/protocol";
import { isDark } from "./color";

export interface Palette {
  accent: string;
  background: string;
  ink: string;
}

/** Paleta del juego según el modo del sistema (`theme.dark` si existe y el sistema está en oscuro). */
export function resolvePalette(m: Manifest, systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches): Palette {
  const { dark, ...light } = m.theme;
  return systemDark && dark ? dark : light;
}

/** Variables CSS con la paleta del juego (el hub toma prestado el color de cada juego). */
export function gameVars(m: Manifest, systemDark?: boolean): Record<string, string> {
  const p = resolvePalette(m, systemDark);
  return {
    "--g-bg": p.background,
    "--g-ink": p.ink,
    "--g-accent": p.accent,
    "--g-on-accent": isDark(p.accent) ? "#ffffff" : "#111111",
  };
}
