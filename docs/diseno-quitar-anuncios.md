# Diseño: pantalla "Quitar anuncios" (solo propuesta)

Estado: **diseño para revisión, nada implementado**. No hay compras ni ruta `#/premium` todavía.
Suscripción mensual propuesta: **$19 MXN**.

## Decisiones pendientes del usuario

1. **Periodo de prueba**: ¿hay prueba gratis (p. ej. 7 días) o se cobra desde el inicio?
2. **Alcance de "sin anuncios"**: ¿incluye también los anuncios recompensados (los que el jugador elige ver a cambio de algo) o solo los intersticiales?
   - Recomendación: quitar los intersticiales y dejar los recompensados como opción voluntaria, con su recompensa regalada a los suscriptores.

## Principios

- Nunca ofrecer la suscripción durante una partida.
- Cerrar siempre visible desde el primer instante; sin cuenta regresiva ni culpa en el texto.
- Precio, periodicidad y cómo cancelar se leen sin hacer scroll.

## Pantalla

Hoja a pantalla completa (misma entrada que `Sheet`, subiendo desde abajo).

```
[ X ]                              (cerrar, arriba a la izquierda, 44 px)

Juega sin anuncios
Un pago pequeño al mes y la app es solo tuya.

✓ Sin anuncios entre partidas
✓ Sin pausas para ver publicidad
✓ Apoyas que sigan llegando juegos

$19 MXN al mes
Se renueva cada mes. Cancela cuando quieras desde Google Play.

[        Suscribirme        ]   (botón principal)
Restaurar compra                (botón de texto)
Términos · Privacidad           (enlaces pequeños)
```

Estados:

| Estado | Qué se ve |
| --- | --- |
| Normal | Lo de arriba |
| Cargando precio | Botón deshabilitado con el precio como esqueleto; no inventar un precio |
| Procesando | Botón con indicador; cerrar sigue disponible |
| Éxito | Check animado + "Listo, ya no verás anuncios"; cierra solo a los 1.5 s |
| Error / cancelado | Aviso breve (toast) y se queda en la pantalla; el cancelado no es un error |
| Ya suscrito | Muestra "Sin anuncios activo" y "Administrar suscripción" (abre Google Play) |
| Sin conexión | Aviso "Necesitas conexión para suscribirte"; el botón se deshabilita |

Movimiento: sube con el mismo `--ease` y `--dur-3` del resto de la app; los tres beneficios entran en cascada de 60 ms; todo respeta `prefers-reduced-motion`.

## Dónde se ofrece (máximo 3 puntos)

1. **Perfil**: fila fija "Quitar anuncios" en la sección de ajustes. Siempre disponible, nunca insistente.
2. **Después de un anuncio intersticial**: enlace pequeño "¿Cansado de anuncios?" en la pantalla del anuncio, no sobre el botón de cerrar.
3. **Home**: tarjeta discreta tras la 5.ª sesión. Se puede descartar y no vuelve a aparecer en 14 días. Nunca en el primer día.

Los suscriptores ven en Perfil "Sin anuncios · Administrar" en lugar de la oferta.

## Anuncios para usuarios gratis

- Intersticiales solo en pausas naturales (fin de partida o de nivel), con un hueco mínimo entre uno y otro (hoy el shell impone 90 s).
- Recompensados siempre opcionales, con la recompensa dicha antes de tocar.
- El anuncio simulado ya tiene espera y botón de cerrar; mantener visible el tiempo restante.

## Textos (es-MX, para `i18n/es.ts`)

- `premium.title`: "Juega sin anuncios"
- `premium.cta`: "Suscribirme"
- `premium.price`: "{price} al mes"
- `premium.legal`: "Se renueva cada mes. Cancela cuando quieras desde Google Play."
- `premium.restore`: "Restaurar compra"
- `premium.active`: "Sin anuncios activo"

## Requisitos para implementarlo después (no hacer aún)

- Billing de Google Play (suscripción), con el precio leído de la tienda, no escrito a mano.
- Estado "premium" en el servicio de anuncios (`services/ads`) que apague intersticiales; verificar el recibo en el servidor.
- Ruta `#/premium` y sus pruebas e2e.
