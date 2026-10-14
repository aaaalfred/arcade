# syntax=docker/dockerfile:1.7
#
# API de Arcade (Hono + Postgres). Imagen multi-etapa.
#
# El contexto de construcción es la RAÍZ del monorepo (el lockfile y @arcade/protocol viven fuera de apps/api):
#
#   docker build -f apps/api/Dockerfile -t arcade-api .
#   docker run --rm -p 8787:8787 -e DATABASE_URL=postgres://... arcade-api
#
# Se ignora lo que no hace falta mediante apps/api/Dockerfile.dockerignore (BuildKit).
# ⚠ Este Dockerfile NO se ha podido ejecutar en el equipo de desarrollo (no hay Docker): ver docs/despliegue-api.md.

ARG NODE_VERSION=22

# ---------- base: Node + pnpm (versión fijada por "packageManager" en package.json) ----------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ---------- build: instala, compila y prepara node_modules de producción ----------
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@arcade/api..."
# tsup → dist/server.js (con @arcade/protocol incluido) y dist/migrations/*.sql
RUN pnpm --filter @arcade/api build
# Solo las dependencias de producción, sin devDependencies ni el resto del monorepo
RUN pnpm --filter @arcade/api deploy --prod --legacy /out
# De los juegos solo se copia el manifest.json (la API valida tableros y rangos; no sirve los juegos)
RUN mkdir -p /manifests \
 && for f in games/*/manifest.json; do \
      [ -f "$f" ] || continue; \
      d="$(basename "$(dirname "$f")")"; \
      case "$d" in _*|.*) continue;; esac; \
      mkdir -p "/manifests/$d" && cp "$f" "/manifests/$d/manifest.json"; \
    done

# ---------- runtime: imagen final mínima, usuario no root ----------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    GAMES_DIR=/app/games
WORKDIR /app
# package.json aporta "type": "module" (dist/server.js es ESM)
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
COPY --from=build --chown=node:node /manifests ./games
# Carpeta de PGlite por si se arrancara sin DATABASE_URL (no recomendado en producción)
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
