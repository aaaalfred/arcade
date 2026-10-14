export function formatValue(value: number, unit?: string): string {
  const n = Number.isInteger(value) ? value.toLocaleString("es") : value.toLocaleString("es", { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
}
