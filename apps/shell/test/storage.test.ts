import { beforeEach, describe, expect, it, vi } from "vitest";
import { createKV } from "../src/services/storage";

beforeEach(() => localStorage.clear());

describe("createKV (web)", () => {
  it("get/set/remove sobre localStorage con prefijo", async () => {
    const kv = createKV();
    expect(await kv.get("a")).toBeNull();
    await kv.set("a", "1");
    expect(await kv.get("a")).toBe("1");
    expect(localStorage.getItem("arcade:a")).toBe("1");
    await kv.remove("a");
    expect(await kv.get("a")).toBeNull();
  });

  it("keys() devuelve solo las claves propias con un prefijo dado", async () => {
    const kv = createKV();
    localStorage.setItem("otro", "x");
    await kv.set("outbox:save:a", "1");
    await kv.set("outbox:score:a:s", "2");
    await kv.set("player", "3");
    expect((await kv.keys("outbox:")).sort()).toEqual(["outbox:save:a", "outbox:score:a:s"]);
    expect((await kv.keys("")).sort()).toEqual(["outbox:save:a", "outbox:score:a:s", "player"]);
  });

  it("si localStorage lanza, no rompe y usa memoria", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    const kv = createKV();
    await expect(kv.set("x", "1")).resolves.toBeUndefined();
    expect(await kv.get("x")).toBe("1");
    spy.mockRestore();
  });
});
