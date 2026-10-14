// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
// @ts-expect-error — módulo .mjs sin tipos
import { buildSdk } from "../../../scripts/build-sdk.mjs";

function page(html = '<script data-game="demo"></script>') {
  return new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: "outside-only", url: "http://localhost:5174/" });
}

describe("bundle IIFE del SDK", () => {
  it("define window.Arcade, toma data-game y funciona en standalone", async () => {
    const { code, bytes } = await buildSdk({ write: false });
    expect(bytes).toBeLessThan(12 * 1024);
    const dom = page();
    dom.window.eval(code);
    const A = (dom.window as any).Arcade;
    expect(A).toBeDefined();
    expect((await A.ready()).mode).toBe("standalone");
    A.save({ ok: true });
    expect(dom.window.localStorage.getItem("arcade:standalone:demo:state")).toBe('{"ok":true}');
  });

  it("sin data-game avisa y usa 'unknown'", async () => {
    const { code } = await buildSdk({ write: false });
    const dom = page("");
    const warns: unknown[] = [];
    (dom.window as any).console.warn = (...a: unknown[]) => warns.push(a);
    dom.window.eval(code);
    expect(warns.length).toBeGreaterThan(0);
    (dom.window as any).Arcade.save({ a: 1 });
    expect(dom.window.localStorage.getItem("arcade:standalone:unknown:state")).toBe('{"a":1}');
  });

  it("no pisa un window.Arcade existente (idempotente)", async () => {
    const { code } = await buildSdk({ write: false });
    const dom = page();
    const fake = { fake: true };
    (dom.window as any).Arcade = fake;
    dom.window.eval(code);
    expect((dom.window as any).Arcade).toBe(fake);
  });

  it("el bundle no arrastra zod", async () => {
    const { code } = await buildSdk({ write: false });
    expect(code).not.toMatch(/ZodError|\$ZodType/);
  });
});
