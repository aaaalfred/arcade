# syntax=docker/dockerfile:1.7
#
# Versión web de prueba de Arcade (apps/shell compilado como sitio estático, sin API).
# Contexto de construcción: la raíz del monorepo.
#
#   docker build -t arcade-web .
#   docker run --rm -p 8080:80 arcade-web
#
# Los juegos van dentro del build (gamesPlugin de Vite) y el SDK se genera con build:sdk.

ARG NODE_VERSION=22

# ---------- build: instala, genera el SDK y compila la app web ----------
FROM node:${NODE_VERSION}-alpine AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@arcade/shell..."
RUN pnpm build:sdk
RUN pnpm --filter @arcade/shell build

# ---------- runtime: nginx sirve los estáticos ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /repo/apps/shell/dist /usr/share/nginx/html
# Casita Pastel: juego estático independiente, servido en /casita/
COPY --from=build /repo/apps/casita /usr/share/nginx/html/casita
EXPOSE 80
