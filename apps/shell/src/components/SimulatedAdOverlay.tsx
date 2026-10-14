import { useEffect, useState } from "preact/hooks";
import { simulatedAd } from "../services/ads";
import { t } from "../i18n/es";

const WAIT_MS = Number(import.meta.env.VITE_SIM_AD_MS ?? 1500);

/** Anuncio de prueba para web y desarrollo (en nativo se usa AdMob). */
export function SimulatedAdOverlay() {
  const ad = simulatedAd.value;
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!ad) return;
    const end = Date.now() + WAIT_MS;
    setLeft(Math.ceil(WAIT_MS / 1000));
    const id = setInterval(() => {
      const rest = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(rest);
      if (rest === 0) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [ad]);

  if (!ad) return null;
  const ready = left === 0;
  return (
    <div class="simad" role="dialog" aria-modal="true" aria-label={t("ad.title")} data-testid="sim-ad">
      <div class="simad__card">
        <h2>{t("ad.title")}</h2>
        {!ready && <p class="num">{t("ad.wait", { s: left })}</p>}
        {ready && (
          <button type="button" class="btn btn--block" data-testid="sim-ad-close" onClick={() => ad.finish(true)}>
            {ad.kind === "rewarded" ? t("ad.claim") : t("ad.close")}
          </button>
        )}
        {ad.kind === "rewarded" && (
          <button type="button" class="btn btn--ghost btn--block" data-testid="sim-ad-skip" onClick={() => ad.finish(false)}>
            {t("ad.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
