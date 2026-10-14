import { expect, test } from "@playwright/test";
import { creds, gameFrame, openPlayground, serverBoard } from "./helpers";

test("sin red se puede jugar y puntuar; al volver la red el puntaje llega al servidor", async ({ page, context, request }) => {
  await openPlayground(page);
  const c = await creds(page);

  await context.setOffline(true);
  const game = gameFrame(page);
  await game.locator("#btn-tap").click();
  await game.locator("#score-value").fill("7");
  await game.locator("#btn-score-custom").click();
  await expect(game.locator("#log")).toContainText('"offline":true');
  await expect(game.locator("#taps")).toHaveText("1");

  // El servidor aún no lo ve
  expect((await serverBoard(request, c, "sdk-playground", "taps")).me).toBeNull();

  await context.setOffline(false);
  await expect
    .poll(async () => (await serverBoard(request, c, "sdk-playground", "taps")).me?.value ?? null, { timeout: 20_000 })
    .toBe(7);
});

test("un puntaje peor no reemplaza al mejor y un valor fuera de rango se descarta", async ({ page, request }) => {
  await openPlayground(page);
  const game = gameFrame(page);
  await game.locator("#score-value").fill("50");
  await game.locator("#btn-score-custom").click();
  await expect(game.locator("#log")).toContainText('"best":50');
  await game.locator("#score-value").fill("20");
  await game.locator("#btn-score-custom").click();
  await expect(game.locator("#log")).toContainText('"accepted":false');

  // 'fastest' es asc con rango [1,600]: 601 es inválido
  await game.locator("#score-value").fill("601");
  await game.locator("#btn-score-fastest").click();
  await expect(game.locator("#log")).toContainText('"accepted":false');

  const c = await creds(page);
  expect((await serverBoard(request, c, "sdk-playground", "fastest")).me).toBeNull();
  expect((await serverBoard(request, c, "sdk-playground", "taps")).me?.value).toBe(50);
});
