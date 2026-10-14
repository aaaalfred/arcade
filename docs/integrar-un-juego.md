# Cómo integrar un juego HTML en Arcade

Un juego es una carpeta HTML autocontenida. Integrarlo toma **unos 15 minutos** y ~15 líneas de cambio.
El ejemplo real es `games/flechas/` (compáralo con `../flechas-10/` para ver el diff exacto).

## Qué recibe el juego a cambio
- **Guardado de partida** que sobrevive a cerrar la app, funciona sin red y se sincroniza con el servidor.
- **Progreso** visible en la pieza del juego (barra con un tramo por nivel) y en el perfil.
- **Ranking** global y semanal, con tu puesto.
- **Anuncios** gestionados por la app (frecuencia, consentimiento, AdMob). El juego solo los pide.
- **Vibración** que también funciona en iOS.

## Receta (5 pasos)

### 1. Importar la carpeta
```bash
pnpm exec tsx scripts/import-game.mjs ../mi-juego mi-juego
```
Copia el juego a `games/mi-juego/` (sin `gen-*.js`, `*.md`, `node_modules`), añade la etiqueta del SDK y crea un
`manifest.json` con valores por defecto. **No modifica el original.** Para volver a importar usa `--force`
(se conserva el `manifest.json`, pero se pisan tus ediciones al `index.html`: después de importar,
desarrolla el juego directamente en `games/<id>/`).

### 2. Completar `games/mi-juego/manifest.json`
```jsonc
{
  "id": "mi-juego",                 // = nombre de la carpeta; [a-z0-9-], 3–32; NO cambia nunca (es la clave en el servidor)
  "name": "Mi juego",
  "tagline": "Una frase corta",
  "version": "1.0.0",
  "sdk": 1,
  "entry": "index.html",
  "orientation": "portrait",        // portrait | landscape | any
  "theme": {
    "accent": "#3f8a52", "background": "#fdfaf2", "ink": "#2e473f",
    "dark": { "accent": "#5fcf85", "background": "#14201c", "ink": "#cfe3d8" }   // opcional: solo si el juego tiene modo oscuro
  },
  "icon": "icon.svg",               // emoji o ruta a una imagen (png/svg/webp) dentro de la carpeta
  "progress": { "unit": "niveles", "total": 10 },
  "boards": [
    { "id": "stars", "name": "Estrellas totales", "sort": "desc", "min": 0, "max": 30, "integer": true, "unit": "★" }
  ],
  "ads": { "interstitial": true, "rewarded": true },
  "dev": false
}
```
- **`boards`**: cada tablero guarda el **mejor** valor por jugador. Si tu puntaje es un total acumulado
  (estrellas, niveles…), envía el total: solo crece, así que "mejor" basta.
- **`min`/`max`/`integer`**: el servidor **rechaza** lo que quede fuera. Ponlos ajustados al máximo posible real.
- **`sort: "asc"`** para tiempos (menos es mejor).
- Cambiar los tableros requiere **redesplegar la API** (lee los manifiestos al arrancar).

### 3. Cargar el SDK
`import-game` ya lo hace. Debe ir **antes** de tu script:
```html
<script src="../_sdk/arcade-sdk.js" data-game="mi-juego"></script>
```

### 4. Sustituir `localStorage`, anuncios y vibración por `Arcade.*`
```js
// Arranque: espera al SDK y restaura el estado
Arcade.ready().then(function (session) {
  if (session.state) progress = session.state;     // null la primera vez
  buildMenu();
});

// Guardar (no bloquea; hazlo cada vez que cambie el progreso)
Arcade.save(progress, { progress: { value: nivelesCompletados, total: 10 } });

// Puntaje
Arcade.submitScore("stars", totalEstrellas);      // nunca rechaza; offline devuelve { offline: true }

// Anuncios y vibración
Arcade.ads.interstitial();                          // Promise<void>
Arcade.ads.rewarded().then(function (ok) { if (ok) darPista(); });
Arcade.haptic("success");                           // light | medium | heavy | success | error
```

| Antes | Después |
|---|---|
| `localStorage.setItem(KEY, …)` | `Arcade.save(estado, { progress })` |
| `localStorage.getItem(KEY)` | `session.state` de `Arcade.ready()` |
| `Ads.rewarded()` simulado | `Arcade.ads.rewarded()` |
| `navigator.vibrate(25)` | `Arcade.haptic("error")` |
| botón "volver al menú principal" | no hace falta: la app ya tiene su barra con ← |

### 5. Validar y probar
```bash
pnpm check:games --strict          # manifiesto, SDK, sin recursos remotos, sin localStorage/vibrate
pnpm dev:game                      # http://localhost:5174/mi-juego/ — modo standalone (sin app)
pnpm dev:api & pnpm dev:shell      # la app completa en http://localhost:5173
```

## API del SDK (`window.Arcade`)

| Llamada | Qué hace |
|---|---|
| `ready(): Promise<Session>` | Handshake. `Session = { player, state, settings, insets, mode, sdk }` |
| `save(state, { progress })` | Guarda JSON ≤ **64 KB**. No bloquea. Si no es serializable, avisa en consola y no guarda |
| `submitScore(board, value, meta?)` | `Promise<{ accepted, best, rank:{all,weekly}, offline }>`. Nunca rechaza |
| `ads.interstitial()` | Resuelve cuando termina, falla o se omite |
| `ads.rewarded()` | `true` solo si el jugador ganó la recompensa |
| `haptic(kind)` | Vibración |
| `openLeaderboard(board?)` | Abre el ranking de la app |
| `exit()` | Vuelve al catálogo (opcional) |
| `on("pause" \| "resume" \| "settings", fn)` | Eventos de la app. `pause` llega en segundo plano, con el menú abierto o durante un anuncio |

**Modo standalone:** si abres el juego fuera de la app, el SDK usa `localStorage` y anuncios simulados con la misma API.
Si la app no contesta en 3 s, el juego cae a standalone con un aviso en consola.

## Reglas (las verifica `check:games`)
1. **Sin recursos remotos.** Nada de CDN, fuentes web, `fetch` a internet ni enlaces `http(s)://`: el juego va dentro de la app y debe funcionar sin red (también lo exige la App Store).
2. **Sin `localStorage`/`sessionStorage`/`indexedDB` para el progreso.** Usa `Arcade.save`.
3. **Sin `navigator.vibrate`** (no existe en iOS). Usa `Arcade.haptic`.
4. Carpeta ≤ **15 MB**; `manifest.json` válido; `entry` existente; SDK cargado desde `../_sdk/arcade-sdk.js`.
5. Interfaz en español y táctil (≥ 44 px), sin depender del hover.

## Buenas prácticas
- Guarda **al terminar cada nivel**, no en cada frame (el SDK ya coalesce, pero ahorra batería).
- No dependas de que `submitScore` responda: el puntaje se reintenta solo cuando vuelve la red.
- Respeta `pause`: detén música y animaciones; `resume` las reanuda.
- El estado puede venir de **otro dispositivo**: valida su forma antes de usarlo (ver `Arcade.ready()` en `games/flechas/index.html`).
- Si cambias la forma del estado en una versión nueva, mantén compatibilidad con el estado viejo.

## Los otros juegos de `../`
`games.html` lista 12 prototipos con el mismo formato. Cada uno necesita los pasos 1–5. Los que traen
`gen-*.js`/`test*.js` se importan sin ellos. Orden sugerido por simplicidad de integración: los de "niveles + estrellas"
(`arrow-puzzle`, `arrows-escape`, `water-sort`, `number-match`, `screw-puzzle`, `bus-fever`) usan el mismo patrón que Flechas;
`sudoku`, `solitaire`, `2048`, `block-blast` y `wordscapes` guardan estados distintos (tablero en curso, mazo, puntaje) y conviene
decidir qué tableros de ranking tienen sentido (p. ej. mejor puntaje en `2048` y `block-blast`).
