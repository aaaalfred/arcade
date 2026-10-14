import { Hono } from "hono";

/** Salud del proceso. Sin autenticación y sin tocar la base de datos. */
export function healthRoutes(): Hono {
  const r = new Hono();
  r.get("/health", (c) => c.json({ ok: true }));
  return r;
}
