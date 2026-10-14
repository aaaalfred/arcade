import { describe, expect, it } from "vitest";
import { parseHash, toHash } from "../src/router";

describe("router", () => {
  it.each([
    ["", { name: "home" }],
    ["#/", { name: "home" }],
    ["#/game/flechas", { name: "game", id: "flechas" }],
    ["#/play/flechas", { name: "play", id: "flechas" }],
    ["#/ranking", { name: "ranking" }],
    ["#/ranking/flechas", { name: "ranking", id: "flechas" }],
    ["#/profile", { name: "profile" }],
  ])("parseHash(%s)", (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected);
  });

  it.each(["#/nada", "#/game", "#/play/", "#/game/Mal Id", "#/game/a/b", "basura"])("ruta inválida %s ⇒ home", (hash) => {
    expect(parseHash(hash)).toEqual({ name: "home" });
  });

  it("toHash es inverso de parseHash", () => {
    for (const r of [
      { name: "home" }, { name: "game", id: "flechas" }, { name: "play", id: "flechas" },
      { name: "ranking" }, { name: "ranking", id: "flechas" }, { name: "profile" },
    ] as const) {
      expect(parseHash(toHash(r))).toEqual(r);
    }
  });
});
