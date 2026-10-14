import { describe, expect, it } from "vitest";
import { parseManifest } from "../src/index";

const base = {
  id: "flechas",
  name: "Flechas",
  version: "1.0.0",
  sdk: 1,
  theme: { accent: "#3f8a52", background: "#f3f7f1", ink: "#2e473f" },
  icon: "🏹",
  progress: { unit: "niveles", total: 10 },
  boards: [{ id: "stars", name: "Estrellas", sort: "desc", max: 30 }],
};

describe("parseManifest", () => {
  it("acepta un manifiesto válido y aplica valores por defecto", () => {
    const m = parseManifest(base);
    expect(m.entry).toBe("index.html");
    expect(m.orientation).toBe("portrait");
    expect(m.tagline).toBe("");
    expect(m.dev).toBe(false);
    expect(m.ads).toEqual({ interstitial: true, rewarded: true });
    expect(m.boards[0]).toMatchObject({ min: 0, max: 30, integer: true });
  });

  it("acepta una paleta oscura opcional y la valida", () => {
    const dark = { accent: "#5fcf85", background: "#14201c", ink: "#cfe3d8" };
    expect(parseManifest({ ...base, theme: { ...base.theme, dark } }).theme.dark).toEqual(dark);
    expect(() => parseManifest({ ...base, theme: { ...base.theme, dark: { ...dark, ink: "claro" } } })).toThrow();
    expect(parseManifest(base).theme.dark).toBeUndefined();
  });

  it("acepta colores #rgb", () => {
    expect(() => parseManifest({ ...base, theme: { accent: "#3a8", background: "#fff", ink: "#000" } })).not.toThrow();
  });

  it.each([
    ["id en mayúsculas", { id: "Flechas" }],
    ["id demasiado corto", { id: "ab" }],
    ["sdk distinto de 1", { sdk: 2 }],
    ["versión no semver", { version: "uno" }],
    ["color no hex", { theme: { accent: "verde", background: "#fff", ink: "#000" } }],
    ["tablero con max <= min", { boards: [{ id: "s", name: "S", sort: "desc", min: 5, max: 5 }] }],
    ["tablero con sort inválido", { boards: [{ id: "s", name: "S", sort: "up", max: 5 }] }],
    ["ids de tablero repetidos", { boards: [
      { id: "s", name: "S", sort: "desc", max: 5 },
      { id: "s", name: "T", sort: "asc", max: 9 },
    ] }],
    ["entry con ..", { entry: "../x.html" }],
    ["entry absoluto", { entry: "/x.html" }],
    ["progress.total 0", { progress: { unit: "niveles", total: 0 } }],
  ])("rechaza: %s", (_n, patch) => {
    expect(() => parseManifest({ ...base, ...patch })).toThrow();
  });
});
