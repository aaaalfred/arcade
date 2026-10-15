import { signal } from "@preact/signals";

const message = signal<string | null>(null);
const leaving = signal(false);
const EXIT_MS = 200;
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, ms = 2800) {
  message.value = text;
  leaving.value = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    leaving.value = true;
    timer = setTimeout(() => (message.value = null), EXIT_MS);
  }, ms);
}

export function Toasts() {
  return message.value ? (
    <div class={`toast${leaving.value ? " is-leaving" : ""}`} role="status" aria-live="polite">
      {message.value}
    </div>
  ) : null;
}
