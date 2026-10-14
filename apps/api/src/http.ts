import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import type { z } from "zod";
import type { Config } from "./config";
import { ApiError, invalidBody } from "./errors";

/** Tamaño máximo del cuerpo de cualquier petición (el guardado más grande son 64 KB de estado + sobre). */
export const MAX_BODY_BYTES = 128 * 1024;

const TOO_LARGE = Symbol("too-large");

/** Lee el cuerpo como texto UTF-8 sin pasar de `maxBytes` (corta la lectura al superarlo). */
async function readBodyText(req: Request, maxBytes: number): Promise<string | typeof TOO_LARGE> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return TOO_LARGE;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return TOO_LARGE;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
}

export interface ReadJsonOptions {
  /** Error si el cuerpo supera MAX_BODY_BYTES. Por defecto `invalid_body` (400); los guardados usan 413. */
  tooLarge?: () => ApiError;
}

/** Lee y parsea el cuerpo JSON. JSON inválido, UTF-8 inválido o cuerpo vacío ⇒ 400 invalid_body. */
export async function readJson(c: Context, opts: ReadJsonOptions = {}): Promise<unknown> {
  let text: string | typeof TOO_LARGE;
  try {
    text = await readBodyText(c.req.raw, MAX_BODY_BYTES);
  } catch {
    throw invalidBody("El cuerpo no es texto UTF-8 válido.");
  }
  if (text === TOO_LARGE) {
    throw (opts.tooLarge ?? (() => invalidBody("El cuerpo de la petición es demasiado grande.")))();
  }
  if (text.trim() === "") throw invalidBody("Falta el cuerpo JSON de la petición.");
  try {
    return JSON.parse(text);
  } catch {
    throw invalidBody("El cuerpo no es JSON válido.");
  }
}

/** Valida con zod; ante un fallo devuelve 400 invalid_body con el detalle de los campos. */
export function parseWith<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const detail = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(cuerpo)"}: ${i.message}`)
      .join("; ");
    throw invalidBody(`El cuerpo de la petición no es válido (${detail}).`);
  }
  return r.data;
}

/**
 * IP del cliente para los límites por IP. Con TRUST_PROXY=1 se confía en el primer valor de `x-forwarded-for`
 * (el proxy inverso debe sobrescribir esa cabecera); si no, se usa la IP de la conexión.
 * Sin conexión (tests con `app.request`) devuelve 'unknown'.
 */
export function clientIp(c: Context, config: Pick<Config, "trustProxy">): string {
  if (config.trustProxy) {
    const first = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
