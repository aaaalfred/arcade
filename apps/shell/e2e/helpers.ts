import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const API = "http://localhost:8787";

export interface Creds {
  playerId: string;
  secret: string;
}

export const gameFrame = (page: Page) => page.frameLocator('[data-testid="game-frame"]');

/** Abre un juego desde Home y espera a que el SDK complete el handshake en modo host. */
export async function openGame(page: Page, id: string) {
  await page.goto("/");
  await page.getByTestId(`tile-${id}`).click();
  await expect(page.getByTestId("game-frame")).toBeVisible();
}

export async function openPlayground(page: Page) {
  await openGame(page, "sdk-playground");
  await expect(gameFrame(page).locator("#mode")).toHaveText("(host)");
}

export async function creds(page: Page): Promise<Creds> {
  await expect.poll(() => page.evaluate(() => localStorage.getItem("arcade:creds"))).not.toBeNull();
  return JSON.parse((await page.evaluate(() => localStorage.getItem("arcade:creds")))!) as Creds;
}

export const bearer = (c: Creds) => ({ Authorization: `Bearer ${c.playerId}.${c.secret}` });

export async function serverBoard(request: APIRequestContext, c: Creds, game: string, board: string, period = "all") {
  const r = await request.get(`${API}/v1/games/${game}/boards/${board}?period=${period}`, { headers: bearer(c) });
  expect(r.ok()).toBe(true);
  return (await r.json()) as { entries: Array<{ nickname: string; value: number; isMe: boolean }>; me: { rank: number; value: number } | null };
}

export async function goTab(page: Page, label: "Juegos" | "Ranking" | "Perfil") {
  await page.getByRole("navigation").getByRole("button", { name: label }).click();
}
