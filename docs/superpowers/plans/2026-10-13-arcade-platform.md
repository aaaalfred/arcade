# Arcade — Plan de implementación

> **Para quien ejecute:** usar superpowers:executing-plans (o subagent-driven-development) tarea por tarea. Los pasos usan casillas `- [ ]`.

**Objetivo:** app Capacitor para Play Store/App Store que embebe juegos HTML con guardado, progreso y ranking, más la API que lo respalda; el primer juego es el prototipo "Flechas".

**Arquitectura:** monorepo pnpm. `packages/protocol` define contratos (zod); `packages/game-sdk` es el SDK que los juegos cargan en su iframe y que habla con el shell por `postMessage`; `apps/shell` (Vite+Preact+Capacitor) aloja los juegos y sincroniza offline-first con `apps/api` (Hono+Postgres; PGlite en dev/tests).

**Tech stack:** Node 22, pnpm 10, TypeScript 5.9, Vite, Preact, Vitest, Playwright, Hono, `pg`, `@electric-sql/pglite`, zod, Capacitor 8 (+ Preferences, App, Haptics, Screen Orientation, Status Bar, Splash Screen, Network, `@capacitor-community/admob`), esbuild.

**Spec:** `docs/superpowers/specs/2026-10-13-arcade-platform-design.md`

## Restricciones globales (copiadas del spec)
- Capacitor 8: compileSdk/targetSdk 36, minSdk 24, Java 21, Node ≥ 22, Xcode 26+, iOS ≥ 15, SPM.
- Juegos **empaquetados en el binario**; sin recursos remotos; funcionan offline.
- Blob de guardado ≤ **64 KB**. Apodo 3–16 caracteres, único sin distinguir mayúsculas.
- Intersticiales: mínimo **90 s** entre uno y otro, impuesto por el shell.
- Límites: 30 envíos de puntaje/min/jugador; 10 registros/h/IP.
- Periodos de ranking: `all` y semana ISO UTC. Jugadores `hidden` fuera del ranking.
- Interfaz en español (cadenas en `apps/shell/src/i18n/es.ts`). appId provisional `com.example.arcade`, configurable por env `APP_ID`.
- Secretos (keystore, tokens, `ADMIN_TOKEN`) nunca en el repo.
- Commits en español con emoji de convención, **sin** `Co-Authored-By` (preferencia del usuario, skill `commit`).

## Foco de revisión (casos que el spec no nombra y que más probablemente rompan)
1. **Frontera semanal / año ISO:** puntaje enviado el domingo 23:59:59 UTC vs lunes 00:00:00; 31-dic-2026 pertenece a `2026-W53`. → test en Task 5.
2. **Valores de puntaje hostiles:** `NaN`, `Infinity`, `-0`, cadenas, fraccionarios en tablero `integer`, fuera de `[min,max]`. → 400 y nunca se guardan (Task 5).
3. **Mensajes de puente inválidos o de otra ventana:** origen distinto, `source` distinto del iframe, `save` > 64 KB, `state` circular/`undefined`. → se descartan sin romper el shell ni la partida (Tasks 2 y 9).
4. **Colgarse esperando al shell/anuncio:** `Arcade.ads.rewarded()` o `submitScore` sin respuesta deben resolver (`false` / `offline:true`) por timeout; el juego nunca queda bloqueado (Tasks 2 y 9).
5. **Apodos "casi iguales" y borrado:** `ÁNGEL`/`ángel`/`  Ángel `, caracteres de control y emoji; y tras `DELETE /me` el jugador desaparece de ranking, guardados y reportes. → Tasks 4 y 5.

---

## Estructura de archivos

```
arcade/
  package.json · pnpm-workspace.yaml · tsconfig.base.json · vitest.workspace.ts · .gitignore · .npmrc · README.md
  scripts/{check-games.mjs, import-game.mjs, serve-games.mjs, build-sdk.mjs}
  games/{sdk-playground/, flechas/, _sdk/ (generado)}
  packages/protocol/src/{manifest.ts, bridge.ts, api.ts, limits.ts, index.ts}  (+ test/)
  packages/game-sdk/src/{index.ts, host.ts, standalone.ts, types.ts}           (+ test/)
  apps/api/src/{config,catalog,auth,nickname,period,ratelimit,app,server}.ts
  apps/api/src/db/{index,pglite,pg,migrate}.ts · db/migrations/001_init.sql
  apps/api/src/routes/{auth,me,saves,scores,reports,admin,health}.ts           (+ test/)
  apps/shell/src/{main.tsx,App.tsx,router.ts,i18n/es.ts,styles/*.css}
  apps/shell/src/services/{storage,api,auth,sync,ads,native,catalog,store}.ts
  apps/shell/src/bridge/host.ts · screens/{Home,Detail,Play,Ranking,Profile}.tsx
  apps/shell/{vite.config.ts,capacitor.config.ts,playwright.config.ts,e2e/}    (+ android/, ios/)
  docs/{superpowers/*, integrar-un-juego.md, despliegue-api.md, store/*}
  .github/workflows/{ci,android-release,ios-testflight}.yml
```

---

### Task 1: Monorepo y herramientas

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.base.json`, `vitest.workspace.ts`, `.gitignore`, `README.md`.

**Produces:** scripts raíz `pnpm test`, `pnpm typecheck`, `pnpm build:sdk`, `pnpm check:games`, `pnpm dev:api`, `pnpm dev:shell`, `pnpm dev:game`.

- [ ] Crear `pnpm-workspace.yaml` con `packages: ["packages/*","apps/*"]`; `package.json` raíz privado con `engines.node >=22`, devDependencies `typescript@~5.9 vitest @vitest/coverage-v8 esbuild tsx zod@^4`.
- [ ] `tsconfig.base.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution Bundler`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `skipLibCheck`.
- [ ] `.gitignore`: `node_modules`, `dist`, `.data`, `games/_sdk`, `*.keystore`, `*.jks`, `.env*`, `android/app/build`, `ios/App/Pods`, `playwright-report`, `test-results`.
- [ ] Ejecutar `pnpm install`; Esperado: instala sin errores.
- [ ] Commit: `🔧 chore: andamiaje del monorepo`.

### Task 2: `@arcade/protocol` (contratos)

**Files:** Create `packages/protocol/{package.json,tsconfig.json,src/{manifest,bridge,api,limits,index}.ts,test/*.test.ts}`.

**Produces (usado por todos):**
```ts
// limits.ts
export const MAX_SAVE_BYTES = 64 * 1024;
export const NICKNAME_MIN = 3, NICKNAME_MAX = 16;
export const MIN_INTERSTITIAL_GAP_MS = 90_000;
// manifest.ts
export const GameIdSchema: z.ZodString;            // /^[a-z0-9-]{3,32}$/
export const BoardSchema, ManifestSchema;
export type Board = z.infer<typeof BoardSchema>;   // {id,name,sort:'asc'|'desc',min,max,integer,unit?}
export type Manifest = z.infer<typeof ManifestSchema>;
export function parseManifest(input: unknown): Manifest;   // lanza ZodError
// bridge.ts
export const BRIDGE_VERSION = 1;
export type Haptic = 'light'|'medium'|'heavy'|'success'|'error';
export interface Settings { sound: boolean; haptics: boolean; locale: string }
export interface Insets { top: number; right: number; bottom: number; left: number }
export interface PlayerInfo { id: string; nickname: string }
export interface SaveProgress { value: number; total?: number }
export interface Session { player: PlayerInfo|null; state: unknown|null; settings: Settings; insets: Insets; mode: 'host'|'standalone'; sdk: 1 }
export interface ScoreResult { accepted: boolean; best: number; rank: { all: number|null; weekly: number|null }; offline: boolean }
export const GameMessageSchema;  // zod: {arcade:1,id?:string, type, payload?} discriminado por type
export type GameMessage = z.infer<typeof GameMessageSchema>;
export type HostEvent = {type:'pause'}|{type:'resume'}|{type:'settings',payload:Settings};
export interface Reply { arcade: 1; replyTo: string; ok: boolean; payload?: unknown; error?: string }
// api.ts (zod para cuerpos; tipos para respuestas)
export const SetNicknameBody, SaveBody, ScoreBody, ReportBody;
export interface AuthResponse { playerId: string; secret: string; nickname: string }
export interface SaveRecord { gameId: string; rev: number; state: unknown; progress: SaveProgress; updatedAt: string }
export interface SaveResult { rev: number; resolution: 'created'|'updated'|'server-wins'; save: SaveRecord }
export interface BoardEntry { rank: number; nickname: string; value: number; isMe: boolean }
export interface BoardResponse { entries: BoardEntry[]; me: { rank: number; value: number } | null }
```

- [ ] **Tests primero** (`test/manifest.test.ts`, `test/bridge.test.ts`): manifiesto válido pasa y aplica defaults; falla con `id` en mayúsculas, `sdk: 2`, tablero con `max <= min`, color no hex; `GameMessageSchema` acepta `hello/save/score/ad.*/haptic/leaderboard.open/exit` y rechaza `type` desconocido, `arcade: 2`, `score` con `value` no numérico, `haptic.kind` inválido.
- [ ] Ejecutar `pnpm --filter @arcade/protocol test`; Esperado: FALLA (módulos no existen).
- [ ] Implementar los esquemas; los hex aceptan `#rgb`/`#rrggbb`; `BoardSchema.integer` default `true`, `min` default `0`.
- [ ] Ejecutar tests; Esperado: PASAN. Commit: `✨ feat: contratos compartidos (protocol)`.

### Task 3: `@arcade/game-sdk`

**Files:** Create `packages/game-sdk/{package.json,src/{index,host,standalone,types}.ts,test/{host,standalone}.test.ts}`, `scripts/build-sdk.mjs`.

**Consumes:** tipos de Task 2 (solo `import type`; el bundle no incluye zod).
**Produces:** `games/_sdk/arcade-sdk.js` (IIFE, minificado, define `window.Arcade`) y tipos `ArcadeApi`:
```ts
interface ArcadeApi {
  ready(): Promise<Session>;
  save(state: unknown, opts?: { progress?: SaveProgress }): void;
  submitScore(board: string, value: number, meta?: Record<string, unknown>): Promise<ScoreResult>;
  ads: { interstitial(): Promise<void>; rewarded(): Promise<boolean> };
  haptic(kind: Haptic): void;
  openLeaderboard(board?: string): void;
  exit(): void;
  on(event: 'pause'|'resume'|'settings', fn: (payload?: any) => void): () => void;
}
```
Detección: `window.parent !== window` ⇒ modo host; si no, standalone. Timeouts: `hello` 3 s (si vence ⇒ cae a standalone y avisa por `console.warn`), `submitScore` 8 s ⇒ `{accepted:false,best:value,rank:{all:null,weekly:null},offline:true}`, `ads.rewarded` 120 s ⇒ `false`, `ads.interstitial` 120 s ⇒ resuelve.

- [ ] **Tests (jsdom)** con un host falso que responde por `window.postMessage`: `ready()` entrega `Session` con `mode:'host'`; `save` envía exactamente un mensaje `save` y no lanza con `undefined`/circular (los atrapa y `console.warn`); `submitScore` sin respuesta resuelve `offline:true` tras el timeout (fake timers); `ads.rewarded` sin respuesta ⇒ `false`; `on('pause')` recibe el evento del host y el retorno de `on` desuscribe; mensajes con `origin` ajeno o sin `arcade:1` se ignoran; **standalone**: `save` → `ready().state` tras recargar (misma `localStorage`), `submitScore` guarda el mejor local y respeta orden `asc/desc` si el SDK conoce el tablero (en standalone `best` = mejor numérico visto, `desc`), `ads.*` resuelven (`true`) tras 0 ms, `haptic` usa `navigator.vibrate` si existe.
- [ ] Ejecutar tests; Esperado: FALLAN. Implementar `host.ts`/`standalone.ts`/`index.ts`.
- [ ] `scripts/build-sdk.mjs`: esbuild `--bundle --format=iife --minify --target=es2019` → `games/_sdk/arcade-sdk.js`; imprimir tamaño; fallar si > 12 KB.
- [ ] `pnpm build:sdk && pnpm --filter @arcade/game-sdk test`; Esperado: PASAN. Commit: `✨ feat: SDK de juegos (host y standalone)`.

### Task 4: Validador, importador y servidor de juegos

**Files:** Create `scripts/{check-games.mjs,import-game.mjs,serve-games.mjs}`, `scripts/test/check-games.test.mjs`, `games/sdk-playground/{manifest.json,index.html}`.

- [ ] **Tests** de `check-games` sobre carpetas temporales: manifiesto inválido ⇒ error; `entry` inexistente ⇒ error; `http(s)://` en `src=`/`href=`/`url(`/`fetch(` ⇒ error (se permiten `data:`, `blob:` y relativos); falta `arcade-sdk.js` ⇒ error; uso de `localStorage.`/`navigator.vibrate` ⇒ **aviso** (no error, salvo `--strict`); carpeta > 15 MB ⇒ error; id distinto del nombre de carpeta ⇒ error.
- [ ] Implementar `check-games.mjs` (exporta `checkGame(dir)` y CLI `node scripts/check-games.mjs [--strict] [dir…]`; código de salida 1 si hay errores).
- [ ] `import-game.mjs <origen> <id>`: copia sin `gen-*.js`, `*.md`, `node_modules`, `.git`; si no existe `manifest.json` lo genera completo con valores por defecto y lo anuncia por consola; nunca sobrescribe un `manifest.json` existente; ejecuta `checkGame`.
- [ ] `serve-games.mjs`: servidor estático de `games/` en `http://localhost:5174` con tipos MIME correctos y recarga manual (para probar un juego en modo standalone).
- [ ] `games/sdk-playground`: juego de desarrollo (`dev:true`) con botones que ejercitan **cada** llamada del SDK (save/load, submitScore asc/desc, anuncios, háptica, leaderboard, exit) y muestra la `Session`; dos tableros: `taps` (desc, 0–100000) y `fastest` (asc, 1–600, unidad s).
- [ ] `pnpm check:games`; Esperado: OK para `sdk-playground`. Commit: `✨ feat: validador e importador de juegos + sdk-playground`.

### Task 5: API — base de datos, cuentas y apodos

**Files:** Create `apps/api/{package.json,tsconfig.json}`, `src/{config,catalog,auth,nickname,period,ratelimit,app}.ts`, `src/db/{index,pglite,pg,migrate}.ts`, `src/db/migrations/001_init.sql`, `src/routes/{auth,me,health}.ts`, `test/{helpers,auth,nickname,period}.test.ts`.

**Produces:**
```ts
export interface Db { query<T = any>(sql: string, params?: unknown[]): Promise<T[]>; tx<T>(fn: (db: Db) => Promise<T>): Promise<T>; close(): Promise<void> }
export function createPglite(dataDir?: string): Promise<Db>;        // memoria si no hay dataDir
export function createPg(url: string): Db;
export function migrate(db: Db): Promise<void>;
export function loadCatalog(gamesDir: string, opts: { includeDev: boolean }): Promise<Map<string, Manifest>>;
export interface AppDeps { db: Db; catalog: Map<string, Manifest>; config: Config; now?: () => Date }
export function createApp(deps: AppDeps): Hono;                      // monta /v1/*
export function isoWeekKey(d: Date): string;                         // 'YYYY-Www' en UTC
export function normalizeNickname(raw: string): string;              // NFKC, trim, colapsa espacios
export function validateNickname(n: string): { ok: true } | { ok: false; reason: string };
export function generateNickname(rand?: () => number): string;       // 'Jugador4821'
export function hashSecret(secret: string): string;                  // sha256 hex
```
`001_init.sql` crea `players`, `saves`, `scores`, `reports`, `schema_migrations` con las columnas del spec §7, `ON DELETE CASCADE` hacia `players`, índice único `players(lower(nickname))` y el índice de ranking `scores(game_id,board_id,period,value DESC,achieved_at)`.

- [ ] **Tests** (`helpers.ts` crea app con PGlite en memoria y `now` controlable): `POST /v1/auth/anonymous` devuelve `playerId`, `secret` (≥ 32 chars) y apodo `Jugador####`; el secreto **no** se guarda en claro (consulta directa a `players.token_hash`); `GET /v1/me` con `Bearer id.secret` ok, con secreto erróneo 401, sin cabecera 401; `PATCH /v1/me`: acepta `Ángel`, rechaza 2 y 17 caracteres, rechaza controles/ceros de ancho cero, normaliza `"  Ángel   López "`→`Ángel López`, **rechaza `ÁNGEL` si existe `ángel`** (409), filtra lista de palabras prohibidas (es/en, comparación sin acentos y con sustituciones `0→o,1→i,3→e,4→a,5→s,@→a`), permite al dueño re-guardar su propio apodo; límite de 10 registros/h/IP ⇒ el 11º da 429; `isoWeekKey`: `2026-10-04T23:59:59Z`→`2026-W40`, `2026-10-05T00:00:00Z`→`2026-W41`, `2026-12-31`→`2026-W53`, `2027-01-03`→`2026-W53`, `2027-01-04`→`2027-W01`.
- [ ] Ejecutar; Esperado: FALLAN. Implementar `db/*`, `migrate` (aplica `*.sql` por orden dentro de transacción y registra), `auth` (middleware `requirePlayer` que actualiza `last_seen_at` como máximo 1/min), rutas y `ratelimit` (ventana deslizante en memoria con `now` inyectable).
- [ ] Ejecutar tests; Esperado: PASAN. Commit: `✨ feat(api): cuentas anónimas, apodos y migraciones`.

### Task 6: API — guardados, puntajes, ranking, reportes y moderación

**Files:** Create `src/routes/{saves,scores,reports,admin}.ts`, `test/{saves,scores,boards,reports,admin,delete}.test.ts`; Modify `src/app.ts`.

**Consumes:** Task 2 (esquemas), Task 5 (`createApp`, `Db`, `isoWeekKey`).

Reglas:
- `PUT /v1/games/:id/save`: 404 juego desconocido; 413 si `JSON.stringify(state)` > 64 KB; sin registro ⇒ `created` (rev 1). Con registro: si `baseRev === rev` ⇒ `updated` (rev+1). Si `baseRev !== rev`: incoming `progress.value` **mayor** ⇒ `updated`; **menor** ⇒ 409 con `{resolution:'server-wins', save}`; **igual** ⇒ `updated`. `progress.value` entero ≥ 0.
- `POST /v1/games/:id/scores`: valida tablero del manifiesto; `Number.isFinite`, `integer` si aplica, `min ≤ v ≤ max`; actualiza `period='all'` y `period=isoWeekKey(now)` sólo si mejora según `sort`; `rank` = 1 + jugadores `visibles` con mejor valor o igual valor y `achieved_at` anterior; responde `accepted` (true si mejoró algún periodo) y `best` (de `all`).
- `GET /v1/games/:id/boards/:board?period&limit`: `limit` 1–100 (def. 50); top N con `row_number()`; `me` aun fuera del top; `weekly` usa la semana actual; excluye `hidden`.
- `POST /v1/reports`: `{targetPlayerId, reason ≤ 200}`; no puede reportarse a sí mismo; 1 reporte/objetivo/reportante.
- Admin: `ADMIN_TOKEN` en `x-admin-token` (comparación en tiempo constante; si no hay `ADMIN_TOKEN` configurado ⇒ 404); `POST /admin/players/:id/hide|unhide`, `GET /admin/reports`.
- `DELETE /v1/me`: borra jugador (cascade) y reportes donde participa.

- [ ] **Tests**: guardado nuevo/actualizado/stale con progreso mayor, menor, igual; 413 con estado de 65 KB; 404 juego; `GET /saves` devuelve sólo los míos; puntajes `desc` y `asc` (peor puntaje no reemplaza al mejor, `accepted:false`); **hostiles** `NaN`(JSON no lo permite ⇒ se prueba `null`, `"12"`, `1e309`→`Infinity`), `-0` (se normaliza a `0` o se rechaza si `min>0`), fraccionario en `integer`, `max+1`, `min-1` ⇒ 400 y sin filas nuevas; **empates** (mismo valor, quien llegó antes va primero); **frontera semanal** (reloj inyectado 2026-10-04T23:59:59Z vs 2026-10-05T00:00:00Z ⇒ periodos distintos, el `all` conserva el mejor); `me` fuera del top con 120 jugadores y `limit=10`; jugador oculto no aparece y no cuenta para el rank de otros; **borrado**: tras `DELETE /me` su fila desaparece del ranking, su token da 401, y sus guardados/puntajes/reportes ya no existen; 31º envío en un minuto ⇒ 429; admin sin token 404/401, con token oculta y des-oculta; reporte duplicado ⇒ 200 idempotente.
- [ ] Ejecutar; FALLAN → implementar → PASAN (`pnpm --filter @arcade/api test`). Commit: `✨ feat(api): guardados, puntajes, ranking, reportes y moderación`.

### Task 7: API — servidor, Docker y despliegue

**Files:** Create `apps/api/src/server.ts`, `apps/api/Dockerfile`, `apps/api/.env.example`, `docs/despliegue-api.md`.

- [ ] `server.ts`: lee env (`PORT=8787`, `DATABASE_URL` opcional ⇒ si falta usa PGlite en `.data/pglite`, `GAMES_DIR`, `ADMIN_TOKEN`, `INCLUDE_DEV_GAMES=0|1`, `CORS_ORIGINS`, `TRUST_PROXY=1`), migra, sirve con `@hono/node-server`, cierra limpio con SIGTERM.
- [ ] `Dockerfile` multi-etapa (node:22-alpine; copia `games/*/manifest.json`), usuario no root, `HEALTHCHECK`; `pnpm --filter @arcade/api build` con `tsup` a `dist/server.js`.
- [ ] Probar localmente: `pnpm dev:api` y `curl -s localhost:8787/v1/health`; Esperado: `{"ok":true}`.
- [ ] `docs/despliegue-api.md`: pasos Dokploy (aplicación Docker desde el repo, Postgres de Dokploy, variables, dominio+HTTPS, copia de seguridad); **no se despliega** sin credenciales/dominio del usuario.
- [ ] Commit: `🚀 feat(api): servidor, Dockerfile y guía de despliegue`.

### Task 8: Shell — andamiaje, catálogo y diseño

**Files:** Create `apps/shell/{package.json,tsconfig.json,vite.config.ts,index.html}`, `src/{main.tsx,App.tsx,router.ts}`, `src/i18n/es.ts`, `src/styles/{tokens,base}.css`, `src/services/catalog.ts`, `src/vite-games-plugin.ts`.

**Produces:**
```ts
export interface CatalogGame { manifest: Manifest; baseUrl: string }   // baseUrl '/games/<id>/'
export function getCatalog(): CatalogGame[];                            // sin dev si import.meta.env.PROD
export type Route = { name: 'home' } | { name: 'game'; id: string } | { name: 'play'; id: string } | { name: 'ranking'; id?: string } | { name: 'profile' };
export function navigate(r: Route): void; export const route: Signal<Route>;   // hash router
export const t: (key: keyof typeof es, vars?: Record<string, string|number>) => string;
```
`vite-games-plugin`: en dev sirve `/games/**` desde `../../games`; en build copia `games/` a `dist/games` excluyendo juegos `dev:true` y archivos que `check-games` rechaza. `catalog.ts` usa `import.meta.glob('../../../../games/*/manifest.json', {eager:true})` validado con `parseManifest`.

- [ ] Invocar la skill `frontend-design` antes de escribir CSS y fijar la dirección visual (oscuro, acento por juego, tipografía propia vía `@font-face` empaquetada — **sin** CDN).
- [ ] Test de `catalog`: filtra `dev` en producción, falla con manifiesto inválido; `router`: ida y vuelta hash↔Route.
- [ ] `pnpm --filter @arcade/shell build`; Esperado: `dist/` con `index.html` y `games/` sin `sdk-playground` en prod. Commit: `✨ feat(shell): andamiaje, catálogo y tokens de diseño`.

### Task 9: Shell — servicios (storage, api, auth, sync)

**Files:** Create `src/services/{storage,api,auth,sync,store}.ts`, `test/{storage,api,auth,sync}.test.ts`.

**Produces:**
```ts
export interface KV { get(k: string): Promise<string|null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void> }
export function createKV(): KV;                                 // Preferences en nativo, localStorage en web (try/catch)
export interface ApiClient { auth(): Promise<AuthResponse>; me(): Promise<PlayerInfo>; setNickname(n: string): Promise<PlayerInfo>;
  getSaves(): Promise<SaveRecord[]>; putSave(gameId: string, body: SaveBody): Promise<SaveResult>;
  postScore(gameId: string, body: ScoreBody): Promise<ScoreResult>; getBoard(gameId: string, board: string, period: 'all'|'weekly', limit?: number): Promise<BoardResponse>;
  report(targetPlayerId: string, reason: string): Promise<void>; deleteMe(): Promise<void> }
export function createApiClient(opts: { baseUrl: string; kv: KV; fetch?: typeof fetch; timeoutMs?: number }): ApiClient;
export interface Store { /* signals */ player: Signal<PlayerInfo|null>; online: Signal<boolean>; progress: Signal<Record<string, SaveProgress>>; syncing: Signal<boolean> }
export interface SyncEngine { loadLocal(gameId: string): Promise<{ state: unknown|null; rev: number; progress: SaveProgress|null }>;
  saveLocal(gameId: string, state: unknown, progress?: SaveProgress): Promise<void>;
  recordScore(gameId: string, board: Board, value: number, meta?: unknown): Promise<ScoreResult>;
  pullGame(gameId: string, timeoutMs: number): Promise<void>; flush(): Promise<void>; wipe(): Promise<void> }
export function createSyncEngine(deps: { kv: KV; api: ApiClient; store: Store; catalog: Map<string, Manifest>; now?: () => number }): SyncEngine;
```
Reglas del outbox: clave `outbox:save:<game>` (último estado) y `outbox:score:<game>:<board>` (mejor valor según `sort`); `flush()` es idempotente y tolera fallos de red (reintento exponencial 2 s→5 min, tope); `saveLocal` rechaza (lanza) > 64 KB; si `putSave` da 409 ⇒ adopta el guardado del servidor localmente; si da 401 ⇒ `auth.register()` otra vez y reintenta una vez; `recordScore` devuelve `offline:true` si no pudo enviar y conserva el mejor local; `wipe()` limpia KV propio (borrado de datos).

- [ ] **Tests** con `fetch` falso: registro sólo cuando hay red y una sola vez (credenciales persisten en KV); `saveLocal` ×5 seguidos ⇒ 1 entrada en outbox; offline ⇒ `flush` no pierde nada, online ⇒ sube y vacía; 409 ⇒ estado local reemplazado y `progress` actualizado; 401 ⇒ re-registro único; dos `recordScore` (3 y 7, `desc`) ⇒ outbox guarda 7; `asc` guarda el menor; `pullGame` respeta el tope de tiempo (fake timers) y no lanza offline; `wipe` deja el KV vacío de claves `arcade:*`.
- [ ] FALLAN → implementar → PASAN. Commit: `✨ feat(shell): servicios de almacenamiento, API y sincronización offline-first`.

### Task 10: Shell — puente host, anuncios y nativo

**Files:** Create `src/bridge/host.ts`, `src/services/{ads,native}.ts`, `test/{host,ads}.test.ts`.

**Produces:**
```ts
export interface AdsService { init(): Promise<void>; interstitial(game: Manifest): Promise<void>; rewarded(game: Manifest): Promise<boolean> }
export function createAds(deps: { impl: AdsImpl; now?: () => number; enabled: boolean }): AdsService;   // aplica el hueco de 90 s y flags del manifiesto
export interface AdsImpl { init(): Promise<void>; showInterstitial(): Promise<void>; showRewarded(): Promise<boolean> }
export class SimulatedAds implements AdsImpl {}   export class AdMobAds implements AdsImpl {}
export interface Native { haptic(kind: Haptic, enabled: boolean): void; lockOrientation(o: Manifest['orientation']): Promise<void>; unlockOrientation(): Promise<void>;
  onBackground(fn: (bg: boolean) => void): () => void; onBackButton(fn: () => void): () => void; insets(): Insets }
export interface HostHandle { dispose(): void; pause(): void; resume(): void }
export function attachGameHost(deps: { iframe: HTMLIFrameElement; manifest: Manifest; sync: SyncEngine; ads: AdsService; native: Native;
  store: Store; settings: () => Settings; onExit: () => void; onLeaderboard: (board?: string) => void; origin?: string }): HostHandle;
```
`host.ts`: valida `event.source === iframe.contentWindow` y `event.origin === origin ?? location.origin` y `GameMessageSchema`; responde a `hello` con `Session` (estado local + `pullGame` previo con tope 1,5 s); `save` ⇒ `sync.saveLocal` (errores ⇒ `Reply ok:false`, no se propaga); `score` ⇒ `sync.recordScore` usando el `Board` del manifiesto (tablero desconocido ⇒ `ok:false`); anuncios ⇒ `pause()` antes y `resume()` después (en `finally`) y timeout 120 s; mensajes inválidos ⇒ `console.warn` y descartados; `dispose` quita listeners y desbloquea orientación.
`AdMobAds`: IDs de **prueba** de Google salvo `VITE_ADMOB_*` definidos; `init` = UMP consent → ATT (iOS) → initialize; cualquier fallo ⇒ degrada a "sin anuncios" (resuelve `false`/`void`), nunca bloquea.

- [ ] **Tests** `host` con iframe de jsdom y `postMessage` simulado: handshake devuelve `Session`; mensaje con `source` distinto, `origin` ajeno, `save` de 65 KB, JSON inválido ⇒ sin respuesta/`ok:false` y el host sigue vivo; `ad.rewarded` pausa y reanuda aun si la implementación lanza; `score` de tablero inexistente ⇒ `ok:false`; `dispose` ⇒ ya no responde. **Tests `ads`**: segundo intersticial a 30 s ⇒ no se muestra; a 91 s ⇒ sí; `manifest.ads.interstitial=false` ⇒ nunca; `enabled=false` ⇒ `rewarded` devuelve `false` sin tocar la impl.; la impl. que cuelga >120 s ⇒ resuelve.
- [ ] FALLAN → implementar → PASAN. Commit: `✨ feat(shell): puente host, anuncios y servicios nativos`.

### Task 11: Shell — pantallas

**Files:** Create `src/screens/{Home,Detail,Play,Ranking,Profile}.tsx`, `src/components/{GameCard,Sheet,Toast,TopBar,Tabs,ProgressBar,SimulatedAdOverlay}.tsx`; Modify `App.tsx`, `main.tsx`.

- [ ] **Home:** rejilla de `GameCard` (icono, nombre, acento, barra de progreso `N/total unidad`, etiqueta de estado Nuevo/En progreso/Completado) + fila "Continuar" con el último juego (clave `arcade:last`). Estado desde `store.progress`.
- [ ] **Detail:** progreso, mejores puntajes locales, botón Jugar, acceso a Ranking.
- [ ] **Play:** `<iframe src={baseUrl+entry}>` dentro de contenedor con paddings de área segura y fondo `theme.background`; `TopBar` fina (← / título / 🏆 / ⚙); pantalla de carga con el acento; al montar `lockOrientation`, al desmontar `unlockOrientation` y `dispose`; botón atrás de Android abre menú (Reanudar / Ranking / Sonido / Salir) y pausa el juego; error de carga ⇒ mensaje con "Reintentar".
- [ ] **Ranking:** selector de juego → tablero → Global/Semanal; lista con tu fila fijada abajo si estás fuera del top; estado vacío, estado sin red (último caché + aviso), botón "Reportar" por fila (con confirmación).
- [ ] **Profile:** apodo (editar con errores del servidor traducidos: corto/largo/en uso/no permitido), estadísticas (juegos jugados, estrellas/progreso total), interruptores sonido y háptica (`arcade:settings`, se propagan al juego con evento `settings`), enlace a política de privacidad (`VITE_PRIVACY_URL`), **Borrar mis datos** (doble confirmación ⇒ `api.deleteMe` + `sync.wipe` + volver a Home).
- [ ] Accesibilidad: objetivos táctiles ≥ 44 px, `aria-label` en iconos, contraste AA, `prefers-reduced-motion`.
- [ ] `pnpm --filter @arcade/shell typecheck && build`; Esperado: sin errores. Commit: `✨ feat(shell): pantallas de juegos, ranking y perfil`.

### Task 12: E2E con Playwright

**Files:** Create `apps/shell/playwright.config.ts`, `apps/shell/e2e/{helpers.ts,flow.spec.ts,offline.spec.ts,delete.spec.ts,pilot.spec.ts}`.

Configuración: `webServer` levanta `apps/api` (PGlite en memoria, `INCLUDE_DEV_GAMES=1`) y `vite preview` del shell construido con `VITE_API_URL=http://localhost:8787` e `INCLUDE_DEV_GAMES`; viewport 390×844, `isMobile`, `hasTouch`.

- [ ] **flow:** primer arranque ⇒ aparece la rejilla; abrir `sdk-playground` ⇒ `Session.player` no nulo; `save` + recarga de página ⇒ el estado vuelve; `submitScore(taps, 42)` ⇒ en Ranking aparece la fila propia con 42 y `isMe`; cambiar apodo ⇒ se refleja en el ranking.
- [ ] **offline:** `context.setOffline(true)` ⇒ jugar y puntuar sigue funcionando (`offline:true`); `setOffline(false)` ⇒ en ≤ 10 s el puntaje aparece en el ranking del servidor (consultar por API).
- [ ] **delete:** "Borrar mis datos" ⇒ la API responde 401 con el token anterior y el ranking ya no muestra al jugador.
- [ ] **pilot:** cargar `flechas` en el iframe, esperar `canvas`, completar el nivel 1 tocando las flechas libres según `window` (usa `Logic.freeArrows` expuesto por la página) ⇒ el progreso del nivel 1 aparece en Home y `submitScore(stars)` llega al ranking. (Se implementa tras Task 13.)
- [ ] `pnpm --filter @arcade/shell e2e`; Esperado: PASAN. Commit: `✅ test(shell): E2E de arranque, offline, ranking y borrado`.

### Task 13: Juego piloto "Flechas" + guía de integración

**Files:** Create `games/flechas/{manifest.json,index.html,logic.js,levels.js}`, `docs/integrar-un-juego.md`.

- [ ] `node scripts/import-game.mjs ../flechas-10 flechas` (el origen **no se modifica**).
- [ ] Editar sólo la copia: añadir `<script src="../_sdk/arcade-sdk.js" data-game="flechas"></script>` antes de `logic.js`; reemplazar `const Ads = {...}` por `const Ads = { interstitial: () => Arcade.ads.interstitial(), rewarded: () => Arcade.ads.rewarded() }`; reemplazar la carga/guardado de `localStorage` por `await Arcade.ready()` (usar `session.state` como `progress`) y `Arcade.save(progress, {progress:{value: nivelesCompletados, total: 10}})`; en `finish(true)` llamar `Arcade.submitScore('stars', totalEstrellas)`; sustituir `navigator.vibrate(25)` por `Arcade.haptic('error')`; añadir botón/atajo `Arcade.exit()` en el menú de niveles.
- [ ] `manifest.json`: `id flechas`, `progress.total 10`, tablero `stars` (`desc`, 0–30, entero, unidad ★), colores del juego (`--green #3f8a52`, `--ink #2e473f`).
- [ ] `pnpm check:games --strict`; Esperado: sin errores ni avisos.
- [ ] `docs/integrar-un-juego.md`: receta de 5 pasos con el diff exacto anterior, tabla de la API, reglas §5.4, cómo probar standalone (`pnpm dev:game`) y cómo reimportar cuando el juego original cambie.
- [ ] Completar `e2e/pilot.spec.ts`. Commit: `✨ feat: integrar juego piloto Flechas + guía de integración`.

### Task 14: Capacitor — Android e iOS

**Files:** Create `apps/shell/capacitor.config.ts`, `apps/shell/android/**`, `apps/shell/ios/**`, `apps/shell/resources/{icon.svg,splash.svg}`, `docs/store/build-local.md`.

- [ ] `capacitor.config.ts`: `appId: process.env.APP_ID ?? 'com.example.arcade'`, `appName: 'Arcade'`, `webDir: 'dist'`, `server.androidScheme: 'https'`, plugins (`SplashScreen`, `Keyboard`, `StatusBar`).
- [ ] `pnpm --filter @arcade/shell exec cap add android` y `cap add ios` (SPM por defecto; puede fallar el paso de CocoaPods/Xcode en Linux ⇒ aceptable si la carpeta se crea; anotarlo).
- [ ] Ícono y splash provisionales (SVG simple) y `@capacitor/assets generate`.
- [ ] Android: `AndroidManifest` con `allowBackup=true`, `usesCleartextTraffic=false` (debug lo habilita vía `network_security_config` sólo para `10.0.2.2`), orientación por defecto `unspecified` (el shell la fija por juego), `<meta-data com.google.android.gms.ads.APPLICATION_ID>` con el ID de **prueba** de Google.
- [ ] iOS: `Info.plist` con `GADApplicationIdentifier` de prueba, `NSUserTrackingUsageDescription` (texto en español), `SKAdNetworkItems` de Google, `UIRequiresFullScreen` no, orientaciones soportadas.
- [ ] Instalar toolchain Android en `~/Android/Sdk` (cmdline-tools oficiales de Google, licencias, `platforms;android-36`, `build-tools;36.0.0`) en un directorio nuevo y vacío; `export ANDROID_HOME`.
- [ ] `pnpm --filter @arcade/shell build && cap sync android && (cd android && ./gradlew assembleDebug)`; Esperado: `app-debug.apk`. Si falla por red/entorno, registrarlo con el error exacto en `docs/store/build-local.md`.
- [ ] `docs/store/build-local.md`: comandos Android (debug/release/firma), iOS en macOS (Xcode 26, `cap sync ios`, archivar), variables `VITE_*`/`APP_ID`. Commit: `📱 feat: proyectos Capacitor Android e iOS`.

### Task 15: CI, documentación de tienda y datos legales

**Files:** Create `.github/workflows/{ci,android-release,ios-testflight}.yml`, `docs/store/{checklist-publicacion.md,ficha-tienda.md,politica-privacidad.md,apple-review-notas.md}`.

- [ ] `ci.yml`: Node 22 + pnpm; `typecheck`, `test`, `check:games --strict`, `build`, E2E con Chromium de Playwright.
- [ ] `android-release.yml`: JDK 21, build, `bundleRelease` firmado con secretos (`ANDROID_KEYSTORE_B64`, `…_PASSWORD`, `…_ALIAS`), sube artefacto `.aab`.
- [ ] `ios-testflight.yml`: runner macOS con Xcode 26, `cap sync ios`, archivar y subir a TestFlight con App Store Connect API key (secretos); marcado como **sin verificar** hasta cargar secretos.
- [ ] `checklist-publicacion.md`: cuentas, appId definitivo, firma, Data Safety / App Privacy (tabla de datos reales), clasificación por edad, prueba cerrada (12 testers × 14 días), UMP/ATT, capturas, política, soporte, enlaces a las guías de Apple 4.2/4.7/5.1.1/1.2 y a las políticas de Play.
- [ ] `politica-privacidad.md`: plantilla en español con los datos realmente tratados y **campos a completar marcados con `[[…]]`** (titular, contacto, URL); `apple-review-notas.md`: texto sugerido para el revisor (juegos embebidos, propósito, cuenta anónima, borrado de datos, reportes).
- [ ] Commit: `👷 ci: workflows y documentación de publicación`.

### Task 16: Verificación final y revisión

- [ ] `pnpm typecheck && pnpm test && pnpm check:games --strict && pnpm --filter @arcade/shell build && pnpm --filter @arcade/shell e2e`; Esperado: todo verde. Pegar la salida real en el informe final.
- [ ] Arrancar API + shell en dev y abrir en Chromium móvil: probar a mano el flujo de Flechas y capturar pantalla (revisar maquetación y áreas seguras).
- [ ] Skill `superpowers:verification-before-completion`; luego un revisor nuevo (`/code-review`) sobre toda la rama; corregir hallazgos reales.
- [ ] Actualizar `README.md` (arranque rápido, estructura, comandos) y `docs/` con lo que **no** quedó verificado (iOS, AdMob en dispositivo, despliegue real).
- [ ] Commit final y aviso al usuario con: qué está listo, qué se verificó y cómo, qué falta y qué debe decidir.

---

## Autorrevisión
- **Cobertura del spec:** §5 contrato ⇒ Tasks 2, 3, 4; §6 shell ⇒ 8–11; §7 API ⇒ 5–7; §8 seguridad/privacidad ⇒ 5, 6, 10, 15; §9 pruebas ⇒ en cada Task + 12; §10 build/publicación ⇒ 14, 15; criterio 1 (integrar con 3 líneas) ⇒ 13; criterio 4 ⇒ 14. Sin huecos.
- **Consistencia de tipos:** `Session`, `ScoreResult`, `SaveProgress`, `Board`, `Manifest` se definen una vez (Task 2) y se reutilizan igual en 3, 9, 10. `SyncEngine.recordScore` (Task 9) es lo que llama `host.ts` (Task 10).
- **Desviación consciente de la plantilla:** el plan da contratos y casos de prueba exactos, pero no pega el código completo de cada implementación (lo escribe quien ejecuta, que es la misma sesión), para no duplicar miles de líneas.

## Ejecución
Sin método impuesto por el usuario y con autorización previa para desarrollar: **ejecución nativa** en esta sesión. La API (Tasks 5–7) es independiente del shell una vez cerrado `protocol` (Task 2), así que se delega a un subagente en paralelo con un brief que incluye este plan y el spec; el resto lo hago yo. Revisión final por un revisor nuevo sobre toda la rama (Task 16).

---

## Desviaciones respecto al plan (registradas al implementar)

| # | Plan | Realidad | Por qué |
|---|------|----------|---------|
| 1 | Pantalla «Detalle» de juego | **Eliminada**: tocar una pieza abre el juego; el progreso y el puesto se ven en la pieza, el ranking en su pestaña | Menos fricción y menos superficie (YAGNI) |
| 2 | Outbox con claves `outbox:save:<juego>` | El guardado local lleva un indicador `dirty` + `seq` en `save:<juego>`; los puntajes llevan `pending` en `score:<juego>:<tablero>` | Misma coalescencia con menos estado; `seq` evita marcar como limpio un guardado hecho durante la subida |
| 3 | `SyncEngine.pullGame(gameId, ms)` | `pull(ms)` trae **todos** los guardados en una llamada | `GET /saves` ya devuelve todos |
| 4 | `BoardEntry { rank, nickname, value, isMe }` | Añade `playerId` | Necesario para «Reportar nombre» |
| 5 | Tema por juego: una paleta | `theme.dark` **opcional** | Flechas tiene modo oscuro propio; sin ello la barra del shell desentona |
| 6 | Playwright `webServer` | `globalSetup` propio (`e2e/global-setup.ts`) | En este WSL un puerto IPv4 cerrado no rechaza (se cuelga 20 s): la sonda de Playwright tardaba 135 s por servidor. Suite de ~4,6 min → **~15 s** |
| 7 | API: `POST /auth/anonymous` ⇒ 200, `GET /saves` con resumen | 201; arreglo directo de guardados completos; errores `{error, message}` con códigos estables | Decisiones del subagente de la API, verificadas por los E2E |
| 8 | `build` de la API con `tsup --noExternal` | `tsup.config.ts` con `noExternal` y copia de migraciones | El flag no existe en tsup 8.5 |
| 9 | Íconos de juego solo emoji | Emoji **o** ruta de imagen (`icon.svg`) | Los emoji dependen de la fuente del dispositivo; Flechas usa SVG |
| 10 | Parches nativos a mano | `apps/shell/scripts/patch-native.mjs` idempotente (AdMob, ATT, red de depuración, firma, versionado) | Reproducible tras `cap add`/`cap sync` y al cambiar el `appId` |
| 11 | `xcodebuild`/CI de iOS verificados | **Solo escritos**; iOS no se pudo compilar (sin macOS) | Límite del entorno |
