import { getCatalog } from "./services/catalog";
import { t } from "./i18n/es";

export function App() {
  return (
    <main style={{ padding: "var(--s-5)" }}>
      <h1>{t("app.name")}</h1>
      <ul>
        {getCatalog().map((g) => (
          <li key={g.manifest.id}>{g.manifest.name}</li>
        ))}
      </ul>
    </main>
  );
}
