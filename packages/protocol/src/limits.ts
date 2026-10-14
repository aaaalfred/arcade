/** Tamaño máximo del estado de un juego serializado como JSON (UTF-8). */
export const MAX_SAVE_BYTES = 64 * 1024;
export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 16;
/** Hueco mínimo entre dos anuncios intersticiales; lo impone el shell, no el juego. */
export const MIN_INTERSTITIAL_GAP_MS = 90_000;
export const BRIDGE_VERSION = 1 as const;
