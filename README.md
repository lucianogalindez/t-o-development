# T&O Development Group LLC — Landing

Sitio web de una sola página para **T&O Development Group LLC**, una firma de desarrollo e inversión inmobiliaria con base en Rhode Island. Construido como un sitio estático (HTML/CSS/JS, sin build) a partir de un diseño de Claude Design.

**En producción**: [tandodevelopmentgroup.com](https://tandodevelopmentgroup.com) — dominio propio (GoDaddy) apuntado a Netlify (`www` redirige al apex).

## Características

- **Hero controlado por scroll** — la sección hero queda fija (`position: sticky`) dentro de un contenedor alto; un único valor de progreso (0→1) sincroniza tres cosas:
  - **Scrub por secuencia de frames (canvas)** — técnica estilo Apple: se precargan 96 JPEG (`assets/frames/frame_001..096.jpg`, día → atardecer) y el scroll dibuja el frame correspondiente en un `<canvas>` (`object-fit: cover`, nítido en retina vía `devicePixelRatio`), suavizado con `requestAnimationFrame` + lerp. Fluido en desktop y móvil. El póster (`assets/poster-daydusk.jpg`) es la pintura inicial hasta que cargan los frames (nunca queda en negro).
  - **Cross-fade del titular** — 4 mensajes que se funden según el progreso.
  - **Resaltado de fase** — la fase activa (01–04) se enciende en rojo y las demás se atenúan.
- **Secciones**: Hero · Posicionamiento · Approach · Process · About · Contact · Footer. (La galería de *Projects* y la fila de *cifras* se quitaron por ahora — ver notas.)
- **Responsive** (escritorio / tablet / móvil) con encuadre del video ajustado en pantallas angostas.
- **Detalles**: header transparente sobre el hero que pasa a sólido al hacer scroll, scroll-reveal de bloques editoriales, scroll-spy en el nav, foco visible accesible y respeto por `prefers-reduced-motion`.

## Estructura

```
index.html                 # marcado y estilos inline (fieles al diseño)
styles.css                 # estados :hover/:focus, responsive, keyframes, hero por scroll
script.js                  # lógica (hero por scroll, header, reveal, menú, formulario)
assets/
  frames/                  # 96 JPEG del hero (frame_001..096), día -> atardecer
  poster-daydusk.jpg       # pintura inicial del hero hasta que cargan los frames
  logo.png                 # logo oscuro (header sólido)
  logo-light.png           # logo claro (sobre el hero)
.claude/static-server.cjs  # servidor estático local sin dependencias (para previsualizar)
.claude/launch.json        # config de preview
```

## Previsualizar localmente

El video del hero solo se reproduce servido por HTTP (no con `file://` / doble clic). Con Node instalado:

```bash
node .claude/static-server.cjs
# abre http://localhost:4321
```

O con cualquier servidor estático (p. ej. `npx serve`).

## Pendiente / notas

- **Datos de contacto reales** ya integrados: `info@tandodevelopmentgroup.com`, `(401) 536-1318`, 35 Grant Street, Providence, RI 02909.
- **Quitados por ahora** (para tener una versión placeholder sin datos irreales): la sección *Projects/galería* y la fila de *cifras* (15+ / 40+ / $250M+). Se reintegran cuando haya proyectos y números reales.
- El **formulario de contacto** valida del lado del cliente y muestra un estado de "gracias", pero **no está conectado** a un backend.
