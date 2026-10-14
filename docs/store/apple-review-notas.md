# Notas para el revisor de App Store (App Review Information)

Pega esto en **App Store Connect → App Review Information → Notes** y ajusta lo marcado.

```
Gracias por revisar [[Nombre]].

QUÉ ES
Una colección de juegos de ingenio y rompecabezas desarrollados por nosotros. Todos los juegos están
EMBEBIDOS en el binario de la app (no se descarga código ni contenido ejecutable); funcionan sin conexión.
Se ejecutan dentro de la propia app con WebKit y comparten un SDK propio para guardar partida,
puntajes, vibración (háptica del sistema) y anuncios nativos. No es un portal de software de terceros.

FUNCIONES NATIVAS
Vibración háptica, almacenamiento nativo persistente, bloqueo de orientación por juego, anuncios nativos
(Google AdMob), ranking en línea y sincronización de progreso.

CUENTA
No hay registro ni inicio de sesión: se crea una cuenta anónima al abrir la app. Para borrarla:
Perfil → «Borrar mis datos» (elimina cuenta, progreso y puntajes en el servidor y en el dispositivo).

CONTENIDO GENERADO POR USUARIOS
Los únicos datos visibles para otros jugadores son el apodo y el puntaje en los rankings. Los apodos pasan
por un filtro; cada fila del ranking tiene «Reportar nombre» y el equipo puede ocultar jugadores.

PUBLICIDAD
Google AdMob. Se solicita App Tracking Transparency y, en la UE/Reino Unido, el consentimiento (UMP).
La app funciona igual si se rechaza el seguimiento.

COMPRAS
La app es gratuita y no tiene compras dentro de la app. [[Actualiza si añades «quitar anuncios».]]

CÓMO PROBAR
1. Abre la app y toca un juego en la pantalla «Juegos».
2. Completa el nivel 1 tocando las flechas libres para sacarlas del tablero.
3. Abre la pestaña «Ranking» para ver tu posición y «Perfil» para cambiar tu nombre o borrar tus datos.
Los anuncios solo aparecen entre niveles (como máximo uno cada 90 s) o cuando el jugador pide una ayuda.
```

## Por qué importa este texto
La guía **4.7** permite mini-juegos HTML5 dentro de una app, pero hay revisores que rechazan apps cuyo propósito
principal parece ser «hospedar juegos HTML5». Para reducir el riesgo: (1) los juegos van embebidos y son tuyos,
(2) la app aporta funciones nativas y de servicio (ranking, guardado, perfil, borrado), (3) la calidad y el contenido
son consistentes. Si Apple rechaza por 4.7/4.2, responde en Resolution Center explicando lo anterior y ofrece un
vídeo de uso. Aun así el riesgo no es cero.
