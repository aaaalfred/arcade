import type { Manifest, SaveProgress } from "@arcade/protocol";
import { GameIcon } from "../components/GameIcon";
import { Icon } from "../components/Icon";
import { Ticks } from "../components/Ticks";
import { t } from "../i18n/es";
import { setLaunchRect } from "../lib/launch";
import { gameVars } from "../lib/theme";
import { navigate } from "../router";
import { useServices } from "../services";
import type { CatalogGame } from "../services/catalog";

export type GameStatus = { kind: "new" | "progress" | "complete"; done: number; total: number };

export function gameStatus(m: Manifest, p?: SaveProgress): GameStatus {
  const total = m.progress.total;
  const done = Math.max(0, Math.min(p?.value ?? 0, total));
  return { kind: done === 0 ? "new" : done >= total ? "complete" : "progress", done, total };
}

function bestRank(id: string, ranks: Record<string, { all: number | null; weekly: number | null }>): number | null {
  let best: number | null = null;
  for (const [key, r] of Object.entries(ranks)) {
    if (key.startsWith(`${id}:`) && r.all !== null && (best === null || r.all < best)) best = r.all;
  }
  return best;
}

function Tile({ game, hero, index = 0 }: { game: CatalogGame; hero?: boolean; index?: number }) {
  const { store } = useServices();
  const m = game.manifest;
  const status = gameStatus(m, store.progress.value[m.id]);
  const rank = bestRank(m.id, store.ranks.value);

  const open = (e: MouseEvent) => {
    setLaunchRect((e.currentTarget as HTMLElement).getBoundingClientRect());
    store.lastGame.value = m.id;
    navigate({ name: "play", id: m.id });
  };

  const label =
    status.kind === "new" ? t("state.new")
    : status.kind === "complete" ? t("state.complete")
    : t("state.progress", { done: status.done, total: status.total, unit: m.progress.unit });

  return (
    <button type="button" class={`tile${hero ? " tile--hero" : ""}`} style={{ ...gameVars(m), "--i": Math.min(index, 6) }} onClick={open} data-testid={`tile-${m.id}`}>
      <GameIcon game={game} class="tile__icon" />
      <span class="tile__name">{m.name}</span>
      {m.tagline && <span class="tile__tag">{m.tagline}</span>}
      <span class="tile__foot">
        <Ticks done={status.done} total={status.total} />
        <span class="tile__meta">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {status.kind === "complete" && <Icon name="check" size={18} />}
            {label}
          </span>
          {rank !== null && <span class="tile__rank num">{t("tile.rank", { rank })}</span>}
        </span>
        {hero && (
          <span class="tile__cta">
            <Icon name="play" size={20} />
            {status.kind === "new" ? t("home.play") : t("home.continue")}
          </span>
        )}
      </span>
    </button>
  );
}

export function Home() {
  const { catalog, store } = useServices();
  const last = store.lastGame.value;
  const hero = catalog.find((g) => g.manifest.id === last) ?? null;
  const rest = catalog.filter((g) => g !== hero);

  return (
    <main class="screen screen--tabs screen--stagger">
      <header class="page-head">
        <h1>{t("home.title")}</h1>
        {!store.online.value && <span class="chip">{t("common.offline")}</span>}
      </header>
      {catalog.length === 0 && <p class="empty">{t("home.empty")}</p>}
      {hero && <Tile game={hero} hero index={0} />}
      {rest.map((g, i) => (
        <Tile key={g.manifest.id} game={g} index={i + (hero ? 1 : 0)} />
      ))}
    </main>
  );
}
