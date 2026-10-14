import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { attachGameHost, type HostHandle } from "../bridge/host";
import { GameIcon } from "../components/GameIcon";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { Switch } from "../components/Switch";
import { t } from "../i18n/es";
import { isDark } from "../lib/color";
import { takeLaunchRect } from "../lib/launch";
import { gameVars, resolvePalette } from "../lib/theme";
import { back, navigate } from "../router";
import { useServices } from "../services";
import { BoardView } from "./Ranking";

const LOAD_TIMEOUT_MS = 12_000;

export function Play({ id }: { id: string }) {
  const svc = useServices();
  const game = svc.catalog.find((g) => g.manifest.id === id);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HostHandle | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState(false);
  const [leaderboard, setLeaderboard] = useState<string | null>(null);

  useEffect(() => {
    if (!game) navigate({ name: "home" }, { replace: true });
  }, [game]);

  // Crecimiento del color desde la pieza tocada (única animación espontánea de la app).
  useLayoutEffect(() => {
    const rect = takeLaunchRect();
    const cover = coverRef.current;
    if (!rect || !cover || matchMedia("(prefers-reduced-motion: reduce)").matches || !cover.animate) return;
    const right = window.innerWidth - rect.left - rect.width;
    const bottom = window.innerHeight - rect.top - rect.height;
    cover.animate(
      [
        { clipPath: `inset(${rect.top}px ${right}px ${bottom}px ${rect.left}px round 28px)` },
        { clipPath: "inset(0px 0px 0px 0px round 0px)" },
      ],
      { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  }, []);

  useLayoutEffect(() => {
    const iframe = iframeRef.current;
    if (!game || !iframe) return;
    const m = game.manifest;
    const handle = attachGameHost({
      iframe,
      manifest: m,
      sync: svc.sync,
      ads: svc.ads,
      native: svc.native,
      store: svc.store,
      settings: () => svc.store.settings.value,
      onExit: () => back(),
      onLeaderboard: (board) => setLeaderboard(board ?? ""),
    });
    handleRef.current = handle;
    void svc.native.lockOrientation(m.orientation);
    const palette = resolvePalette(m);
    void svc.native.setStatusBar(isDark(palette.background) ? "dark" : "light", palette.background);
    const offBack = svc.native.onBackButton(() => setMenu((open) => !open));
    const timer = setTimeout(() => setFailed(true), LOAD_TIMEOUT_MS);
    iframe.addEventListener("load", () => clearTimeout(timer), { once: true });
    return () => {
      clearTimeout(timer);
      handle.dispose();
      handleRef.current = null;
      offBack();
      void svc.native.unlockOrientation();
      void svc.native.setStatusBar(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", "#e9ecf1");
      void svc.sync.flush();
    };
  }, [id, attempt]);

  // El juego se pausa mientras el menú o el ranking están abiertos.
  const overlay = menu || leaderboard !== null;
  useEffect(() => {
    if (!overlay) return;
    handleRef.current?.pause();
    return () => handleRef.current?.resume();
  }, [overlay]);

  if (!game) return null;
  const m = game.manifest;
  const settings = svc.store.settings.value;
  const setSetting = (patch: Partial<typeof settings>) => {
    svc.store.settings.value = { ...settings, ...patch };
    handleRef.current?.notifySettings();
  };

  return (
    <div class="play" style={gameVars(m)} data-testid="play">
      <header class="playbar">
        <button type="button" class="iconbtn" aria-label={t("play.back")} onClick={() => back()} data-testid="play-back">
          <Icon name="back" />
        </button>
        <span class="playbar__title">{m.name}</span>
        {m.boards.length > 0 && (
          <button type="button" class="iconbtn" aria-label={t("play.ranking")} onClick={() => setLeaderboard("")} data-testid="play-ranking">
            <Icon name="trophy" />
          </button>
        )}
        <button type="button" class="iconbtn" aria-label={t("play.menu")} onClick={() => setMenu(true)} data-testid="play-menu">
          <Icon name="dots" />
        </button>
      </header>

      <iframe
        key={attempt} ref={iframeRef} class="play__frame" title={m.name} src={game.entryUrl}
        allow="autoplay; fullscreen" onLoad={() => setLoaded(true)} data-testid="game-frame"
      />

      <div ref={coverRef} class={`play__cover${loaded ? " is-done" : ""}`} aria-hidden={loaded} data-testid="cover">
        <div class="cover">
          <GameIcon game={game} class="cover__icon" />
          <div class="cover__name">{failed ? t("play.loadError") : t("play.loading", { name: m.name })}</div>
          {failed && (
            <button type="button" class="btn" onClick={() => { setFailed(false); setLoaded(false); setAttempt((a) => a + 1); }}>
              {t("common.retry")}
            </button>
          )}
        </div>
      </div>

      {menu && (
        <Sheet title={m.name} onClose={() => setMenu(false)}>
          <div class="row"><span>{t("play.sound")}</span><Switch label={t("play.sound")} checked={settings.sound} onChange={(v) => setSetting({ sound: v })} /></div>
          <div class="row"><span>{t("play.haptics")}</span><Switch label={t("play.haptics")} checked={settings.haptics} onChange={(v) => setSetting({ haptics: v })} /></div>
          <div class="sheet__actions">
            <button type="button" class="btn btn--block" onClick={() => setMenu(false)}>{t("play.resume")}</button>
            {m.boards.length > 0 && (
              <button type="button" class="btn btn--ghost btn--block" onClick={() => { setMenu(false); setLeaderboard(""); }}>{t("play.ranking")}</button>
            )}
            <button type="button" class="btn btn--ghost btn--block" data-testid="menu-exit" onClick={() => back()}>{t("play.exit")}</button>
          </div>
        </Sheet>
      )}

      {leaderboard !== null && (
        <Sheet title={t("play.ranking")} onClose={() => setLeaderboard(null)}>
          <BoardView game={game} initialBoard={leaderboard || undefined} />
        </Sheet>
      )}
    </div>
  );
}
