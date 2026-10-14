/**
 * Interfaz mínima de base de datos que comparten Postgres real (`pg`) y PGlite (dev/tests).
 * Todas las consultas son parametrizadas ($1, $2…): nunca se concatenan valores en el SQL.
 */
export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Ejecuta varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
  /** Ejecuta `fn` en una transacción: COMMIT si resuelve, ROLLBACK si lanza. Anidar reutiliza la transacción. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Código SQLSTATE de un error de base de datos (pg y PGlite lo exponen en `.code`). */
export function dbErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

export const UNIQUE_VIOLATION = "23505";
