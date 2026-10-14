import { NICKNAME_MAX, NICKNAME_MIN } from "@arcade/protocol";
import { containsBlockedTerm } from "./nickname-blocklist";

export type NicknameError = "nickname_too_short" | "nickname_too_long" | "nickname_invalid_chars" | "nickname_not_allowed";

export const NICKNAME_MESSAGES: Record<NicknameError | "nickname_taken", string> = {
  nickname_too_short: `El apodo debe tener al menos ${NICKNAME_MIN} caracteres.`,
  nickname_too_long: `El apodo no puede superar los ${NICKNAME_MAX} caracteres.`,
  nickname_invalid_chars:
    "El apodo solo puede llevar letras, números, espacios, guion bajo, guion, punto y emoji.",
  nickname_not_allowed: "Ese apodo no está permitido. Elige otro.",
  nickname_taken: "Ese apodo ya está en uso. Elige otro.",
};

/** NFKC, recorte y colapso de espacios. No toca caracteres de control/formato: los rechaza `validateNickname`. */
export function normalizeNickname(raw: string): string {
  return raw.normalize("NFKC").trim().replace(/ {2,}/g, " ");
}

/** Clave de unicidad (`players.nickname_ci`): ÁNGEL, ángel y «Ángel» dan la misma. No pliega diacríticos. */
export function nicknameKey(nickname: string): string {
  return nickname.normalize("NFKC").toLowerCase().normalize("NFKC");
}

const ALLOWED = /^(?:\p{L}|\p{Nd}|\p{M}|[ _.-]|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator})$/u;
const PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
const MODIFIER = /^(?:\p{Emoji_Modifier}|️)$/u;
const MARK = /^\p{M}$/u;
const SUBSTANCE = /^(?:\p{L}|\p{Nd}|\p{Extended_Pictographic}|\p{Regional_Indicator})$/u;
const MAX_CONSECUTIVE_MARKS = 3;
const ZWJ = "‍";

/**
 * Valida un apodo YA normalizado. Longitud en puntos de código. Lista blanca de caracteres: letras Unicode,
 * dígitos, espacio, `_ - .` y emoji. Rechaza controles, formato (ancho cero, bidi), separadores no ASCII,
 * sustitutos sueltos, uso privado y símbolos.
 */
export function validateNickname(n: string): { ok: true } | { ok: false; reason: NicknameError } {
  const chars = Array.from(n);

  let marks = 0;
  let substance = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    if (ch === ZWJ) {
      // Solo dentro de una secuencia de emoji (👨‍👩‍👧): entre dos pictogramas.
      let p = i - 1;
      while (p >= 0 && MODIFIER.test(chars[p]!)) p--;
      const prev = chars[p];
      const next = chars[i + 1];
      if (!prev || !next || !PICTOGRAPHIC.test(prev) || !PICTOGRAPHIC.test(next)) return { ok: false, reason: "nickname_invalid_chars" };
      marks = 0;
      continue;
    }
    if (!ALLOWED.test(ch)) return { ok: false, reason: "nickname_invalid_chars" };
    if (MARK.test(ch)) {
      if (i === 0 || ++marks > MAX_CONSECUTIVE_MARKS) return { ok: false, reason: "nickname_invalid_chars" };
    } else {
      marks = 0;
    }
    if (SUBSTANCE.test(ch)) substance = true;
  }
  if (!substance && chars.length >= NICKNAME_MIN) return { ok: false, reason: "nickname_invalid_chars" };

  if (chars.length < NICKNAME_MIN) return { ok: false, reason: "nickname_too_short" };
  if (chars.length > NICKNAME_MAX) return { ok: false, reason: "nickname_too_long" };
  if (containsBlockedTerm(n)) return { ok: false, reason: "nickname_not_allowed" };
  return { ok: true };
}

/** 'Jugador4821'. `digits` > 4 sirve para resolver colisiones cuando el espacio de 4 dígitos está saturado. */
export function generateNickname(rand: () => number = Math.random, digits = 4): string {
  const n = Math.floor(rand() * 10 ** digits);
  return `Jugador${String(Math.min(n, 10 ** digits - 1)).padStart(digits, "0")}`;
}
