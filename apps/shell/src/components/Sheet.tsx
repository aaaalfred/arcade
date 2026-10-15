import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

/** Hoja inferior modal. Enfoca el diálogo al abrir y se cierra con el fondo o con Escape. */
export function Sheet(props: { title?: string; label?: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<() => void>();
  // Cierre por fondo o Escape: primero sale la hoja, luego se avisa al padre.
  closeRef.current = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(props.onClose, 170);
  };
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current?.();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <>
      <div class={`backdrop${closing ? " is-closing" : ""}`} onClick={() => closeRef.current?.()} />
      <div class={`sheet${closing ? " is-closing" : ""}`} role="dialog" aria-modal="true" aria-label={props.title ?? props.label} tabIndex={-1} ref={ref}>
        {props.title && <h2>{props.title}</h2>}
        {props.children}
      </div>
    </>
  );
}
