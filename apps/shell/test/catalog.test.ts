import { describe, expect, it } from "vitest";
import { buildCatalog } from "../src/services/catalog";

const m = (id: string, over: Record<string, unknown> = {}) => ({
  id, name: id.toUpperCase(), version: "1.0.0", sdk: 1,
  theme: { accent: "#111", background: "#fff", ink: "#000" },
  icon: "🎮", progress: { unit: "niveles", total: 3 }, boards: [], ...over,
});

describe("buildCatalog", () => {
  it("construye URLs relativas y ordena por nombre", () => {
    const c = buildCatalog([m("zeta"), m("alfa")], { includeDev: false });
    expect(c.map((g) => g.manifest.id)).toEqual(["alfa", "zeta"]);
    expect(c[0]).toMatchObject({ baseUrl: "games/alfa/", entryUrl: "games/alfa/index.html" });
  });
  it("oculta juegos dev salvo includeDev", () => {
    const raw = [m("real"), m("lab", { dev: true })];
    expect(buildCatalog(raw, { includeDev: false }).map((g) => g.manifest.id)).toEqual(["real"]);
    expect(buildCatalog(raw, { includeDev: true })).toHaveLength(2);
  });
  it("lanza con un manifiesto inválido indicando cuál", () => {
    expect(() => buildCatalog([m("ok-game"), { id: "roto" }], { includeDev: true })).toThrow(/roto/);
  });
  it("lanza con ids duplicados", () => {
    expect(() => buildCatalog([m("dup"), m("dup")], { includeDev: true })).toThrow(/dup/);
  });
  it("respeta entry personalizado", () => {
    const c = buildCatalog([m("custom", { entry: "web/start.html" })], { includeDev: true });
    expect(c[0]!.entryUrl).toBe("games/custom/web/start.html");
  });
});
