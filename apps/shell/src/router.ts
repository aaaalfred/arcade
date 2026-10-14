import { signal } from "@preact/signals";
import { GameIdSchema } from "@arcade/protocol";

export type Route =
  | { name: "home" }
  | { name: "game"; id: string }
  | { name: "play"; id: string }
  | { name: "ranking"; id?: string }
  | { name: "profile" };

const HOME: Route = { name: "home" };

function gameId(s: string | undefined): string | null {
  const r = GameIdSchema.safeParse(s);
  return r.success ? r.data : null;
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/");
  const [head, a, extra] = parts;
  if (extra !== undefined) return HOME;
  switch (head) {
    case "game":
    case "play": {
      const id = gameId(a);
      return id ? { name: head, id } : HOME;
    }
    case "ranking": {
      if (a === undefined || a === "") return { name: "ranking" };
      const id = gameId(a);
      return id ? { name: "ranking", id } : HOME;
    }
    case "profile":
      return { name: "profile" };
    default:
      return HOME;
  }
}

export function toHash(r: Route): string {
  switch (r.name) {
    case "home": return "#/";
    case "game": return `#/game/${r.id}`;
    case "play": return `#/play/${r.id}`;
    case "ranking": return r.id ? `#/ranking/${r.id}` : "#/ranking";
    case "profile": return "#/profile";
  }
}

export const route = signal<Route>(typeof location === "undefined" ? HOME : parseHash(location.hash));

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    route.value = parseHash(location.hash);
  });
}

export function navigate(r: Route, opts: { replace?: boolean } = {}): void {
  const hash = toHash(r);
  if (opts.replace) location.replace(hash);
  else location.hash = hash;
  route.value = r;
}

/** Vuelve atrás en el historial; si no hay a dónde, va al inicio. */
export function back(): void {
  if (history.length > 1) history.back();
  else navigate({ name: "home" }, { replace: true });
}
