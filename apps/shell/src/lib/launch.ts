/** Rectángulo de la pieza tocada: de ahí crece el color del juego hasta llenar la pantalla. */
let rect: { top: number; left: number; width: number; height: number } | null = null;

export function setLaunchRect(r: DOMRect | null) {
  rect = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
}
export function takeLaunchRect() {
  const r = rect;
  rect = null;
  return r;
}
