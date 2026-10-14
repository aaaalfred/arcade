# Despliegue de la API en Dokploy

> **Estado: NO está desplegada.** Esta guía describe cómo hacerlo; no se ha tocado ningún servidor, Dokploy ni Cloudflare, y no hay credenciales ni dominio en el repositorio. El `Dockerfile` tampoco se ha podido construir en el equipo de desarrollo (no hay Docker): la primera construcción real será en Dokploy. Ver «Qué no está verificado» al final.

La API (`apps/api`) es un contenedor Node 22 sin estado propio: toda la información vive en Postgres. Los juegos **no** se sirven desde la API (van empaquetados en la app); la API solo lee el `manifest.json` de cada juego para validar tableros y rangos de puntaje.

## Qué necesitas antes

| Qué | Por qué |
|---|---|
| Servidor con Dokploy funcionando | Aloja la app y la base de datos |
| Un dominio o subdominio, p. ej. `api.tudominio.com`, con un registro DNS **A** hacia la IP del servidor | HTTPS obligatorio: la app móvil no hablará con HTTP |
| El repositorio accesible desde Dokploy (proveedor GitHub/GitLab/Git configurado en Dokploy) | Dokploy construye la imagen desde el repo |
| (Opcional) un destino S3 compatible (Cloudflare R2, Backblaze B2, AWS S3…) | Copias de seguridad automáticas de Postgres |

## Paso 1 · Base de datos Postgres

1. En Dokploy, dentro de un proyecto (p. ej. «Arcade»): **Create Service → Database → PostgreSQL**.
2. Nombre de la app (p. ej. `arcade-db`), nombre de base `arcade`, usuario `arcade` y una contraseña larga y aleatoria (`openssl rand -base64 32`). Versión: Postgres 16 o superior.
3. **No** actives el puerto externo: la API se conecta por la red interna de Dokploy.
4. Despliega el servicio y, en su pestaña **General**, copia la **Internal Connection URL**; tendrá esta forma:

   ```
   postgresql://arcade:<contraseña>@<nombre-interno-del-servicio>:5432/arcade
   ```

No hay que crear tablas a mano: la API aplica las migraciones (`src/db/migrations/*.sql`) al arrancar, dentro de una transacción y registrándolas en `schema_migrations`. Es idempotente y seguro si arrancan dos instancias a la vez (candado consultivo).

## Paso 2 · Aplicación Docker desde el repositorio

1. En el mismo proyecto: **Create Service → Application** (p. ej. `arcade-api`).
2. **Provider**: GitHub (o el que uses) → repositorio, rama de producción.
3. **Build Type: Dockerfile** y estos campos (importante: el contexto es la **raíz** del monorepo, porque el lockfile y `packages/protocol` están fuera de `apps/api`):

   | Campo | Valor |
   |---|---|
   | Docker File | `apps/api/Dockerfile` |
   | Docker Context Path | `.` |
   | Docker Build Stage | *(vacío; se construye hasta `runtime`, la última etapa)* |

4. Pestaña **Environment**: define las variables de la tabla siguiente.
5. **Deploy**. En los logs debe verse algo como:

   ```
   [api] Base de datos: Postgres (DATABASE_URL)
   [api] Catálogo: N juego(s) desde /app/games
   [api] Escuchando en el puerto 8787 · CORS extra: 0 · TRUST_PROXY=1 · moderación activada
   ```

   Si hay un `manifest.json` inválido, la API **no arranca** y lo dice con el nombre de la carpeta; es intencionado (mejor que servir un catálogo a medias).

### Variables de entorno

| Variable | Producción | Notas |
|---|---|---|
| `DATABASE_URL` | **obligatoria** | Internal Connection URL del Paso 1. Con ella se usa `pg`. |
| `TRUST_PROXY` | `1` | Dokploy/Traefik va delante: la IP del cliente se toma del primer valor de `x-forwarded-for`. Sin esto, **todos** los jugadores compartirían la IP del proxy y el límite de 10 registros/hora/IP bloquearía a todos. Solo es seguro si el proxy sobrescribe esa cabecera (Traefik lo hace por defecto salvo que se configuren IPs de confianza; compruébalo en el Paso 4). Si pones Cloudflare delante, revisa que la IP que llega sea la real del cliente. |
| `ADMIN_TOKEN` | recomendada | ≥ 16 caracteres aleatorios (`openssl rand -hex 32`). Sin ella la moderación (`/v1/admin/*`) está apagada y responde 404. **Guárdala solo en Dokploy**, nunca en el repo. |
| `INCLUDE_DEV_GAMES` | `0` | `1` solo para entornos de prueba (incluye `sdk-playground`). |
| `CORS_ORIGINS` | normalmente vacía | Orígenes web extra, separados por comas. Los WebViews de la app (`https://localhost` en Android, `capacitor://localhost` en iOS) ya están permitidos siempre. |
| `PORT` | `8787` (por defecto) | Debe coincidir con el puerto del dominio (Paso 3). |
| `GAMES_DIR` | `/app/games` (lo fija el Dockerfile) | No tocar. |
| `NODE_ENV` | `production` (lo fija el Dockerfile) | En producción **no** se permiten los orígenes `http://localhost:*` de desarrollo. |
| `DB_MEMORY` | **no definir** | Base en memoria solo para E2E. La API se niega a arrancar si coincide con `DATABASE_URL`. |

Hay una plantilla comentada en `apps/api/.env.example`.

## Paso 3 · Dominio y HTTPS

1. En la aplicación → pestaña **Domains → Add Domain**:
   - **Host**: `api.tudominio.com`
   - **Path**: `/`
   - **Container Port**: `8787`
   - **HTTPS**: activado, **Certificate Type**: Let's Encrypt.
2. Comprueba que el DNS ya apunta al servidor (registro A) antes de pedir el certificado.
3. Redespliega si Dokploy lo pide. La URL base de la API para la app será `https://api.tudominio.com` (se pasa al shell como `VITE_API_URL` al compilar la app; las rutas cuelgan de `/v1`).

## Paso 4 · Comprobar

```bash
# Salud (sin autenticación): debe responder {"ok":true}
curl -s https://api.tudominio.com/v1/health

# Crear una cuenta anónima de prueba
curl -s -X POST https://api.tudominio.com/v1/auth/anonymous
# → {"playerId":"…","secret":"…","nickname":"Jugador1234"}

# Preflight CORS como lo haría la app de iOS
curl -s -i -X OPTIONS https://api.tudominio.com/v1/me \
  -H 'Origin: capacitor://localhost' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization'
# → 204 con access-control-allow-origin: capacitor://localhost
```

Comprueba también que la API no se fía de una cabecera `x-forwarded-for` inventada por el cliente: desde fuera, 11 registros seguidos con `-H 'x-forwarded-for: 1.2.3.4'` (u otra IP distinta en cada uno) deben acabar en `429`. Si no ocurre, el proxy no está sobrescribiendo la cabecera y el límite por IP se puede esquivar.

El contenedor trae un `HEALTHCHECK` que consulta `/v1/health` cada 30 s.

## Copias de seguridad

Los datos que importan (guardados, puntajes, apodos, reportes) están **solo** en Postgres. Los secretos de los jugadores se guardan como hash SHA-256, pero la base sigue siendo información personal (ids anónimos, apodos): cifra el bucket y limita quién accede.

1. **Destino**: en Dokploy → *Settings → S3 Destinations* → añade tu bucket (endpoint, región, access key, secret key, nombre del bucket).
2. **Programación**: en el servicio Postgres → pestaña **Backups → Create Backup**: destino, base `arcade`, prefijo, cron (p. ej. `0 3 * * *`, diario a las 03:00) y retención.
3. **Prueba de restauración (imprescindible, una vez)**: lanza un backup manual, restáuralo en una base nueva y comprueba que las tablas `players`, `saves`, `scores` existen. Una copia que nunca se ha restaurado no es una copia.
4. Alternativa manual puntual (desde el servidor, con acceso al contenedor de Postgres):

   ```bash
   docker exec <contenedor-postgres> pg_dump -U arcade -Fc arcade > arcade-$(date +%F).dump
   ```

Al borrar una cuenta («Borrar mis datos») sus filas desaparecen de la base, pero siguen existiendo en las copias hasta que caduque su retención. Menciónalo en la política de privacidad si fijas una retención larga.

## Operación

- **Añadir o cambiar un juego**: la API lee los `manifest.json` al arrancar y la imagen solo lleva los manifiestos, así que tras cambiar `games/<id>/manifest.json` hay que **redesplegar** la API (los ids de juego y de tablero son inmutables: son claves en la base).
- **Moderación** (requiere `ADMIN_TOKEN`):

  ```bash
  curl -s -H "x-admin-token: $ADMIN_TOKEN" https://api.tudominio.com/v1/admin/reports
  curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" https://api.tudominio.com/v1/admin/players/<playerId>/hide
  curl -s -X POST -H "x-admin-token: $ADMIN_TOKEN" https://api.tudominio.com/v1/admin/players/<playerId>/unhide
  ```

  Un jugador oculto desaparece de todos los rankings y no cuenta para la posición de los demás; él sigue viendo su propio puntaje (no se entera).
- **Una sola réplica**: los límites de ritmo (30 puntajes/min/jugador, 10 registros/h/IP) viven en memoria del proceso. Con varias réplicas cada una contaría por separado. Para la escala prevista (v1) basta una; si se escala, habría que mover los contadores a Postgres/Redis.
- **Migraciones**: solo hacia delante (`001_…`, `002_…`). Un cambio de esquema compatible con la versión anterior permite desplegar sin cortes; uno incompatible requiere desplegar la API y la app en el orden correcto.
- **Cierre ordenado**: el contenedor atiende `SIGTERM` (Dokploy lo envía al redesplegar), termina las peticiones en curso (máx. 10 s) y cierra el pool de Postgres.
- **Logs**: stdout del contenedor (pestaña *Logs*). La API no registra tokens ni cuerpos de petición; los errores inesperados salen como `[api] error no controlado` y al cliente solo le llega `{"error":"internal"}`. La IP de los jugadores queda en los logs del proxy (Traefik), no en la base de datos.
- **Rollback**: en Dokploy, *Deployments* → redesplegar una versión anterior. Si una migración ya se aplicó, la versión anterior debe ser compatible con ese esquema.

## Probar en local sin Docker

```bash
# Postgres en proceso (PGlite) y juegos de desarrollo; datos en memoria
DB_MEMORY=1 INCLUDE_DEV_GAMES=1 pnpm --filter @arcade/api dev
curl -s localhost:8787/v1/health        # {"ok":true}

# Con datos persistentes en apps/api/.data/pglite
pnpm --filter @arcade/api dev
```

## Qué no está verificado

- El `Dockerfile` (no hay Docker en el equipo de desarrollo). Lo comprobado: `pnpm --filter @arcade/api build` produce `dist/server.js` + `dist/migrations/`, y ese bundle arranca y responde con la disposición de carpetas de la imagen. Lo no comprobado: `docker build`, `pnpm deploy --prod --legacy`, el `HEALTHCHECK` y la ejecución como usuario `node`.
- El adaptador de Postgres real (`pg`): las pruebas usan PGlite (Postgres real compilado a WASM, mismo SQL) y un pool falso para la lógica de transacciones, pero no se ha ejecutado contra un servidor Postgres.
- Todo lo de Dokploy (pantallas y nombres de campos pueden variar ligeramente según la versión), el certificado, el DNS y las copias de seguridad.
