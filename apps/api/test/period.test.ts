import { describe, expect, it } from "vitest";
import { isoWeekKey } from "../src/period";

describe("isoWeekKey (semana ISO 8601 en UTC)", () => {
  // Verificados a mano: 2026-01-01 es jueves ⇒ 2026 tiene 53 semanas ISO (W01 empieza el lunes 2025-12-29).
  // 2026-10-04 es domingo (cierra W40) y 2026-10-05 es lunes (abre W41).
  const casos: Array<[string, string]> = [
    ["2026-10-04T23:59:59Z", "2026-W40"],
    ["2026-10-05T00:00:00Z", "2026-W41"],
    ["2026-12-31T12:00:00Z", "2026-W53"],
    ["2027-01-03T12:00:00Z", "2026-W53"],
    ["2027-01-04T00:00:00Z", "2027-W01"],
    // Extra: bordes de año y relleno de ceros
    ["2025-12-29T00:00:00Z", "2026-W01"],
    ["2026-01-01T00:00:00Z", "2026-W01"],
    ["2024-12-30T00:00:00Z", "2025-W01"],
    ["2021-01-03T23:59:59Z", "2020-W53"],
    ["2026-03-02T10:00:00Z", "2026-W10"],
  ];
  for (const [iso, esperado] of casos) {
    it(`${iso} → ${esperado}`, () => {
      expect(isoWeekKey(new Date(iso))).toBe(esperado);
    });
  }

  it("usa UTC aunque la hora local sea otra", () => {
    // 2026-10-04T23:30:00-05:00 son las 04:30Z del lunes 5 ⇒ W41
    expect(isoWeekKey(new Date("2026-10-04T23:30:00-05:00"))).toBe("2026-W41");
  });
});
