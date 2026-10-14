const MAX_SEGMENTS = 24;

/** Progreso: un tramo por nivel (los niveles sí son una secuencia); barra continua si son muchos. */
export function Ticks({ done, total }: { done: number; total: number }) {
  const value = Math.max(0, Math.min(done, total));
  if (total > MAX_SEGMENTS) {
    return (
      <div class="ticks ticks--bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
        <b style={{ width: `${(value / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div class="ticks" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} class={i < value ? "on" : ""} />
      ))}
    </div>
  );
}
