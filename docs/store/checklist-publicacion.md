# Checklist de publicación (Play Store y App Store)

Marca lo que ya tengas. Lo que depende de ti está en **negrita**; lo demás ya está resuelto en el código.

## 0 · Decisiones previas (bloquean la primera subida)
- [ ] **Nombre definitivo de la app** (hoy «Arcade»). Compruébalo en ambas tiendas y en el registro de marcas.
- [ ] **`appId` definitivo** (p. ej. `com.tuempresa.arcade`). No se puede cambiar después de publicar. Ver `build-local.md → Cambiar el appId`.
- [ ] **Público objetivo.** El diseño asume *público general, no dirigido a niños*. Si la app va a ser «para niños» (Google Families / Apple Kids), cambian las reglas de anuncios y datos: avísame antes.
- [ ] **Qué juegos se publican en la v1.** Hoy está integrado `flechas`; hay 11 prototipos más (ver `integrar-un-juego.md`).

## 1 · Cuentas
- [ ] **Google Play Console** — pago único de 25 USD.
  - Cuentas **personales** creadas después del 13-nov-2023: antes de producción hay que hacer una **prueba cerrada con al menos 12 testers durante 14 días seguidos**. Alternativa: cuenta de **organización** (requiere número D-U-N-S, que puede tardar semanas).
- [ ] **Apple Developer Program** — 99 USD/año.
- [ ] **Cuenta de AdMob** y las apps registradas (Android e iOS) → IDs de app y de unidades `interstitial` y `rewarded`.

## 2 · Backend
- [ ] **Dominio** para la API (p. ej. `api.tudominio.com`) y despliegue en Dokploy → `docs/despliegue-api.md`.
- [ ] **`ADMIN_TOKEN`** (≥ 16 caracteres) para poder ocultar jugadores reportados.
- [ ] **Copias de seguridad de Postgres** configuradas.
- [ ] Probar `GET /v1/health` y una cuenta anónima desde internet.

## 3 · Compilación
- [ ] Construir con `VITE_API_URL=https://…`, `VITE_PRIVACY_URL=https://…` y los IDs reales de AdMob (`build-local.md`).
- [ ] **Keystore de Android** creada y respaldada en dos lugares.
- [ ] Probar el build en **dispositivos reales** (Android y iPhone): juego completo, sin red, ranking, borrado de datos, anuncios de prueba, botón atrás, rotación.
- [ ] Sustituir íconos y splash provisionales; capturas de pantalla (ver `ficha-tienda.md`).

## 4 · Play Store
- [ ] Ficha (`ficha-tienda.md`), categoría **Juegos**, correo de contacto.
- [ ] **Política de privacidad** publicada en una URL pública (`politica-privacidad.md`).
- [ ] **Seguridad de los datos (Data safety):** ver tabla abajo.
- [ ] Declaración del **ID de publicidad** (la app usa AdMob: el permiso `AD_ID` ya está en el manifiesto).
- [ ] Cuestionario de **clasificación de contenido** (IARC).
- [ ] **Eliminación de cuenta:** indicar la URL y la ruta dentro de la app (Perfil → Borrar mis datos).
- [ ] Subir el `.aab` firmado a prueba interna → cerrada (12 testers × 14 días si la cuenta es personal) → producción.

## 5 · App Store
- [ ] Registrar la app en App Store Connect con el mismo `appId`.
- [ ] **App Privacy (etiquetas de privacidad):** ver tabla abajo.
- [ ] **ATT:** el texto ya está en `Info.plist`; la ventana la muestra AdMob antes de inicializar.
- [ ] Clasificación por edades (cuestionario).
- [ ] Capturas para iPhone (6,9″ y 6,5″) y, si se publica en iPad, iPad.
- [ ] **Notas para el revisor:** `apple-review-notas.md`.
- [ ] Subir con Xcode 26+ / TestFlight y probar con testers internos antes de enviar a revisión.

## 6 · Cumplimiento (qué cubre la app y qué guía de Apple/Google toca)

| Tema | Guía | Cómo se cubre |
|---|---|---|
| Juegos HTML5 dentro de una app | Apple 4.7 | Los juegos van **empaquetados en el binario** y no descargan código. Riesgo residual: algunos revisores rechazan apps cuyo propósito principal es «hospedar juegos HTML5». Mitigación en `apple-review-notas.md` |
| Funcionalidad mínima | Apple 4.2 | App nativa con háptica, almacenamiento nativo, ranking y anuncios nativos |
| Borrado de cuenta | Apple 5.1.1(v), Play | **Perfil → Borrar mis datos** (borra en el servidor y en el dispositivo) |
| Contenido generado por usuarios (apodos en ranking) | Apple 1.2 | Filtro de nombres, botón **Reportar nombre**, moderación con `ADMIN_TOKEN` |
| Inicio de sesión con terceros | Apple 4.8 | **No aplica**: la cuenta es anónima, sin login social |
| Publicidad y rastreo | Apple 5.1.2, Play Ads | Consentimiento UMP (UE/Reino Unido) y ATT antes de AdMob |
| Target API | Play | targetSdk 36 (exigido desde el 31-ago-2026) |

## 7 · Datos para los formularios de privacidad (borrador a verificar en las consolas)

Datos que la app trata realmente:

| Dato | De dónde sale | Para qué | ¿Se comparte? |
|---|---|---|---|
| Identificador de jugador (UUID aleatorio) | La API al crear la cuenta anónima | Funcionamiento: guardado y ranking | No |
| Apodo (generado o elegido) | El jugador | Mostrarlo en el ranking | Visible para otros jugadores |
| Progreso y partidas guardadas | El juego | Funcionamiento: sincronizar | No |
| Puntajes | El juego | Ranking | Visible (con el apodo) |
| Reportes de apodos | Otros jugadores | Moderación | No |
| ID de publicidad, IP, datos del dispositivo | AdMob (Google) | Publicidad | Sí, con Google AdMob |

**Play · Data safety (borrador):** *Identificadores de dispositivo u otros* (ID de publicidad) → recopilado, compartido con terceros, finalidad Publicidad. *Información personal → Nombre/ID de usuario* → recopilado, no compartido, finalidad Funcionamiento de la app. *Actividad en la app → Interacciones* (progreso, puntajes) → recopilado, no compartido, funcionamiento. Cifrado en tránsito: **sí** (HTTPS). Eliminación: **sí**, desde la app.

**Apple · App Privacy (borrador):** *Identificadores → ID de usuario* (funcionamiento, vinculado al usuario); *Identificadores → ID de dispositivo* (publicidad de terceros); *Uso → Interacción con el producto* y *Contenido del usuario → Contenido de juego* (funcionamiento). Rastreo: **sí** si el jugador acepta ATT con anuncios personalizados.
