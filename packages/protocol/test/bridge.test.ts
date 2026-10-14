import { describe, expect, it } from "vitest";
import { GameMessageSchema } from "../src/index";

const ok = (m: unknown) => GameMessageSchema.safeParse(m).success;

describe("GameMessageSchema", () => {
  it("acepta todos los tipos válidos", () => {
    expect(ok({ arcade: 1, id: "1", type: "hello" })).toBe(true);
    expect(ok({ arcade: 1, id: "2", type: "save", payload: { state: { a: 1 }, progress: { value: 3, total: 10 } } })).toBe(true);
    expect(ok({ arcade: 1, id: "3", type: "score", payload: { board: "stars", value: 12 } })).toBe(true);
    expect(ok({ arcade: 1, id: "4", type: "ad.interstitial" })).toBe(true);
    expect(ok({ arcade: 1, id: "5", type: "ad.rewarded" })).toBe(true);
    expect(ok({ arcade: 1, type: "haptic", payload: { kind: "success" } })).toBe(true);
    expect(ok({ arcade: 1, type: "leaderboard.open", payload: {} })).toBe(true);
    expect(ok({ arcade: 1, type: "leaderboard.open", payload: { board: "stars" } })).toBe(true);
    expect(ok({ arcade: 1, type: "exit" })).toBe(true);
  });

  it.each([
    ["tipo desconocido", { arcade: 1, type: "rm-rf" }],
    ["versión de puente distinta", { arcade: 2, type: "hello", id: "1" }],
    ["sin sobre arcade", { type: "hello", id: "1" }],
    ["score con value no numérico", { arcade: 1, id: "1", type: "score", payload: { board: "s", value: "12" } }],
    ["score con value Infinity", { arcade: 1, id: "1", type: "score", payload: { board: "s", value: Infinity } }],
    ["haptic inválido", { arcade: 1, type: "haptic", payload: { kind: "boom" } }],
    ["save sin payload", { arcade: 1, id: "1", type: "save" }],
    ["save con progress negativo", { arcade: 1, id: "1", type: "save", payload: { state: 1, progress: { value: -1 } } }],
    ["no objeto", "hola"],
    ["null", null],
  ])("rechaza: %s", (_n, msg) => {
    expect(ok(msg)).toBe(false);
  });
});
