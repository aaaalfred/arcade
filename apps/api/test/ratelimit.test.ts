import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/ratelimit";

function setup(limit = 3, windowMs = 60_000) {
  let t = 1_000_000;
  const limiter = createRateLimiter({ limit, windowMs, now: () => t });
  return { limiter, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter (ventana deslizante)", () => {
  it("permite hasta `limit` y rechaza el siguiente con retryAfterSec", () => {
    const { limiter, advance } = setup();
    expect(limiter.hit("a").ok).toBe(true);
    advance(10_000);
    expect(limiter.hit("a").ok).toBe(true);
    advance(10_000);
    expect(limiter.hit("a").ok).toBe(true);
    advance(10_000);
    const r = limiter.hit("a");
    expect(r).toEqual({ ok: false, retryAfterSec: 30 }); // el primero caduca a los 60 s; han pasado 30
  });

  it("la ventana se desliza: tras caducar el primer golpe vuelve a haber hueco", () => {
    const { limiter, advance } = setup();
    limiter.hit("a");
    advance(20_000);
    limiter.hit("a");
    limiter.hit("a");
    expect(limiter.hit("a").ok).toBe(false);
    advance(40_001); // el primero (t=0) ya caducó, los otros dos no
    expect(limiter.hit("a").ok).toBe(true);
    expect(limiter.hit("a").ok).toBe(false);
  });

  it("los intentos rechazados no alargan el bloqueo", () => {
    const { limiter, advance } = setup(1, 60_000);
    limiter.hit("a");
    advance(30_000);
    for (let i = 0; i < 20; i++) expect(limiter.hit("a").ok).toBe(false);
    advance(30_001);
    expect(limiter.hit("a").ok).toBe(true);
  });

  it("las claves son independientes", () => {
    const { limiter } = setup(1);
    expect(limiter.hit("a").ok).toBe(true);
    expect(limiter.hit("b").ok).toBe(true);
    expect(limiter.hit("a").ok).toBe(false);
  });

  it("retryAfterSec nunca es menor que 1", () => {
    const { limiter, advance } = setup(1, 1000);
    limiter.hit("a");
    advance(999);
    expect(limiter.hit("a")).toEqual({ ok: false, retryAfterSec: 1 });
  });

  it("libera memoria de las claves caducadas", () => {
    const { limiter, advance } = setup(5, 1000);
    for (let i = 0; i < 2000; i++) limiter.hit(`k${i}`);
    expect(limiter.size()).toBe(2000);
    advance(2000);
    limiter.hit("nueva");
    limiter.prune();
    expect(limiter.size()).toBe(1);
  });
});
