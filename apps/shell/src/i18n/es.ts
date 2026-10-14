/** Todas las cadenas visibles de la app. Para añadir un idioma, crear otro archivo con las mismas claves. */
export const es = {
  "app.name": "Arcade",
  "tabs.games": "Juegos",
  "tabs.ranking": "Ranking",
  "tabs.profile": "Perfil",
} as const;

export type StringKey = keyof typeof es;

export function t(key: StringKey, vars: Record<string, string | number> = {}): string {
  return es[key].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
