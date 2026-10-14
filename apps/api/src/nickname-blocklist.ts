/**
 * Filtro mínimo de apodos (insultos, contenido sexual y discurso de odio comunes en español e inglés).
 * No pretende ser exhaustivo: es una primera barrera; el resto lo cubren los reportes y la moderación.
 *
 * Para AMPLIAR la lista, añade términos EN MINÚSCULAS, SIN ACENTOS (ñ→n) y SIN separadores (_ - . espacio) en:
 *  - BLOCKED_SUBSTRINGS: términos largos e inequívocos; se bloquean aunque estén dentro de otra palabra
 *    (p. ej. «hijoputa» en «xHijoputa99»).
 *  - BLOCKED_WORDS: términos cortos o ambiguos; solo se bloquean si son una palabra entera, para no
 *    penalizar nombres legítimos (p. ej. «puta» está en «computadora», «sex» en «Essex», «cum» en «Cumbia»).
 * La comparación ya se hace sin acentos y con las sustituciones 0→o, 1→i, 3→e, 4→a, 5→s, @→a.
 */
export const BLOCKED_SUBSTRINGS: readonly string[] = [
  // español
  "hijueputa", "hijoputa", "hijodeputa", "malparido", "gonorrea", "pendejo", "cabron", "chingad",
  "mierda", "maricon", "huevon", "culiao", "culero", "puneta", "gilipollas", "capullo", "jodete",
  "boludo", "pelotudo", "mamaverga", "imbecil", "estupido", "violador", "negrata", "pedofil",
  // inglés
  "fuck", "shit", "bitch", "nigger", "faggot", "whore", "asshole", "pussy", "porn", "hitler",
  "neonazi", "pedophil",
];

export const BLOCKED_WORDS: readonly string[] = [
  // español
  "puta", "putas", "puto", "putos", "putita", "putito", "putazo", "verga", "marica", "polla",
  "pene", "culo", "sexo", "pedo", "cojones",
  // inglés
  "sex", "dick", "cock", "cum", "cunt", "cunts", "nigga", "niggas", "slut", "rape", "rapist",
  "retard", "retarded", "nazi", "kkk",
];

const WORDS = new Set(BLOCKED_WORDS);
const SUBSTITUTIONS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a" };

/** minúsculas + sin diacríticos (ñ→n, é→e) */
function plain(s: string): string {
  return s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * ¿Contiene el texto algún término prohibido? Prueba dos lecturas: con las sustituciones de «leet»
 * (m13rda → mierda) y sin dígitos (puta123 → puta), y con separadores quitados (p.u.t.a → puta).
 */
export function containsBlockedTerm(input: string): boolean {
  const base = plain(input);
  const leet = base.replace(/[01345@]/g, (c) => SUBSTITUTIONS[c] ?? c);
  const noDigits = base.replace(/[0-9@]/g, "");
  for (const reading of [leet, noDigits]) {
    const tokens = reading.split(/[\s_.\-]+/).filter(Boolean);
    const joined = tokens.join("");
    if (BLOCKED_SUBSTRINGS.some((t) => joined.includes(t))) return true;
    if (WORDS.has(joined) || tokens.some((t) => WORDS.has(t))) return true;
  }
  return false;
}
