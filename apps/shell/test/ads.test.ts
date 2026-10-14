import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest } from "@arcade/protocol";
import { createAds, type AdsImpl } from "../src/services/ads";

const game = (ads = { interstitial: true, rewarded: true }) => ({ id: "flechas", ads }) as unknown as Manifest;

function impl(over: Partial<AdsImpl> = {}): AdsImpl & { [K in keyof AdsImpl]: ReturnType<typeof vi.fn> } {
  return {
    init: vi.fn(async () => undefined),
    showInterstitial: vi.fn(async () => undefined),
    showRewarded: vi.fn(async () => true),
    ...over,
  } as any;
}

let clock = 0;
const now = () => clock;
beforeEach(() => {
  clock = 1_000_000;
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AdsService", () => {
  it("impone 90 s entre intersticiales", async () => {
    const i = impl();
    const ads = createAds({ impl: i, now, enabled: true });
    await ads.interstitial(game());
    clock += 30_000;
    await ads.interstitial(game());
    expect(i.showInterstitial).toHaveBeenCalledTimes(1);
    clock += 61_000;
    await ads.interstitial(game());
    expect(i.showInterstitial).toHaveBeenCalledTimes(2);
  });

  it("un anuncio con recompensa también cuenta para el hueco", async () => {
    const i = impl();
    const ads = createAds({ impl: i, now, enabled: true });
    expect(await ads.rewarded(game())).toBe(true);
    clock += 10_000;
    await ads.interstitial(game());
    expect(i.showInterstitial).not.toHaveBeenCalled();
  });

  it("respeta los flags del manifiesto", async () => {
    const i = impl();
    const ads = createAds({ impl: i, now, enabled: true });
    await ads.interstitial(game({ interstitial: false, rewarded: true }));
    expect(await ads.rewarded(game({ interstitial: true, rewarded: false }))).toBe(false);
    expect(i.showInterstitial).not.toHaveBeenCalled();
    expect(i.showRewarded).not.toHaveBeenCalled();
  });

  it("enabled=false: rewarded devuelve false y no toca la implementación", async () => {
    const i = impl();
    const ads = createAds({ impl: i, now, enabled: false });
    expect(await ads.rewarded(game())).toBe(false);
    await ads.interstitial(game());
    expect(i.init).not.toHaveBeenCalled();
    expect(i.showRewarded).not.toHaveBeenCalled();
  });

  it("una implementación que cuelga se corta a los 120 s", async () => {
    const i = impl({ showRewarded: vi.fn(() => new Promise<boolean>(() => {})), showInterstitial: vi.fn(() => new Promise<void>(() => {})) });
    const ads = createAds({ impl: i, now, enabled: true });
    const p = ads.rewarded(game());
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(p).resolves.toBe(false);
    clock += 200_000;
    const q = ads.interstitial(game());
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(q).resolves.toBeUndefined();
  });

  it("si la implementación lanza, rewarded=false e interstitial resuelve", async () => {
    const i = impl({ showRewarded: vi.fn(async () => { throw new Error("no fill"); }), showInterstitial: vi.fn(async () => { throw new Error("no fill"); }) });
    const ads = createAds({ impl: i, now, enabled: true });
    expect(await ads.rewarded(game())).toBe(false);
    await expect(ads.interstitial(game())).resolves.toBeUndefined();
  });

  it("si init falla, degrada a sin anuncios y no reintenta init", async () => {
    const i = impl({ init: vi.fn(async () => { throw new Error("consent"); }) });
    const ads = createAds({ impl: i, now, enabled: true });
    expect(await ads.rewarded(game())).toBe(false);
    clock += 200_000;
    await ads.interstitial(game());
    expect(i.init).toHaveBeenCalledTimes(1);
    expect(i.showInterstitial).not.toHaveBeenCalled();
  });
});
