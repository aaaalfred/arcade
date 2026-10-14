import { expect, test } from "@playwright/test";
import { gameFrame, openPlayground } from "./helpers";

test("anuncios: el juego se pausa, el hueco de 90 s lo impone el shell y la recompensa depende del jugador", async ({ page }) => {
  await openPlayground(page);
  const game = gameFrame(page);

  // Recompensa: se completa
  await game.locator("#btn-ad-rew").click();
  await expect(page.getByTestId("sim-ad")).toBeVisible();
  await expect(game.locator("#log")).toContainText("evento: pause");
  await page.getByTestId("sim-ad-close").click();
  await expect(game.locator("#log")).toContainText("recompensa: true");
  await expect(game.locator("#log")).toContainText("evento: resume");

  // Recompensa: se salta
  await game.locator("#btn-ad-rew").click();
  await page.getByTestId("sim-ad-skip").click();
  await expect(game.locator("#log")).toContainText("recompensa: false");

  // Intersticial justo después de otro anuncio: dentro del hueco de 90 s ⇒ no se muestra, pero el juego continúa
  await game.locator("#btn-ad-int").click();
  await expect(game.locator("#log")).toContainText("intersticial listo");
  await expect(page.getByTestId("sim-ad")).toHaveCount(0);
});

test("el intersticial se muestra cuando no hay anuncios recientes", async ({ page }) => {
  await openPlayground(page);
  const game = gameFrame(page);
  await game.locator("#btn-ad-int").click();
  await expect(page.getByTestId("sim-ad")).toBeVisible();
  await page.getByTestId("sim-ad-close").click();
  await expect(game.locator("#log")).toContainText("intersticial listo");
});
