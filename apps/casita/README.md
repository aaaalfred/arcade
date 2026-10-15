# Casita Pastel

Casita de muñecas digital en 2D: tres habitaciones (cocina, sala y dormitorio), dos personajes personalizables y 21 objetos que se pueden arrastrar, sostener, comer y guardar en la bandeja. No tiene puntos, combates ni tiempo límite. Funciona en el navegador, en computadora, tablet y celular, con ratón o con el dedo.

## Cómo iniciarlo

No necesita instalar nada ni conexión a internet.

- **Opción 1:** abre `index.html` con doble clic. En Windows, la ruta es `\\wsl.localhost\Ubuntu\home\imalf\code\games\a\casita\index.html`.
- **Opción 2 (servidor local, para probar desde el celular en la misma red):**
  ```bash
  cd ~/code/games/a/casita
  python3 -m http.server 8080
  ```
  Luego abre `http://localhost:8080` en la computadora, o `http://<IP-de-tu-computadora>:8080` en el celular.

La fuente tipográfica se descarga de Google Fonts si hay conexión. Si no hay, se usa una fuente del sistema y todo lo demás funciona igual.

## Cómo se juega

| Acción | Cómo |
|---|---|
| Mover un personaje u objeto | Arrástralo. Mientras arrastras se marcan los lugares donde se puede soltar. Si lo sueltas en un lugar no válido, regresa solo. |
| Sentar | Suelta al personaje sobre el sofá, el sillón o una silla. |
| Acostar | Suelta al personaje sobre la cama. |
| Dar un objeto | Suéltalo sobre una mano del personaje. Lo que sostiene lo acompaña al moverlo. |
| Dar de comer | Acerca la comida a la boca. La comida se termina en tres mordidas y vuelve a su lugar. |
| Refrigerador, ropero, lámparas | Tócalos para abrir y cerrar, o encender y apagar. |
| Expresiones | Toca a un personaje y elige alegría, tristeza, sorpresa o enojo en el panel de arriba. |
| Vestidor | Botón de la playera: cabello, tono de piel, ropa y accesorios. |
| Cambiar de habitación | Flechas de los lados. También puedes mantener algo arrastrado sobre una flecha. |
| Bandeja | Suelta personajes u objetos en la bandeja de abajo para llevarlos a otra habitación. |
| Sonido | Botón de la bocina. |
| Reiniciar | Botón de la flecha circular. Pide confirmación. |

La partida se guarda sola en el dispositivo (`localStorage`): la apariencia de los personajes, dónde está cada cosa, puertas, lámparas, la habitación actual y el sonido.

## Estructura

```
index.html            Página y contenedores de la interfaz
css/estilos.css       Estilos y animaciones
js/util.js            Colores y primitivas SVG
js/arte/personaje.js  Personaje por piezas (pelo trasero/frontal, cuerpo, ropa, cara, accesorios)
js/arte/objetos.js    Dibujo de los 21 objetos
js/arte/muebles.js    Muebles, fondos de habitación y portada
js/arte/iconos.js     Iconos de la interfaz
js/datos.js           Habitaciones, muebles, zonas para soltar, guardarropa y estado inicial
js/juego.js           Motor: capas, arrastre, zonas, comer, puertas, luces y bandeja
js/editor.js          Vestidor
js/sonido.js          Sonidos sintetizados (Web Audio)
js/guardado.js        Guardado automático y validación de partidas guardadas
js/main.js            Pantalla de inicio y botones
```

## Agregar contenido

- **Objeto nuevo:** añade su dibujo en `js/arte/objetos.js` (`lista`) y su lugar inicial en `OBJETOS_INICIO` de `js/datos.js`. Con `comida: true` se puede comer; con `bebida: true` no se gasta.
- **Mueble nuevo:** añade el dibujo en `arte` de `js/arte/muebles.js` y la entrada en `MUEBLES` de `js/datos.js`. Si debe sostener cosas o sentar personajes, añade sus `ZONAS` (`superficie`, `asiento` o `cama`).
- **Ropa nueva:** añade la opción en `ROPA` de `js/datos.js` y su dibujo en `js/arte/personaje.js`.
- **Habitación nueva:** añade su id en `CUARTOS` y `NOMBRES`, su fondo en `fondos` de `muebles.js`, y sus muebles y zonas.

El personaje de referencia se rehízo como vector por piezas, en lugar de recortar la ilustración plana. Así se puede animar (parpadeo, respiración, comer, saltos) y cambiar cada parte por separado.
