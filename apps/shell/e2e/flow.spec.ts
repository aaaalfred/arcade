import { expect, test } from "@playwright/test";
import { API, bearer, creds, gameFrame, goTab, openPlayground, serverBoard } from "./helpers";

test("primer arranque: cuenta anónima, guardado que sobrevive a recargar y ranking", async ({ page, request }) => {
  await openPlayground(page);
  const game = gameFrame(page);

  // La Session que recibe el juego trae al jugador recién creado
  await expect(game.locator("#session")).toContainText('"nickname": "Jugador');

  // Estado: tres toques → recargar → el juego recupera el estado por el puente
  for (let i = 0; i < 3; i++) await game.locator("#btn-tap").click();
  await expect(game.locator("#taps")).toHaveText("3");
  await page.reload();
  await expect(gameFrame(page).locator("#mode")).toHaveText("(host)");
  await expect(gameFrame(page).locator("#taps")).toHaveText("3");

  // Puntaje → respuesta con posición
  await gameFrame(page).locator("#score-value").fill("42");
  await gameFrame(page).locator("#btn-score-custom").click();
  await expect(gameFrame(page).locator("#log")).toContainText('"accepted":true');
  await expect(gameFrame(page).locator("#log")).toContainText('"all":1');

  // Ranking en la app
  await page.getByTestId("play-back").click();
  await goTab(page, "Ranking");
  const me = page.locator('[data-testid="board"] li[data-me="1"]');
  await expect(me).toContainText("42");
  await expect(me).toContainText("Tú");

  // El servidor lo confirma
  const c = await creds(page);
  const board = await serverBoard(request, c, "sdk-playground", "taps");
  expect(board.entries.find((e) => e.isMe)?.value).toBe(42);
  expect((await request.get(`${API}/v1/me`, { headers: bearer(c) })).ok()).toBe(true);
});

test("cambiar el apodo se refleja en el ranking y los errores se explican", async ({ page }) => {
  await openPlayground(page);
  await gameFrame(page).locator("#score-value").fill("10");
  await gameFrame(page).locator("#btn-score-custom").click();
  await expect(gameFrame(page).locator("#log")).toContainText('"accepted":true');
  await page.getByTestId("play-back").click();

  await goTab(page, "Perfil");
  await page.getByTestId("nick-change").click();
  await page.getByTestId("nick-input").fill("ab");
  await page.getByTestId("nick-save").click();
  await expect(page.getByTestId("nick-error")).toHaveText("Usa al menos 3 caracteres.");

  await page.getByTestId("nick-input").fill("Ángel Prueba");
  await page.getByTestId("nick-save").click();
  await expect(page.getByTestId("nickname")).toHaveText("Ángel Prueba");

  await goTab(page, "Ranking");
  await expect(page.locator('[data-testid="board"] li[data-me="1"]')).toContainText("Ángel Prueba");
  await page.getByTestId("period-weekly").click();
  await expect(page.locator('[data-testid="board"] li[data-me="1"]')).toContainText("10");
});

test("el progreso del juego aparece en Home y se sube al servidor", async ({ page, request }) => {
  await openPlayground(page);
  for (let i = 0; i < 10; i++) await gameFrame(page).locator("#btn-tap").click();
  await expect(gameFrame(page).locator("#taps")).toHaveText("10");
  await page.getByTestId("play-back").click();
  await expect(page.getByTestId("tile-sdk-playground")).toContainText("1 de 10 pasos");

  const c = await creds(page);
  await expect
    .poll(async () => {
      const r = await request.get(`${API}/v1/saves`, { headers: bearer(c) });
      const saves = (await r.json()) as Array<{ gameId: string; state: { taps: number } }>;
      return saves.find((s) => s.gameId === "sdk-playground")?.state.taps ?? null;
    }, { timeout: 15_000 })
    .toBe(10);
});
