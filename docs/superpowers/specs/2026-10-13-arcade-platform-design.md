# Arcade — plataforma móvil para juegos HTML (Play Store + App Store)

Fecha: 2026-10-13 · Estado: diseño aprobado por delegación (el usuario indicó "no necesitas mi autorización, avísame cuando esté listo")

## 1. Entendimiento

**Lo que pidió el usuario**
- Una app para distribuir en Play Store y App Store que **embebe varios juegos HTML**.
- Con **estados** (guardado de partida), **avances** (progreso) y **ranking**.
- Otra sesión está diseñando un juego; **ese será el primero en integrarse**.
- Planificar todo y desarrollarlo sin pedir aprobación; avisar al terminar.

**Contexto encontrado** (`/home/imalf/code/games/a`)
- Los juegos son carpetas HTML autocontenidas (`index.html` + `logic.js` + `levels.js`), por niveles con 1–3 estrellas, canvas táctil vertical, sin dependencias remotas.
- Guardan progreso en `localStorage` (`flechas10_progress_v1`) y tienen ganchos de anuncios *simulados* (`Ads.interstitial()` cada 3 niveles, `Ads.rewarded()` para pistas).
- El plan previo (`plan_mvp_juego_android.xlsx`) ya eligió **Capacitor + JS** y **AdMob por plugin nativo**, con APK/AAB local (no URL remota).
- Prototipos presentes: `laberinto-10` y `flechas-10` (el más reciente, probablemente el juego en diseño). Una sesión nueva, "Juego similar a YouTube con 10 niveles", está activa.

**Supuestos (a confirmar por el usuario, ninguno bloquea el desarrollo)**
| # | Supuesto | Si es falso |
|---|----------|-------------|
| A1 | Público general (no "diseñada para niños") | Programa Familias/COPPA: se restringe AdMob y se revisa el SDK |
| A2 | Monetización por AdMob (interstitial + rewarded) | Se apaga con `ADS_ENABLED=false`; sin cambios de código en juegos |
| A3 | Cuentas anónimas + apodo (sin login social) en v1 | Se añade vinculación Apple/Google en v2 (ver §11) |
| A4 | Un único backend propio en el servidor Dokploy del usuario | La API es un contenedor estándar; se puede mover |
| A5 | Los juegos son del propio usuario (código propio, empaquetado en el binario) | Juegos de terceros exigen sandbox por origen y revisión 4.7 |
| A6 | Interfaz en español | Las cadenas están centralizadas para añadir idiomas |
| A7 | Nombre provisional "Arcade", appId `com.example.arcade` | **Debe fijarse antes de la primera subida a tienda; no se puede cambiar después** |

**Criterios de éxito**
1. Un juego nuevo se integra con: carpeta + `manifest.json` + 3 líneas de SDK, sin tocar el shell ni la API.
2. Progreso y partida sobreviven a cerrar la app y a jugar sin red, y se sincronizan con el servidor cuando hay red. Al reinstalar se recuperan solo si el sistema restaura la copia de seguridad (Auto Backup / iCloud); la recuperación garantizada en otro dispositivo llega con la vinculación de cuenta (v2).
3. Ranking global y semanal por juego, con la posición del jugador.
4. Compila `.aab` de Android y proyecto iOS listo para archivar en macOS.
5. Todo funciona 100 % offline excepto ranking en vivo y sincronización.

## 2. Alcance

**Dentro (v1):** shell móvil (catálogo, jugar, ranking, perfil), SDK de juegos, API (cuentas anónimas, guardados, puntajes, ranking, reportes, borrado de datos), puente de anuncios AdMob (apagable), integración del juego piloto, proyectos Android/iOS, CI de compilación, documentación de tienda.

**Fuera (diferido, ver §11):** login social, amigos, logros, push, compras in-app (quitar anuncios), catálogo remoto/OTA, analítica de terceros, torneos, otros idiomas.

## 3. Decisiones de arquitectura

| Tema | Decisión | Por qué / alternativa descartada |
|------|----------|----------------------------------|
| Contenedor | **Capacitor 8** + app web (Vite + TypeScript + Preact) | Los juegos ya son web; reutiliza todo. Flutter/nativo: reescribir sin ganancia. |
| Aislamiento del juego | Cada juego en un **`<iframe>`** same-origin servido desde los assets empaquetados, comunicado por **`postMessage`** | Un WebView por juego es pesado. Juegos propios y empaquetados ⇒ same-origin aceptable (§8). |
| Juegos en el binario | **Empaquetados dentro de la app** (sin descarga de código) | Evita el riesgo de la guía 4.7 de Apple (software "no embebido") y funciona offline. |
| Persistencia local | **Capacitor Preferences** (nativo) con fallback `localStorage` en web | `localStorage`/IndexedDB del WebView pueden purgarse; Preferences es nativo y entra en Auto Backup/iCloud. |
| Backend | **Hono (Node 22) + Postgres**; **PGlite** (Postgres real en proceso) para dev y tests | Dokploy ya ofrece Postgres; SQL con ventanas resuelve ranking sin Redis. En WSL no hay Docker. |
| Identidad | Cuenta **anónima**: el servidor emite `playerId + secreto` (guardado hasheado). Apodo editable | Cero fricción; evita Sign in with Apple obligatorio (solo aplica si hay login de terceros). |
| Guardado | Blob JSON opaco por (jugador, juego), ≤ 64 KB, con `rev` en servidor. Conflicto: **gana mayor `progress.value`**, empate → última escritura | Simple y determinista; el progreso de niveles es monótono. |
| Ranking | Tableros de tipo **mejor puntaje** (`desc`/`asc`), periodos `all` y semana ISO | Un total acumulado (p. ej. estrellas) es monótono, así que "mejor" basta. |
| Sync | **Outbox coalescido** persistente: 1 guardado por juego y 1 mejor puntaje por tablero; reintento con backoff | Cola mínima, tolera offline y cierres abruptos. |
| Anuncios | `AdsService` central en el shell (frecuencia limitada por el shell, no por el juego); AdMob con IDs de prueba por defecto | Los juegos solo piden `Arcade.ads.*`. |

## 4. Arquitectura

```
┌────────────────────────── App (Capacitor) ──────────────────────────┐
│  Shell (Preact)                                                       │
│   Home · Detalle · Jugar · Ranking · Perfil                           │
│   Servicios: storage · auth · sync(outbox) · api · ads · native       │
│   Bridge host ──postMessage──►  <iframe games/<id>/index.html>        │
│                                    └─ arcade-sdk.js  (window.Arcade)  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS (opcional, offline-first)
                        ┌───────▼────────┐        ┌──────────────┐
                        │ API Hono       │───────►│ Postgres     │
                        │ /v1/*          │        │ (PGlite: dev)│
                        └────────────────┘        └──────────────┘
```

**Monorepo (pnpm workspaces)**
```
arcade/
  games/<id>/{manifest.json,index.html,…}   # juegos (fuente de verdad del catálogo)
  games/_sdk/arcade-sdk.js                  # generado (gitignored)
  packages/protocol/   # tipos + zod: manifest, mensajes del puente, DTOs de la API
  packages/game-sdk/   # SDK de navegador (IIFE ~4 KB) con modo standalone
  apps/api/            # Hono + migraciones SQL
  apps/shell/          # Vite + Preact + Capacitor (android/, ios/)
  scripts/             # check-games, import-game, serve-games
  docs/                # specs, planes, guías, tienda
```
Unidades con una responsabilidad y una interfaz clara: `protocol` (contratos) no depende de nada; `game-sdk` solo importa tipos de `protocol`; `api` y `shell` dependen de `protocol`, nunca entre sí.

## 5. Contrato de juego

### 5.1 `manifest.json`
```jsonc
{
  "id": "flechas",                  // [a-z0-9-]{3,32}, inmutable (clave en servidor)
  "name": "Flechas",
  "tagline": "Saca las flechas sin chocar",
  "version": "1.0.0",
  "sdk": 1,                         // versión mayor del SDK que usa
  "entry": "index.html",
  "orientation": "portrait",        // portrait | landscape | any
  "theme": { "accent": "#3f8a52", "background": "#f3f7f1", "ink": "#2e473f" },
  "icon": "🏹",                     // emoji o ruta a imagen
  "progress": { "unit": "niveles", "total": 10 },
  "boards": [
    { "id": "stars", "name": "Estrellas totales", "sort": "desc", "min": 0, "max": 30, "integer": true, "unit": "★" }
  ],
  "ads": { "interstitial": true, "rewarded": true },
  "dev": false                      // true ⇒ solo en builds de desarrollo
}
```
El mismo archivo lo consumen el shell (catálogo en build) y la API (validación de tableros y rangos). Un juego nuevo no requiere cambios de código; la API se redespliega para leer el manifiesto.

### 5.2 SDK `window.Arcade`
```ts
Arcade.ready(): Promise<Session>
//  Session = { player:{id,nickname}|null, state:unknown|null, settings:{sound,haptics,locale},
//              insets:{top,right,bottom,left}, mode:'host'|'standalone', sdk:1 }
Arcade.save(state, opts?: { progress?: { value:number, total?:number } }): void   // no bloquea
Arcade.submitScore(boardId, value, meta?): Promise<{accepted,best,rank:{all,weekly},offline}>
Arcade.ads.interstitial(): Promise<void>      // nunca rechaza
Arcade.ads.rewarded(): Promise<boolean>       // true si ganó la recompensa
Arcade.haptic('light'|'medium'|'heavy'|'success'|'error'): void
Arcade.openLeaderboard(boardId?): void
Arcade.exit(): void
Arcade.on('pause'|'resume'|'settings', fn): () => void
```
- **Modo standalone** (sin shell): misma API sobre `localStorage`, anuncios simulados y ranking local ⇒ el juego se desarrolla y prueba en un navegador sin cambios.
- `gameId` en standalone se toma de `<script src="…arcade-sdk.js" data-game="flechas">`; en modo host lo determina el shell por el iframe (nunca se confía en el juego).

### 5.3 Protocolo del puente
Sobre `postMessage` con sobre `{arcade:1, id?, replyTo?, type, payload}`.
- Juego → shell: `hello`, `save`, `score`, `ad.interstitial`, `ad.rewarded`, `haptic`, `leaderboard.open`, `exit`. Las peticiones llevan `id`; el shell responde `{replyTo:id, ok, payload|error}`.
- Shell → juego: `pause`, `resume`, `settings`.
- El shell valida `event.source === iframe.contentWindow`, `event.origin === location.origin` y el esquema (zod). Mensajes inválidos se descartan y se registran.
- Ciclo de vida: `pause` al abrir el menú del shell, mostrar un anuncio o enviar la app a segundo plano; `resume` al volver.

### 5.4 Reglas para un juego (las verifica `pnpm check:games`)
1. Sin recursos remotos (`http(s)://` en `src`/`href`/`fetch`): debe funcionar sin red y cumple 4.7.
2. Sin `localStorage` propio para progreso: usar `Arcade.save`.
3. Sin `navigator.vibrate`: usar `Arcade.haptic` (no funciona en iOS).
4. Manifiesto válido, `entry` existente, tamaño de la carpeta ≤ 15 MB.
5. Incluye `../_sdk/arcade-sdk.js`.

## 6. Shell (app)

**Pantallas:** Juegos (rejilla con estado "Nuevo / En progreso 3/10 / Completado" + fila "Continuar") · Detalle (progreso, mejores puntajes, Jugar) · Jugar (iframe + barra superior fina: ← Hub, título, 🏆, ⚙) · Ranking (juego → tablero → global/semanal, fila del jugador fijada) · Perfil (apodo, estadísticas, sonido/háptica, política de privacidad, **borrar mis datos**).

**Servicios**
- `storage` KV (Preferences/localStorage).
- `auth`: registra la cuenta anónima la primera vez que hay red; sin red se juega con perfil local y se registra después.
- `api`: cliente `fetch` con timeout, `Authorization: Bearer <id>.<secreto>`; si recibe 401 re-registra y re-sube lo local (lo local manda).
- `sync`: outbox coalescido (§3), vaciado al iniciar, al volver la red, tras cambios (debounce) y al pausar; al abrir un juego intenta `pull` con tope de 1,5 s antes de entregar el estado.
- `ads`: `SimulatedAds` (web/dev) y `AdMobAds` (nativo). El shell impone **mínimo 90 s entre intersticiales** y pausa el juego durante el anuncio. UMP (GDPR) y ATT (iOS) antes de inicializar.
- `native`: háptica, bloqueo de orientación del manifiesto, barra de estado, botón atrás de Android (en juego → menú del shell), eventos de segundo plano.

**Diseño visual:** oscuro/neutro con acento por juego tomado del manifiesto; áreas seguras (`env(safe-area-inset-*)`, `viewport-fit=cover`); tipografía y componentes propios, no plantilla genérica.

## 7. API (`/v1`)

| Método y ruta | Función |
|---|---|
| `POST /auth/anonymous` | Crea jugador → `{playerId, secret, nickname}` |
| `GET /me` · `PATCH /me` | Perfil · cambiar apodo (3–16, filtro, único sin distinguir mayúsculas) |
| `DELETE /me` | Borra jugador, guardados, puntajes y reportes |
| `GET /saves` | Todos los guardados del jugador: `[{gameId, rev, state, progress, updatedAt}]` |
| `PUT /games/:id/save` | `{state, progress, baseRev}` → `{rev, resolution}` o `409` con el del servidor |
| `POST /games/:id/scores` | `{board, value, meta?}` → `{accepted,best,rank:{all,weekly}}` |
| `GET /games/:id/boards/:board?period=all\|weekly&limit=50` | Top N + fila del jugador |
| `POST /reports` | Reportar un apodo/jugador (requisito de contenido de usuario) |
| `GET /health` | Salud |
| `POST /admin/players/:id/hide` · `GET /admin/reports` | Moderación (cabecera `ADMIN_TOKEN`) |

**Datos (Postgres):** `players(id, token_hash, nickname, nickname_ci unique, hidden, created_at, last_seen_at)` · `saves(player_id, game_id, rev, state jsonb, progress_value, progress_total, updated_at)` · `scores(player_id, game_id, board_id, period, value, achieved_at, game_version)` con índice `(game_id, board_id, period, value, achieved_at)` · `reports(...)`. Migraciones SQL ordenadas con tabla `schema_migrations`.

**Ranking:** orden por valor y desempate por `achieved_at` más antiguo; periodo `weekly` = semana ISO UTC; jugadores `hidden` se excluyen.
**Antiabuso (honesto):** un juego en el cliente no puede impedir trampas; mitigamos con rango `min/max` del manifiesto, `integer`, límite de 30 envíos/min/jugador y 10 registros/h/IP, y moderación para ocultar. Evolución natural: enviar la lista de movimientos y reverificarla en el servidor reutilizando `logic.js` (puro, corre en Node).

## 8. Seguridad y privacidad
- Solo HTTPS; Android con `cleartext` apagado salvo build debug.
- Secretos hasheados con SHA-256 en BD; tokens opacos (sin JWT que rotar).
- Modelo de confianza del iframe: **juegos propios y revisados**, same-origin. Para juegos de terceros: origen opaco por juego o esquema propio (fuera de alcance).
- Datos tratados: id anónimo, apodo, puntajes, guardados, IP en logs del proxy; AdMob recoge identificadores publicitarios. Sin analítica de terceros en v1.
- Cumplimiento: borrado de cuenta in-app (App Store 5.1.1(v)), reportar contenido (1.2), política de privacidad, formulario Data Safety / App Privacy, ATT/UMP.

## 9. Pruebas
- `protocol`: esquemas (válidos/ inválidos).
- `game-sdk`: Vitest + jsdom, ambos modos, con un host falso.
- `api`: Vitest sobre PGlite vía `app.request()`: registro, apodos, guardado con conflicto, puntajes (ambas direcciones), rank y empates, semanal, ocultos, borrado, límites, validación de rango.
- `shell`: unitarias de `sync`, `bridge host`, `ads gate`; **E2E con Playwright** (Chromium móvil 390×844) contra la app construida + API en proceso: primer arranque, jugar `sdk-playground`, persistencia tras recarga, offline→online, ranking, borrado de datos, y carga del juego piloto real.
- Android: `assembleDebug` y `bundleRelease` si el SDK se instala en este equipo. iOS: **no se puede compilar en Linux**; se valida con CI en macOS.
- `check:games` corre en CI y antes de cada importación.

## 10. Construcción y publicación
- Android: Capacitor 8 ⇒ compileSdk/targetSdk 36, minSdk 24, AGP 8.13, Java 21. Firma con keystore del usuario (nunca en el repo) + Play App Signing.
- iOS: Capacitor 8 ⇒ Xcode 26, iOS ≥ 15, SPM. Requiere Mac o CI macOS y cuenta Apple Developer.
- Play: cuentas personales nuevas necesitan **prueba cerrada con ≥ 12 testers durante 14 días** (alternativa: cuenta de organización con D-U-N-S).
- App Store: la guía 4.7 permite mini-juegos HTML5, pero hay rechazos cuando "hospedar juegos HTML5" parece el propósito principal. Mitigación: juegos **embebidos en el binario**, funciones nativas (háptica, almacenamiento nativo, ranking, anuncios nativos), calidad y contenido propios; el 4.2 (funcionalidad mínima) se cumple por lo mismo. Riesgo residual **medio**; se documenta en `docs/store/`.
- CI (GitHub Actions): `ci.yml` (tests + check:games + build), `android-release.yml`, `ios-testflight.yml` (escritos, sin verificar hasta cargar secretos).

## 11. Evolución (fuera de v1)
Vinculación Apple/Google para recuperar cuenta en otro dispositivo · compra "quitar anuncios" · logros · ranking de amigos · verificación de movimientos en servidor · catálogo remoto (revisando 4.7.x) · más idiomas.

## 12. Riesgos
| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Rechazo 4.7/4.2 en App Store | Alto | Juegos embebidos, funciones nativas, §10 |
| Reinstalar pierde la cuenta anónima | Medio | Preferences en Auto Backup/iCloud; vinculación en v2 |
| Trampas en el ranking | Medio | Límites + moderación; verificación futura |
| Plugin AdMob sin probar en dispositivo | Medio | Apagable; IDs de prueba; checklist de dispositivo |
| El juego en diseño cambia durante la integración | Bajo | Snapshot + `import-game` repetible + guía de integración |
| iOS no verificable en este equipo | Medio | CI macOS; reportar como no verificado |

## 13. Qué debe decidir/aportar el usuario (no bloquea el desarrollo)
Nombre final y appId · cuentas Play (USD 25) y Apple (USD 99/año) · dominio/URL de la API en Dokploy · IDs reales de AdMob · URL de política de privacidad · ícono y capturas definitivos · público objetivo (A1) · cuál es el juego piloto definitivo.
