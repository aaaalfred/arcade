/**
 * Clave de semana ISO 8601 en UTC: 'YYYY-Www'. La semana empieza el lunes 00:00:00 UTC y pertenece
 * al año ISO de su jueves (por eso 2027-01-03 es 2026-W53 y 2027-01-04 es 2027-W01).
 */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = t.getUTCDay() || 7; // lunes=1 … domingo=7
  t.setUTCDate(t.getUTCDate() + 4 - dayOfWeek); // jueves de esa semana
  const isoYear = t.getUTCFullYear();
  const dayOfYear = Math.floor((t.getTime() - Date.UTC(isoYear, 0, 1)) / 86_400_000);
  const week = Math.floor(dayOfYear / 7) + 1;
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}
