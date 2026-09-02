# AGENTS.md — Guía de mantenimiento para opencode

Este repo es el **panel de control** del imageboard ForosRaiz. Si te piden
trabajar aquí, lee esto y `CONTROL_PANEL.md` primero. Hay **dos** repositorios
relacionados en esta máquina:

- `/home/eynor/Documents/proyectsTT/Admin_forum/` (este, el panel)
- `/home/eynor/Documents/proyectsTT/tox-forum/` (el foro que consume los baneos)

## Antes de tocar nada

1. Lee `CONTROL_PANEL.md` (contrato de baneos: kind 39000, `#d`,
   verificación por `ADMIN_NPUB`, flujo kill-list).
2. Si el cambio toca el consumo de baneos, edita los **dos** repos y verifica
   los dos. El foro es quien hace invisible al baneado, no el panel.

## Cómo comprobar que el código es válido

Cada módulo ES importa a otros; `node --check` valida sintaxis sin ejecutar:

```bash
node --input-type=module --check < js/main.js
node --input-type=module --check < js/store/moderation.js
node --input-type=module --check < js/store/state.js
node --input-type=module --check < js/utils/relays.js
node --input-type=module --check < js/view/dashboard.js
node --input-type=module --check < js/view/users.js
node --input-type=module --check < js/view/bans.js
node --input-type=module --check < js/utils/dom.js
node --input-type=module --check < js/utils/nostr.js
```

(En `tox-forum`, análogo para `js/store/moderation.js` y los archivos que
filtren por baneo.)

## Cómo probar en local

El sitio es 100% estático (sin build). Sirve el repo:

```bash
python3 -m http.server 8123    # dentro de Admin_forum
# abre http://localhost:8123
```

Para probar el baneo de punta a punta:

1. Abre el foro local en otro puerto (`python3 -m http.server 8130` en tox-forum).
2. En el panel: entra con la nsec admin, banéate a un autor y "Publicar lista".
3. En el foro, navega al foro donde posteó ese autor: debe desaparecer en vivo.
   Si `ADMIN_NPUB` está vacío en `config.js`, ese test NO aplica (por diseño).

## Despliegue (GitHub Pages)

Cada repo tiene su propio Pages:

- Panel → `https://eynorxix.github.io/Admin_forum/` (repo `eynorxix/Admin_forum`)
- Foro → `https://eynorxix.github.io/tox-forum/` (repo `eynorxix/tox-forum`)

Pasos tras cada cambio en el panel:

```bash
git add -A
git commit -m "descripcion"
git push origin main
```

Pages se re-despliega solo. No olvides `.nojekyll` (ya existe) ni que
`index.html` tiene `canonical`/meta para el panel.

## Errores comunes

- **"Modo provisional"**: `ADMIN_NPUB` está vacío → los baneos no se aplican en
  el foro. Haz que coincida en los dos `js/config.js`.
- **La npub del admin no se resuelve**: consulta `queryEvents({kinds:[0],
  authors:[hex]})`; el nombre sale del `content` JSON del kind 0.
- **El pool/timers acumulan suscripciones**: al cerrar sesión se llama a
  `dashboard.stopDashboard()` y `mod.closeLive()`; si añades otra suscripción,
  ciérrala también.
- **No guardes la `nsec` en localStorage**: la sesión es solo memoria
  (`store/state.js`). Si alguien pide persistirla, replantea la seguridad.

## Reglas de estilo

- Mismo estilo que el foro: `var`/funciones declaradas, sin rubíes, sin
  comentarios salvo cabeceras de módulo, ES modules, `import` de
  `../utils/*`, `../store/*`, `../config.js`.
- Nada de frameworks: JS plano + `nostr-tools` vía CDN (`js/utils/nostr-lib.js`).
- Los textos al usuario van en español.