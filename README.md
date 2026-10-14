# Arcade

App móvil (Play Store y App Store) que **aloja varios juegos HTML** con guardado de partida, progreso y ranking.
Los juegos van empaquetados dentro de la app y funcionan sin conexión; la API solo aporta cuentas anónimas,
sincronización y ranking.

> Nombre y `appId` son **provisionales** (`Arcade` / `com.example.arcade`). Hay que fijarlos antes de la primera subida a una tienda.

## Estructura

```
games/<id>/            Juegos (manifest.json + HTML). Hoy: flechas  (+ sdk-playground, solo desarrollo)
packages/protocol/     Contratos compartidos (manifiesto, mensajes del puente, cuerpos de la API) con zod
packages/game-sdk/     SDK que cargan los juegos: window.Arcade (modo app y modo standalone)
apps/shell/            La app: Preact + Vite + Capacitor 8  (android/ e ios/ generados)
apps/api/              API: Hono + Postgres (PGlite en desarrollo y pruebas)
scripts/               check-games, import-game, serve-games, build-sdk
docs/                  Diseño, plan, guías y documentación de tiendas
```

## Empezar

```bash
pnpm install
pnpm test                       # 450+ pruebas (protocol, SDK, scripts, shell, API)
pnpm typecheck
pnpm check:games --strict       # valida los juegos (manifiesto, SDK, sin recursos remotos…)

pnpm dev:api                    # API en http://localhost:8787 (datos persistentes en apps/api/.data; DB_MEMORY=1 para memoria)
pnpm dev:shell                  # la app en http://localhost:5173
pnpm dev:game                   # un juego suelto en modo standalone: http://localhost:5174/<id>/

pnpm --filter @arcade/shell e2e # pruebas de extremo a extremo (Chromium móvil + API real), ~15 s
```

## Documentación

| Qué | Dónde |
|---|---|
| Diseño y decisiones | [`docs/superpowers/specs/2026-10-13-arcade-platform-design.md`](docs/superpowers/specs/2026-10-13-arcade-platform-design.md) |
| Plan de implementación | [`docs/superpowers/plans/2026-10-13-arcade-platform.md`](docs/superpowers/plans/2026-10-13-arcade-platform.md) |
| **Integrar un juego** (15 min) | [`docs/integrar-un-juego.md`](docs/integrar-un-juego.md) |
| Compilar Android/iOS | [`docs/store/build-local.md`](docs/store/build-local.md) |
| Desplegar la API (Dokploy) | [`docs/despliegue-api.md`](docs/despliegue-api.md) |
| Checklist de publicación, ficha, política de privacidad, notas para Apple | [`docs/store/`](docs/store/) |

## Estado

| Área | Estado |
|---|---|
| SDK, puente, sincronización offline, ranking, perfil, borrado de datos | ✔ implementado y probado (unitarias + E2E con la API real) |
| Juego piloto **Flechas** | ✔ integrado y jugado de punta a punta en los E2E |
| Android: APK debug y AAB release firmado | ✔ compilan (verificado) |
| Ejecutar en un dispositivo/emulador Android | ✘ sin probar |
| iOS (proyecto Xcode, SPM) | ✘ generado pero **no compilado** (requiere macOS + Xcode 26) |
| Anuncios AdMob / consentimiento UMP / ATT | ✘ implementados con IDs de prueba; **sin probar en dispositivo** |
| API desplegada | ✘ no desplegada (necesita tu servidor y dominio); Dockerfile sin construir (no hay Docker aquí) |
| CI (GitHub Actions) | ✘ escrito, sin ejecutar |

## Lo que necesita una decisión tuya
Nombre y `appId` definitivos · cuentas de Play (25 USD) y Apple (99 USD/año) · dominio de la API · IDs reales de AdMob ·
URL de la política de privacidad (hay plantilla) · público objetivo (el diseño asume público general) ·
qué juegos entran en la v1 (hay 11 prototipos más en `../`, ver `docs/integrar-un-juego.md`).
