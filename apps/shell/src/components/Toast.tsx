import { signal } from "@preact/signals";

const message = signal<string | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, ms = 2800) {
  message.value = text;
  clearTimeout(timer);
  timer = setTimeout(() => (message.value = null), ms);
}

export function Toasts() {
  return message.value ? (
    <div class="toast" role="status" aria-live="polite">
      {message.value}
    </div>
  ) : null;
}
