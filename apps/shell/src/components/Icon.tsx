import type { JSX } from "preact";

const PATHS = {
  back: "M15 5l-7 7 7 7",
  trophy: "M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M12 13v4M8 20h8M10 17h4",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  games: "M4 6.5A2.5 2.5 0 016.5 4h3A2.5 2.5 0 0112 6.5v3A2.5 2.5 0 019.5 12h-3A2.5 2.5 0 014 9.5v-3zM14 14.5a2.5 2.5 0 012.5-2.5h1a2.5 2.5 0 012.5 2.5v1a2.5 2.5 0 01-2.5 2.5h-1a2.5 2.5 0 01-2.5-2.5v-1zM4 16.5A2.5 2.5 0 016.5 14h1A2.5 2.5 0 0110 16.5v1A2.5 2.5 0 017.5 20h-1A2.5 2.5 0 014 17.5v-1zM14 6.5A2.5 2.5 0 0116.5 4h1A2.5 2.5 0 0120 6.5v1A2.5 2.5 0 0117.5 10h-1A2.5 2.5 0 0114 7.5v-1z",
  ranking: "M5 20V11M12 20V4M19 20v-7",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0",
  check: "M5 12.5l4.5 4.5L19 7.5",
  play: "M8 5.5v13l11-6.5-11-6.5z",
  flag: "M5 21V4M5 5h11l-2 4 2 4H5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, ...rest }: { name: IconName; size?: number } & JSX.SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
