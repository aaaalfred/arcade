import { describe, expect, it } from "vitest";
import type { Manifest } from "@arcade/protocol";
import { gameVars, resolvePalette } from "../src/lib/theme";

const m = {
  theme: {
    accent: "#3f8a52", background: "#fdfaf2", ink: "#2e473f",
    dark: { accent: "#5fcf85", background: "#14201c", ink: "#cfe3d8" },
  },
} as unknown as Manifest;
const plain = { theme: { accent: "#111111", background: "#ffffff", ink: "#000000" } } as unknown as Manifest;

describe("tema por juego", () => {
  it("usa la paleta clara por defecto y la oscura si el sistema está en oscuro", () => {
    expect(resolvePalette(m, false).background).toBe("#fdfaf2");
    expect(resolvePalette(m, true).background).toBe("#14201c");
  });
  it("sin paleta oscura mantiene la clara aunque el sistema sea oscuro", () => {
    expect(resolvePalette(plain, true).background).toBe("#ffffff");
  });
  it("gameVars elige texto legible sobre el acento", () => {
    expect(gameVars(m, false)["--g-on-accent"]).toBe("#111111"); // verde medio ⇒ texto oscuro
    expect(gameVars(plain, false)["--g-on-accent"]).toBe("#ffffff");
    expect(gameVars(m, true)["--g-accent"]).toBe("#5fcf85");
  });
});
