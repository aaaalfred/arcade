import { describe, expect, it } from "vitest";
import { SaveBody, ScoreBody, SetNicknameBody, ReportBody, MAX_SAVE_BYTES } from "../src/index";

describe("cuerpos de la API", () => {
  it("SaveBody exige baseRev entero >= 0 y progress.value entero >= 0", () => {
    expect(SaveBody.safeParse({ state: {}, progress: { value: 0 }, baseRev: 0 }).success).toBe(true);
    expect(SaveBody.safeParse({ state: {}, progress: { value: 1.5 }, baseRev: 0 }).success).toBe(false);
    expect(SaveBody.safeParse({ state: {}, progress: { value: 1 }, baseRev: -1 }).success).toBe(false);
  });
  it("ScoreBody exige number finito", () => {
    expect(ScoreBody.safeParse({ board: "s", value: 3 }).success).toBe(true);
    expect(ScoreBody.safeParse({ board: "s", value: null }).success).toBe(false);
    expect(ScoreBody.safeParse({ board: "s", value: "3" }).success).toBe(false);
  });
  it("SetNicknameBody exige string", () => {
    expect(SetNicknameBody.safeParse({ nickname: "Ángel" }).success).toBe(true);
    expect(SetNicknameBody.safeParse({ nickname: 3 }).success).toBe(false);
  });
  it("ReportBody limita el motivo a 200", () => {
    expect(ReportBody.safeParse({ targetPlayerId: "x", reason: "a".repeat(201) }).success).toBe(false);
    expect(ReportBody.safeParse({ targetPlayerId: "x", reason: "ofensivo" }).success).toBe(true);
  });
  it("límite de guardado = 64 KB", () => {
    expect(MAX_SAVE_BYTES).toBe(65536);
  });
});
