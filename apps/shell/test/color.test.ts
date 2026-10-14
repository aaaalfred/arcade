import { describe, expect, it } from "vitest";
import { isDark, luminance } from "../src/lib/color";

describe("color", () => {
  it("luminance extremos", () => {
    expect(luminance("#000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });
  it("isDark", () => {
    expect(isDark("#0f1b2d")).toBe(true);
    expect(isDark("#f3f7f1")).toBe(false);
    expect(isDark("#3f8a52")).toBe(false);
  });
});
