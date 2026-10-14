import { expect, test } from "@playwright/test";
import { API, bearer, creds, gameFrame, goTab, openPlayground } from "./helpers";

test("borrar mis datos elimina cuenta, ranking y datos locales", async ({ page, request }) => {
  await openPlayground(page);
  await gameFrame(page).locator("#score-value").fill("33");
  await gameFrame(page).locator("#btn-score-custom").click();
  await expect(gameFrame(page).locator("#log")).toContainText('"accepted":true');
  const c = await creds(page);
  await page.getByTestId("play-back").click();

  await goTab(page, "Perfil");
  await page.getByTestId("delete-data").click();
  await page.getByTestId("delete-confirm").click();

  await expect(page.getByTestId("tile-sdk-playground")).toBeVisible();
  expect((await request.get(`${API}/v1/me`, { headers: bearer(c) })).status()).toBe(401);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("arcade:") && k !== "arcade:settings"))).toEqual([]);
  await expect(page.getByTestId("tile-sdk-playground")).toContainText("Nuevo");
});
