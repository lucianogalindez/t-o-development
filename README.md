# T&O Development Group LLC — Landing

Sitio web de una sola página para **T&O Development Group LLC**, una firma de desarrollo e inversión inmobiliaria con base en Rhode Island. Construido como un sitio estático (HTML/CSS/JS, sin build) a partir de un diseño de Claude Design.

## Características

- **Hero controlado por scroll** — la sección hero queda fija (`position: sticky`) dentro de un contenedor alto; un único valor de progreso (0→1) sincroniza tres cosas:
  - **Scrub del video** — el scroll controla `video.currentTime` (día → atardecer; al subir, se revierte), suavizado con `requestAnimationFrame` + lerp y pausado a frames reales con `requestVideoFrameCallback` cuando está disponible.
  - **Cross-fade del titular** — 4 mensajes que se funden según el progreso.
  - **Resaltado de fase** — la fase activa (01–04) se enciende en rojo y las demás se atenúan.
- **Secciones**: Hero · Posicionamiento · Approach · Process · Projects · About · Contact · Footer.
- **Responsive** (escritorio / tablet / móvil) con encuadre del video ajustado en pantallas angostas.
- **Detalles**: header transparente sobre el hero que pasa a sólido al hacer scroll, scroll-reveal de bloques editoriales, scroll-spy en el nav, foco visible accesible y respeto por `prefers-reduced-motion`.

## Estructura

```
index.html                 # marcado y estilos inline (fieles al diseño)
styles.css                 # estados :hover/:focus, responsive, keyframes, hero por scroll
script.js                  # lógica (hero por scroll, header, reveal, menú, formulario)
assets/
  daydusk-scrub.mp4        # video del hero (keyframe por frame, para scrub fluido)
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
- **Contenido placeholder** por reemplazar con datos reales: nombres/fotos de proyectos y cifras (15+ / 40+ / $250M+).
- El **formulario de contacto** valida del lado del cliente y muestra un estado de "gracias", pero **no está conectado** a un backend.
