import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { containsBlockedTerm } from "../src/nickname-blocklist";
import { generateNickname, nicknameKey, normalizeNickname, validateNickname } from "../src/nickname";
import { call, createHarness, register, type Harness } from "./helpers";

describe("normalizeNickname", () => {
  it("NFKC, trim y colapso de espacios", () => {
    expect(normalizeNickname("  Ángel   López ")).toBe("Ángel López");
    expect(normalizeNickname("Ángel")).toBe("Ángel"); // descompuesto → compuesto
    expect(normalizeNickname("Ｆｏｏ")).toBe("Foo"); // ancho completo
    expect(normalizeNickname("a  b")).toBe("a b"); // NBSP
    expect(normalizeNickname("a　b")).toBe("a b"); // espacio ideográfico
  });
  it("no oculta los caracteres de formato ni de control: los deja para que la validación los rechace", () => {
    expect(normalizeNickname("a​b")).toBe("a​b");
    expect(normalizeNickname("a\tb")).toBe("a\tb");
  });
});

describe("nicknameKey", () => {
  it("ÁNGEL, ángel y Ángel colisionan", () => {
    const k = nicknameKey("ángel");
    expect(nicknameKey("ÁNGEL")).toBe(k);
    expect(nicknameKey("Ángel")).toBe(k);
    expect(nicknameKey("ÁNGEL")).toBe(k);
  });
  it("no pliega diacríticos: Angel y Ángel son distintos", () => {
    expect(nicknameKey("Angel")).not.toBe(nicknameKey("Ángel"));
  });
});

describe("validateNickname", () => {
  const ok = (n: string) => expect(validateNickname(n)).toEqual({ ok: true });
  const bad = (n: string, reason: string) => expect(validateNickname(n)).toEqual({ ok: false, reason });

  it("acepta letras Unicode, dígitos, espacio, _ - . y emoji", () => {
    ok("Ángel");
    ok("Juan_Pérez-99.x");
    ok("Анна");
    ok("名前テスト");
    ok("José María");
    ok("Ana😀");
    ok("👨‍👩‍👧"); // ZWJ entre emoji
    ok("🇨🇱🇨🇱"); // banderas (indicadores regionales)
    ok("👍🏽ok"); // modificador de tono
  });

  it("longitud 3–16 en puntos de código", () => {
    bad("ab", "nickname_too_short");
    bad("", "nickname_too_short");
    ok("abc");
    ok("a".repeat(16));
    bad("a".repeat(17), "nickname_too_long");
    ok("😀😀😀"); // 3 puntos de código (6 unidades UTF-16)
    bad("😀😀", "nickname_too_short");
    ok("😀".repeat(16));
    bad("😀".repeat(17), "nickname_too_long");
  });

  it("rechaza caracteres de control, de formato y separadores no ASCII", () => {
    bad("a​bc", "nickname_invalid_chars"); // ancho cero
    bad("abc\u0000", "nickname_invalid_chars");
    bad("abc\n", "nickname_invalid_chars");
    bad("a\tbc", "nickname_invalid_chars");
    bad("abc‮", "nickname_invalid_chars"); // anulación bidi
    bad("a bc", "nickname_invalid_chars"); // separador de línea
    bad("a bc", "nickname_invalid_chars"); // NBSP sin normalizar
    bad("a　bc", "nickname_invalid_chars");
    bad("﻿abc", "nickname_invalid_chars");
    bad("a‍bc", "nickname_invalid_chars"); // ZWJ fuera de una secuencia de emoji
    bad("abc\ud800", "nickname_invalid_chars"); // sustituto suelto
    bad("abc", "nickname_invalid_chars"); // uso privado
  });

  it("rechaza símbolos y puntuación fuera de la lista", () => {
    for (const n of ["@home", "a!b", "a/b", "<b>x</b>", "a;b", "a'b", 'a"b', "a,b", "a#b", "a$b", "a\\b", "a+b", "a=b"]) {
      bad(n, "nickname_invalid_chars");
    }
  });

  it("rechaza nombres sin ninguna letra, dígito o emoji", () => {
    bad("...", "nickname_invalid_chars");
    bad("___", "nickname_invalid_chars");
    bad("-_-", "nickname_invalid_chars");
  });

  it("rechaza apilados abusivos de marcas combinantes", () => {
    bad("a" + "́".repeat(10) + "bc", "nickname_invalid_chars");
    bad("́abc", "nickname_invalid_chars");
    ok("ábc"); // una marca es normal (aunque NFKC la compone)
  });

  it("aplica el filtro de palabras prohibidas", () => {
    bad("Hijueputa", "nickname_not_allowed");
    bad("M1erda", "nickname_not_allowed");
    bad("Fuck_you", "nickname_not_allowed");
    ok("Ángel");
  });
});

describe("containsBlockedTerm", () => {
  const blocked = [
    "puta", "PUTA", "Puta Madre", "p.u.t.a", "p_u-t a", // separadores y mayúsculas
    "hijueputa", "hijo_de_puta", "Hijoputa", "M13rda", "m1erda", "C4brón", "CABRÓN", "pendej0", "Pendejo", "puñeta", "huev0n", "chingada",
    "fuck", "FUCK", "f.u.c.k", "Sh1t", "mierd@", "b1tch", "n1gger", "fagg0t", "wh0re", "assh0le", "pussy", "pu55y", "p0rn", "hitler", "H1tler",
    "dick", "D1ck", "c0ck", "cum", "pene", "P3n3", "culo", "Cul0", "verga", "nazi", "N4zi", "Puta123", "Pene_2000", "1gilipollas",
  ];
  for (const n of blocked) {
    it(`bloquea «${n}»`, () => expect(containsBlockedTerm(n)).toBe(true));
  }

  const allowed = [
    "computadora", "Classic", "Cumbia", "Scunthorpe", "Grape", "Sextante", "Dickens", "Pasa", "Vergara", "Cocktail", "Pelota",
    "Ángel", "Juan Pérez", "Pedro", "Pedal", "Mariposa", "Maricarmen", "Cultura", "Penélope",
    "Shiitake", "Assassin", "Rapero", "Sexto", "Titanic", "Analista",
  ];
  for (const n of allowed) {
    it(`permite «${n}»`, () => expect(containsBlockedTerm(n)).toBe(false));
  }
});

describe("generateNickname", () => {
  it("genera Jugador + 4 dígitos con relleno", () => {
    expect(generateNickname(() => 0.4821)).toBe("Jugador4821");
    expect(generateNickname(() => 0)).toBe("Jugador0000");
    expect(generateNickname(() => 0.99999999)).toBe("Jugador9999");
  });
  it("admite más dígitos para resolver colisiones", () => {
    expect(generateNickname(() => 0.5, 8)).toBe("Jugador50000000");
  });
  it("los generados superan la validación", () => {
    expect(validateNickname(generateNickname())).toEqual({ ok: true });
  });
});

describe("PATCH /v1/me (apodos)", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.close());
  beforeEach(() => h.reset());

  const patch = (token: string, nickname: unknown) => call(h, "PATCH", "/v1/me", { token, body: { nickname } });

  it("acepta «Ángel» y lo refleja en GET /me", async () => {
    const p = await register(h);
    const r = await patch(p.token, "Ángel");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ id: p.id, nickname: "Ángel" });
    expect((await call(h, "GET", "/v1/me", { token: p.token })).json.nickname).toBe("Ángel");
  });

  it("normaliza «  Ángel   López »", async () => {
    const p = await register(h);
    expect((await patch(p.token, "  Ángel   López ")).json.nickname).toBe("Ángel López");
  });

  it("rechaza 2 y 17 caracteres con su código", async () => {
    const p = await register(h);
    const corto = await patch(p.token, "ab");
    expect(corto.status).toBe(400);
    expect(corto.json.error).toBe("nickname_too_short");
    expect(typeof corto.json.message).toBe("string");
    const largo = await patch(p.token, "a".repeat(17));
    expect(largo.status).toBe(400);
    expect(largo.json.error).toBe("nickname_too_long");
  });

  it("cuenta la longitud DESPUÉS de normalizar", async () => {
    const p = await register(h);
    expect((await patch(p.token, "  ab  ")).json.error).toBe("nickname_too_short");
    expect((await patch(p.token, `  ${"a".repeat(16)}  `)).status).toBe(200);
  });

  it("rechaza controles y caracteres de ancho cero", async () => {
    const p = await register(h);
    for (const n of ["ab\u0000c", "ab​c", "ab‮c", "ab\nc"]) {
      const r = await patch(p.token, n);
      expect(r.status).toBe(400);
      expect(r.json.error).toBe("nickname_invalid_chars");
    }
  });

  it("rechaza ÁNGEL, «  Ángel » y A+◌́ngel si existe «ángel» (409)", async () => {
    const a = await register(h);
    const b = await register(h);
    expect((await patch(a.token, "ángel")).status).toBe(200);
    for (const n of ["ÁNGEL", "  Ángel ", "ÁNGEL", "ángel"]) {
      const r = await patch(b.token, n);
      expect(r.status).toBe(409);
      expect(r.json.error).toBe("nickname_taken");
    }
    // pero «Angel» (sin tilde) es otro apodo
    expect((await patch(b.token, "Angel")).status).toBe(200);
  });

  it("el dueño puede volver a guardar su propio apodo (también cambiando mayúsculas)", async () => {
    const a = await register(h);
    expect((await patch(a.token, "ángel")).status).toBe(200);
    expect((await patch(a.token, "ángel")).status).toBe(200);
    const r = await patch(a.token, "ÁNGEL");
    expect(r.status).toBe(200);
    expect(r.json.nickname).toBe("ÁNGEL");
  });

  it("dos peticiones simultáneas por el mismo apodo: una gana y la otra recibe 409", async () => {
    const a = await register(h);
    const b = await register(h);
    const [r1, r2] = await Promise.all([patch(a.token, "Carrera"), patch(b.token, "CARRERA")]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
  });

  it("filtra palabras prohibidas (es/en, acentos y sustituciones)", async () => {
    const p = await register(h);
    for (const n of ["Hijueputa", "M13rda", "F.u.c.k", "Cabrón", "PUTA", "Pendej0", "sh1t"]) {
      const r = await patch(p.token, n);
      expect(r.status, n).toBe(400);
      expect(r.json.error, n).toBe("nickname_not_allowed");
    }
  });

  it("cuerpo inválido ⇒ 400 invalid_body", async () => {
    const p = await register(h);
    for (const body of [{}, { nickname: 5 }, { nickname: null }, []]) {
      const r = await call(h, "PATCH", "/v1/me", { token: p.token, body });
      expect(r.status).toBe(400);
      expect(r.json.error).toBe("invalid_body");
    }
    const malo = await call(h, "PATCH", "/v1/me", { token: p.token, raw: "{no es json" });
    expect(malo.status).toBe(400);
    expect(malo.json.error).toBe("invalid_body");
    const vacio = await call(h, "PATCH", "/v1/me", { token: p.token });
    expect(vacio.json.error).toBe("invalid_body");
  });

  it("un cuerpo enorme se rechaza con 400 invalid_body (no es una ruta de guardado)", async () => {
    const p = await register(h);
    const r = await call(h, "PATCH", "/v1/me", { token: p.token, raw: JSON.stringify({ nickname: "a".repeat(200_000) }) });
    expect(r.status).toBe(400);
    expect(r.json.error).toBe("invalid_body");
  });

  it("sin credenciales ⇒ 401", async () => {
    expect((await call(h, "PATCH", "/v1/me", { body: { nickname: "Hola" } })).status).toBe(401);
  });
});
