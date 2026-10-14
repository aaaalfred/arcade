import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Error previsto de la API: se serializa como `{ error, message, ...extra }`. Nunca lleva trazas. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = () =>
  new ApiError(401, "unauthorized", "Falta la credencial de acceso o no es válida.");
export const invalidBody = (message = "El cuerpo de la petición no es válido.") =>
  new ApiError(400, "invalid_body", message);
export const gameNotFound = () => new ApiError(404, "game_not_found", "Ese juego no existe.");
export const playerNotFound = () => new ApiError(404, "player_not_found", "Ese jugador no existe.");
export const rateLimited = (retryAfterSec: number, message: string) =>
  new ApiError(429, "rate_limited", message, {}, { "Retry-After": String(retryAfterSec) });
