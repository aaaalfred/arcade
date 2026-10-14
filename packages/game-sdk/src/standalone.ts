import type { ArcadeEnv, Haptic, SaveProgress, ScoreResult, Session } from "./types";

type Sort = "asc" | "desc";

/** Implementación sin shell: mismo contrato sobre localStorage, anuncios simulados y ranking local. */
export function createStandalone(env: ArcadeEnv) {
  const prefix = `arcade:standalone:${env.gameId}:`;
  const storage = env.storage ?? null;
  const read = (k: string): string | null => {
    try { return storage?.getItem(prefix + k) ?? null; } catch { return null; }
  };
  const write = (k: string, v: string) => {
    try { storage?.setItem(prefix + k, v); } catch (e) { console.warn("[Arcade] no se pudo guardar localmente", e); }
  };

  let boardSorts: Promise<Record<string, Sort>> | null = null;
  const fetchJson = env.fetchJson ?? (env.win.fetch ? (u: string) => env.win.fetch!(u).then((r) => r.json()) : undefined);
  function loadSorts(): Promise<Record<string, Sort>> {
    boardSorts ??= (async () => {
      try {
        const m = (await fetchJson?.("manifest.json")) as { boards?: Array<{ id: string; sort: Sort }> } | undefined;
        return Object.fromEntries((m?.boards ?? []).map((b) => [b.id, b.sort]));
      } catch {
        return {};
      }
    })();
    return boardSorts;
  }

  const vibrateMs: Record<Haptic, number | number[]> = {
    light: 10, medium: 20, heavy: 40, success: [15, 40, 15], error: [30, 60, 30],
  };

  return {
    async ready(): Promise<Session> {
      let state: unknown = null;
      const raw = read("state");
      if (raw !== null) {
        try { state = JSON.parse(raw); } catch { state = null; }
      }
      return {
        player: null,
        state,
        settings: { sound: true, haptics: true, locale: "es" },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
        mode: "standalone",
        sdk: 1,
      };
    },
    save(json: string, _progress?: SaveProgress) {
      write("state", json);
    },
    async submitScore(board: string, value: number): Promise<ScoreResult> {
      const sort = (await loadSorts())[board] ?? "desc";
      const prevRaw = read(`score:${board}`);
      const prev = prevRaw === null ? null : Number(prevRaw);
      const better = prev === null || !Number.isFinite(prev) || (sort === "desc" ? value > prev : value < prev);
      if (better) write(`score:${board}`, String(value));
      return { accepted: better, best: better ? value : (prev as number), rank: { all: null, weekly: null }, offline: true };
    },
    interstitial(): Promise<void> {
      console.info("[Arcade] anuncio intersticial (simulado)");
      return Promise.resolve();
    },
    rewarded(): Promise<boolean> {
      console.info("[Arcade] anuncio con recompensa (simulado)");
      return Promise.resolve(true);
    },
    haptic(kind: Haptic) {
      try { env.vibrate?.(vibrateMs[kind]); } catch { /* sin háptica */ }
    },
    exit() {
      console.info("[Arcade] exit() — en la app volvería al catálogo");
    },
    openLeaderboard(board?: string) {
      console.info(`[Arcade] openLeaderboard(${board ?? ""}) — en la app abriría el ranking`);
    },
  };
}
