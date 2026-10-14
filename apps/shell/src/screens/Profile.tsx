import { useState } from "preact/hooks";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { GameIcon } from "../components/GameIcon";
import { Sheet } from "../components/Sheet";
import { Switch } from "../components/Switch";
import { Ticks } from "../components/Ticks";
import { toast } from "../components/Toast";
import { hasString, t } from "../i18n/es";
import { formatValue } from "../lib/format";
import { navigate } from "../router";
import { useServices } from "../services";
import { ApiError } from "../services/api";
import { gameStatus } from "./Home";

const PRIVACY_URL: string = import.meta.env.VITE_PRIVACY_URL ?? "";

function nickError(e: unknown): string {
  if (e instanceof ApiError) {
    const key = `nick.${e.code}`;
    if (hasString(key)) return t(key);
  }
  return t("nick.other");
}

export function Profile() {
  const svc = useServices();
  const { store, catalog } = svc;
  const player = store.player.value;
  const settings = store.settings.value;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveNick = async (ev: Event) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await svc.auth.setNickname(draft);
      setEditing(false);
      toast(t("profile.nicknameSaved"));
    } catch (e) {
      setError(nickError(e));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await svc.auth.deleteAccount();
      await svc.sync.wipe();
      setConfirmDelete(false);
      navigate({ name: "home" });
      toast(t("profile.deleted"));
    } catch (e) {
      setConfirmDelete(false);
      toast(e instanceof ApiError && e.code === "network" ? t("profile.deleteOffline") : t("profile.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openPrivacy = () => {
    if (!PRIVACY_URL) return;
    if (Capacitor.isNativePlatform()) void Browser.open({ url: PRIVACY_URL });
    else window.open(PRIVACY_URL, "_blank", "noopener");
  };

  return (
    <main class="screen screen--tabs">
      <header class="page-head"><h1>{t("profile.title")}</h1></header>

      <section class="section">
        <p class="muted small">{t("profile.nickname")}</p>
        {player ? <p class="nick" data-testid="nickname">{player.nickname}</p> : <p class="muted">{t("profile.noPlayer")}</p>}
        {player && !editing && (
          <button type="button" class="btn btn--ghost" style={{ marginTop: 12 }} data-testid="nick-change" onClick={() => { setDraft(player.nickname); setError(null); setEditing(true); }}>
            {t("profile.change")}
          </button>
        )}
        {player && editing && (
          <form class="nick-edit" onSubmit={saveNick}>
            <input
              class="input" value={draft} maxLength={24} autoFocus autoCapitalize="words" autoComplete="off"
              aria-label={t("profile.nickname")} data-testid="nick-input" onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            />
            {error && <p class="field-error" role="alert" data-testid="nick-error">{error}</p>}
            <div class="actions">
              <button type="submit" class="btn" disabled={busy} data-testid="nick-save">{t("profile.save")}</button>
              <button type="button" class="btn btn--ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</button>
            </div>
          </form>
        )}
      </section>

      <section class="section">
        <h2>{t("profile.progress")}</h2>
        {catalog.map((g) => {
          const m = g.manifest;
          const s = gameStatus(m, store.progress.value[m.id]);
          return (
            <div class="progress-row" key={m.id} style={{ "--g-accent": m.theme.accent }}>
              <div class="progress-row__head">
                <span class="progress-row__name"><GameIcon game={g} class="progress-row__icon" />{m.name}</span>
                <span class="num muted">{s.done}/{s.total} {m.progress.unit}</span>
              </div>
              <Ticks done={s.done} total={s.total} />
              {m.boards.map((b) => {
                const best = store.bests.value[`${m.id}:${b.id}`];
                return best === undefined ? null : (
                  <p class="muted small num" key={b.id} style={{ marginTop: 8 }}>{b.name}: {formatValue(best, b.unit)}</p>
                );
              })}
            </div>
          );
        })}
      </section>

      <section class="section">
        <h2>{t("profile.settings")}</h2>
        <div class="row"><span>{t("play.sound")}</span><Switch label={t("play.sound")} checked={settings.sound} onChange={(v) => (store.settings.value = { ...settings, sound: v })} /></div>
        <div class="row"><span>{t("play.haptics")}</span><Switch label={t("play.haptics")} checked={settings.haptics} onChange={(v) => (store.settings.value = { ...settings, haptics: v })} /></div>
      </section>

      <section class="danger-zone">
        {PRIVACY_URL && <button type="button" class="btn btn--text" onClick={openPrivacy}>{t("profile.privacy")}</button>}
        <div>
          <button type="button" class="btn btn--text is-danger" data-testid="delete-data" onClick={() => setConfirmDelete(true)}>{t("profile.delete")}</button>
        </div>
      </section>

      {confirmDelete && (
        <Sheet title={t("profile.deleteTitle")} onClose={() => setConfirmDelete(false)}>
          <p class="muted">{t("profile.deleteBody")}</p>
          <div class="sheet__actions">
            <button type="button" class="btn btn--danger btn--block" disabled={busy} data-testid="delete-confirm" onClick={doDelete}>{t("profile.deleteConfirm")}</button>
            <button type="button" class="btn btn--ghost btn--block" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</button>
          </div>
        </Sheet>
      )}
    </main>
  );
}
