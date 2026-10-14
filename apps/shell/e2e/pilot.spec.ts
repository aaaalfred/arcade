import { expect, test, type Frame, type Page } from "@playwright/test";
import { creds, goTab, openGame, serverBoard } from "./helpers";

/** Frame del iframe del juego (para ejecutar código dentro del juego). */
async function gameContext(page: Page): Promise<Frame> {
  const handle = await page.locator('[data-testid="game-frame"]').elementHandle();
  const frame = await handle!.contentFrame();
  if (!frame) throw new Error("el iframe del juego no tiene contentFrame");
  await frame.waitForSelector("#grid button");
  return frame;
}

/** Resuelve el nivel tocando cada flecha libre, igual que haría una persona. */
async function solveLevel(page: Page, frame: Frame, levelIndex: number) {
  const lv = await frame.evaluate((i) => (window as any).LEVELS_DATA[i], levelIndex);
  const alive: boolean[] = lv.arrows.map(() => true);
  const canvas = page.frameLocator('[data-testid="game-frame"]').locator("canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const cell = box.width / (lv.w + 2); // el lienzo mide (w+2)·celda: margen de una celda por lado

  for (let step = 0; step < lv.arrows.length; step++) {
    const free: number[] = await frame.evaluate(([l, a]) => (window as any).Logic.freeArrows(l, a), [lv, alive] as const);
    expect(free.length, "siempre debe haber una flecha libre").toBeGreaterThan(0);
    const idx = free[0]!;
    const [r, c] = lv.arrows[idx][lv.arrows[idx].length - 1]; // la cabeza
    await page.mouse.click(box.x + cell + (c + 0.5) * cell, box.y + cell + (r + 0.5) * cell);
    alive[idx] = false;
  }
}

test("Flechas: se juega el nivel 1, el progreso y el ranking se guardan y sobreviven a recargar", async ({ page, request }) => {
  await openGame(page, "flechas");
  const frame = await gameContext(page);

  // Nivel 2 empieza bloqueado
  await expect(frame.locator("#grid button").nth(1)).toBeDisabled();

  await frame.locator("#grid button").first().click();
  await solveLevel(page, frame, 0);

  await expect(frame.locator("#ovTitle")).toHaveText("¡Nivel completo!");
  await expect(frame.locator("#ovInfo")).toHaveText("¡Sin errores!");
  await expect(frame.locator("#ovStars")).toHaveText("★★★");

  // Menú de niveles: el 2 queda desbloqueado
  await frame.locator("#bMenu").click();
  await expect(frame.locator("#grid button").nth(1)).toBeEnabled();

  // En la app: la pieza muestra 1 de 10 niveles y el ranking tiene mis 3 estrellas
  await page.getByTestId("play-back").click();
  await expect(page.getByTestId("tile-flechas")).toContainText("1 de 10 niveles");
  await goTab(page, "Ranking");
  await expect(page.locator('[data-testid="board"] li[data-me="1"]')).toContainText("3");
  const c = await creds(page);
  expect((await serverBoard(request, c, "flechas", "stars")).me?.value).toBe(3);

  // Recargar y volver a abrir: el nivel 2 sigue desbloqueado (estado restaurado por el puente)
  await page.reload();
  await page.getByRole("navigation").getByRole("button", { name: "Juegos" }).click();
  await page.getByTestId("tile-flechas").click();
  const again = await gameContext(page);
  await expect(again.locator("#grid button").nth(1)).toBeEnabled();
  await expect(again.locator("#grid button").first()).toContainText("★★★");
});

test("Flechas: un error cuesta una estrella y se refleja en el puntaje", async ({ page, request }) => {
  await openGame(page, "flechas");
  const frame = await gameContext(page);
  await frame.locator("#grid button").first().click();

  const lv = await frame.evaluate(() => (window as any).LEVELS_DATA[0]);
  const alive: boolean[] = lv.arrows.map(() => true);
  const canvas = page.frameLocator('[data-testid="game-frame"]').locator("canvas");
  const box = (await canvas.boundingBox())!;
  const cell = box.width / (lv.w + 2);
  const tap = (idx: number) => {
    const [r, c] = lv.arrows[idx][lv.arrows[idx].length - 1];
    return page.mouse.click(box.x + cell + (c + 0.5) * cell, box.y + cell + (r + 0.5) * cell);
  };

  // Tocar una flecha bloqueada primero (si existe) provoca un error
  const free: number[] = await frame.evaluate(([l, a]) => (window as any).Logic.freeArrows(l, a), [lv, alive] as const);
  const blocked = lv.arrows.map((_: unknown, i: number) => i).find((i: number) => !free.includes(i));
  expect(blocked, "el nivel 1 debe tener alguna flecha bloqueada").toBeDefined();
  await tap(blocked);

  for (let step = 0; step < lv.arrows.length; step++) {
    const f: number[] = await frame.evaluate(([l, a]) => (window as any).Logic.freeArrows(l, a), [lv, alive] as const);
    const idx = f[0]!;
    await tap(idx);
    alive[idx] = false;
  }
  await expect(frame.locator("#ovTitle")).toHaveText("¡Nivel completo!");
  await expect(frame.locator("#ovStars")).toHaveText("★★☆");

  await page.getByTestId("play-back").click();
  await goTab(page, "Ranking");
  await expect(page.locator('[data-testid="board"] li[data-me="1"]')).toContainText("2");
  const c = await creds(page);
  expect((await serverBoard(request, c, "flechas", "stars")).me?.value).toBe(2);
});
