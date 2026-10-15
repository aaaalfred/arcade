import type { BoardEntry, BoardResponse } from "@arcade/protocol";
import { useEffect, useState } from "preact/hooks";
import { GameIcon } from "../components/GameIcon";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { toast } from "../components/Toast";
import { t } from "../i18n/es";
import { formatValue } from "../lib/format";
import { gameVars } from "../lib/theme";
import { useServices } from "../services";
import type { CatalogGame } from "../services/catalog";
import { ApiError } from "../services/api";

type Period = "all" | "weekly";
type View = { status: "loading" } | { status: "ok"; data: BoardResponse; stale: boolean } | { status: "error"; offline: boolean };

/** Última respuesta por tablero, para mostrar algo útil sin conexión. */
const cache = new Map<string, BoardResponse>();

export function BoardView({ game, initialBoard }: { game: CatalogGame; initialBoard?: string }) {
  const svc = useServices();
  const m = game.manifest;
  const [boardId, setBoardId] = useState(initialBoard && m.boards.some((b) => b.id === initialBoard) ? initialBoard : m.boards[0]?.id);
  const [period, setPeriod] = useState<Period>("all");
  const [view, setView] = useState<View>({ status: "loading" });
  const [tick, setTick] = useState(0);
  const [reporting, setReporting] = useState<BoardEntry | null>(null);
  const board = m.boards.find((b) => b.id === boardId);

  useEffect(() => {
    if (!board) return;
    if (!svc.apiConfigured) {
      setView({ status: "error", offline: false });
      return;
    }
    let cancelled = false;
    const key = `${m.id}:${board.id}:${period}`;
    setView({ status: "loading" });
    (async () => {
      try {
        if (!(await svc.auth.ensure())) throw new ApiError(0, "network");
        const data = await svc.api.getBoard(m.id, board.id, period);
        cache.set(key, data);
        if (!cancelled) setView({ status: "ok", data, stale: false });
      } catch (e) {
        if (cancelled) return;
        const cached = cache.get(key);
        if (cached) setView({ status: "ok", data: cached, stale: true });
        else setView({ status: "error", offline: e instanceof ApiError && e.code === "network" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [m.id, board?.id, period, tick]);

  if (!board) return <p class="empty">{t("ranking.noBoards")}</p>;

  const sendReport = async () => {
    const target = reporting;
    setReporting(null);
    if (!target) return;
    try {
      await svc.api.report(target.playerId, "nickname");
      toast(t("ranking.reported"));
    } catch {
      toast(t("ranking.reportFailed"));
    }
  };

  return (
    <div style={gameVars(m)}>
      <div class="controls">
        {m.boards.length > 1 && (
          <div class="seg" role="group" aria-label="Tablero">
            {m.boards.map((b) => (
              <button key={b.id} type="button" aria-pressed={b.id === boardId} onClick={() => setBoardId(b.id)}>{b.name}</button>
            ))}
          </div>
        )}
        <div class="seg" role="group" aria-label="Periodo">
          <button type="button" aria-pressed={period === "all"} onClick={() => setPeriod("all")} data-testid="period-all">{t("ranking.global")}</button>
          <button type="button" aria-pressed={period === "weekly"} onClick={() => setPeriod("weekly")} data-testid="period-weekly">{t("ranking.weekly")}</button>
        </div>
      </div>

      {view.status === "loading" && (
        <div aria-busy="true" data-testid="board-loading">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} class="skeleton" />)}
        </div>
      )}

      {view.status === "error" && (
        <div>
          <p class="empty">{!svc.apiConfigured ? t("ranking.unavailable") : view.offline ? t("common.offline") : t("ranking.error")}</p>
          {svc.apiConfigured && <button type="button" class="btn btn--ghost" onClick={() => setTick((n) => n + 1)}>{t("common.retry")}</button>}
        </div>
      )}

      {view.status === "ok" && (
        <>
          {view.stale && <p class="notice" role="status">{t("ranking.offline")}</p>}
          {view.data.entries.length === 0 ? (
            <p class="empty" data-testid="board-empty">{t("ranking.empty")}</p>
          ) : (
            <ol class="board" data-testid="board">
              {view.data.entries.map((e, i) => (
                <li key={e.playerId} class={e.isMe ? "is-me" : ""} data-me={e.isMe ? "1" : undefined} style={{ "--i": Math.min(i, 10) }}>
                  <span class="board__rank num">{e.rank}</span>
                  <span class="board__name">{e.isMe ? `${e.nickname} · ${t("ranking.you")}` : e.nickname}</span>
                  <span class="board__value num">{formatValue(e.value, board.unit)}</span>
                  {e.isMe ? <span /> : (
                    <button type="button" class="board__more" aria-label={t("ranking.report")} onClick={() => setReporting(e)}>
                      <Icon name="flag" />
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {view.data.me && !view.data.entries.some((e) => e.isMe) && (
            <div class="mepin" data-testid="me-pin">
              <span>{t("ranking.myPosition")} · <span class="num">{view.data.me.rank}</span></span>
              <span class="num">{formatValue(view.data.me.value, board.unit)}</span>
            </div>
          )}
          {!view.data.me && view.data.entries.length > 0 && <p class="muted small" style={{ marginTop: 16 }}>{t("ranking.noScore")}</p>}
        </>
      )}

      {reporting && (
        <Sheet title={t("ranking.reportTitle", { name: reporting.nickname })} onClose={() => setReporting(null)}>
          <p class="muted">{t("ranking.reportBody")}</p>
          <div class="sheet__actions">
            <button type="button" class="btn btn--block" onClick={sendReport}>{t("ranking.reportSend")}</button>
            <button type="button" class="btn btn--ghost btn--block" onClick={() => setReporting(null)}>{t("common.cancel")}</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

export function Ranking({ gameId }: { gameId?: string }) {
  const { catalog, store } = useServices();
  const initial = gameId ?? store.lastGame.value ?? catalog[0]?.manifest.id;
  const [selected, setSelected] = useState(initial);
  const game = catalog.find((g) => g.manifest.id === selected) ?? catalog[0];

  return (
    <main class="screen screen--tabs">
      <header class="page-head"><h1>{t("ranking.title")}</h1></header>
      {!game ? (
        <p class="empty">{t("ranking.noGames")}</p>
      ) : (
        <>
          <div class="gchips">
            {catalog.map((g) => (
              <button
                key={g.manifest.id} type="button" class="gchip" style={gameVars(g.manifest)}
                aria-pressed={g.manifest.id === game.manifest.id} onClick={() => setSelected(g.manifest.id)}
                data-testid={`gchip-${g.manifest.id}`}
              >
                <GameIcon game={g} class="gchip__icon" />{g.manifest.name}
              </button>
            ))}
          </div>
          <BoardView key={game.manifest.id} game={game} />
        </>
      )}
    </main>
  );
}
