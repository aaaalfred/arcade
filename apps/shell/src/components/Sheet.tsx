import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

/** Hoja inferior modal. Enfoca el diálogo al abrir y se cierra con el fondo o con Escape. */
export function Sheet(props: { title?: string; label?: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <>
      <div class="backdrop" onClick={props.onClose} />
      <div class="sheet" role="dialog" aria-modal="true" aria-label={props.title ?? props.label} tabIndex={-1} ref={ref}>
        {props.title && <h2>{props.title}</h2>}
        {props.children}
      </div>
    </>
  );
}
