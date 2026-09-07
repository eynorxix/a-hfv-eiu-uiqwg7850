# Admin_forum — Panel de control de ForosRaiz

Sitio estático (GitHub Pages) que sirve como **consola de moderación** del
imageboard [ForosRaiz](https://eynorxix.github.io/tox-forum/): estadísticas en
vivo de usuarios y posts (leídos de los relays Nostr) y **baneo de usuarios**.

- **Solo el admin entra**: se autentica con su `nsec`.
- **Los baneos son eventos Nostr firmados** (kind `39000`, `#d = forosraiz-banlist-v1`).
- Los visitantes del foro leen ese evento y dejan de ver a los baneados al instante.

## Arranque local

```bash
python3 -m http.server 8123        # dentro de este repo
# abre http://localhost:8123
```

## Configurar el admin

1. Abre el panel, pega tu `nsec`, pulsa "Entrar como admin".
2. Copia tu `npub` (o la del banner).
3. Pégalo en `ADMIN_NPUB` de `js/config.js` **aquí y** en
   `js/config.js` del repo `tox-forum` (misma npub en ambos).

## Despliegue

```bash
git init && git add -A && git commit -m "panel de control ForosRaiz"
git remote add origin https://github.com/eynorxix/Admin_forum.git
git push -u origin main
```

En GitHub → Settings → Pages → Source = Deploy from a branch / `main` / `(root)`.
URL: `https://eynorxix.github.io/Admin_forum/`.

## Documentación

- [`CONTROL_PANEL.md`](CONTROL_PANEL.md): contrato técnico completo (kinds,
  verificación, flujo de baneo, limitaciones).
- [`AGENTS.md`](AGENTS.md): instrucciones de mantenimiento para agentes de
  código (opencode).# a-hfv-eiu-uiqwg7850
# a-hfv-eiu-uiqwg7850
