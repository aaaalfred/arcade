import { z } from "zod";

export const GameIdSchema = z.string().regex(/^[a-z0-9-]{3,32}$/, "id inválido: usa [a-z0-9-], 3–32 caracteres");

const Hex = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "color hex inválido");

export const BoardSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,32}$/),
    name: z.string().min(1).max(40),
    sort: z.enum(["asc", "desc"]),
    min: z.number().default(0),
    max: z.number(),
    integer: z.boolean().default(true),
    unit: z.string().max(8).optional(),
  })
  .refine((b) => b.max > b.min, { message: "max debe ser mayor que min" });

export const ManifestSchema = z
  .object({
    id: GameIdSchema,
    name: z.string().min(1).max(40),
    tagline: z.string().max(80).default(""),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "versión semver x.y.z"),
    sdk: z.literal(1),
    entry: z
      .string()
      .default("index.html")
      .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "entry debe ser una ruta relativa dentro del juego"),
    orientation: z.enum(["portrait", "landscape", "any"]).default("portrait"),
    theme: z.object({
      accent: Hex,
      background: Hex,
      ink: Hex,
      /** Paleta opcional cuando el sistema está en modo oscuro (si el juego lo soporta). */
      dark: z.object({ accent: Hex, background: Hex, ink: Hex }).optional(),
    }),
    icon: z.string().min(1).max(64),
    progress: z.object({ unit: z.string().min(1).max(20), total: z.number().int().positive() }),
    boards: z.array(BoardSchema).max(8).default([]),
    ads: z.object({ interstitial: z.boolean(), rewarded: z.boolean() }).default({ interstitial: true, rewarded: true }),
    dev: z.boolean().default(false),
  })
  .refine((m) => new Set(m.boards.map((b) => b.id)).size === m.boards.length, {
    message: "ids de tablero repetidos",
    path: ["boards"],
  });

export type Board = z.infer<typeof BoardSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export function parseManifest(input: unknown): Manifest {
  return ManifestSchema.parse(input);
}
