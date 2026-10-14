import type { CatalogGame } from "../services/catalog";

const IMAGE = /\.(png|jpe?g|webp|svg)$/i;

/** Icono del juego: emoji o ruta de imagen relativa a la carpeta del juego. */
export function GameIcon({ game, class: cls }: { game: CatalogGame; class?: string }) {
  const icon = game.manifest.icon;
  if (IMAGE.test(icon)) return <img class={cls} src={game.baseUrl + icon} alt="" aria-hidden="true" draggable={false} />;
  return <span class={cls} aria-hidden="true">{icon}</span>;
}
