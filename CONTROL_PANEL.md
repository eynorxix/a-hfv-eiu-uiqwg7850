# CONTROL_PANEL.md — Contrato del panel de control de ForosRaiz

Este documento define el **protocolo exacto** entre el panel (`Admin_forum`) y
el foro (`tox-forum`). Léelo antes de tocar cualquiera de los dos repositorios.

## 1. Identidad y confianza

- `nsec` = clave de firma del admin (nunca se comparte ni se guarda en disco:
  vive solo en memoria mientras dura la sesión del panel).
- `npub` = identidad pública del admin. La npub debe ser la **misma** en:
  - `Admin_forum/js/config.js` → `ADMIN_NPUB`
  - `tox-forum/js/config.js` → `ADMIN_NPUB`
- Regla de confianza del foro: solo los eventos de baneo cuyo
  `ev.pubkey === ADMIN_NPUB` se aplican. Cualquier otra firma se ignora.

## 2. Kinds y contrato de datos

| Concepto        | Valor                          | Uso                                        |
|-----------------|--------------------------------|--------------------------------------------|
| Posts del foro  | `33033`                        | `#board`, `t/forosraiz`, tags `d/board/no` |
| Lista de baneos | `39000` (addressable)          | `#d = forosraiz-banlist-v1`                |
| Perfiles        | `0`                            | nombre/avatar del admin y usuarios         |
| Relays          | damus, nos.lol, primal, mom, ditto, antiprimal | publicación y lectura |

### Evento de baneo (kind 39000)

```
{
  kind: 39000,
  created_at: <unix>,
  tags: [
    ["d", "forosraiz-banlist-v1"],
    ["p", "<pubHex baneado 1>"],
    ["p", "<pubHex baneado 2>"],
    ...  // TODOS los baneados, lista completa (kill-list)
  ],
  content: "{\"v\":1,\"updated_at\":<unix>}",
  pubkey: <ADMIN_NPUB en hex>   // lo pone la firma
}
```

- Cada publicación **reemplaza** a la anterior (kind addressable): no hace
  falta publicar "borrados".
- El foro toma el evento con mayor `created_at` de entre los firmados por el
  admin y considera baneados todos sus tags `p`.

## 3. Flujo del baneo

1. Panel detecta un autor (`pubkey` hex) en el feed/directorio y pulsa Banear.
2. `js/store/moderation.js` lo añade a la lista (persistida en
   `localStorage["forosraiz_admin_bans"]`).
3. "Publicar lista en relays" firma y publica el evento 39000 con **toda** la
   lista.
4. El foro (suscrito en vivo a `kind: 39000, authors: [admin]`) recibe el
   evento, verifica la firma, **podría** esconder los posts del baneado
   (`js/store/moderation.js`) y re-renderiza.
5. Desbanear = quitar de la lista y volver a publicar.

Los baneos del `localStorage` del panel y los ya publicados se fusionan
(un baneo publicado desde otro sitio también aparece). La pestaña Baneos
muestra el estado "en relays / pendiente".

## 4. Cómo el foro consume la lista

En `tox-forum/js/store/moderation.js`:

- `ensureBanInit()` combina 3 fuentes en un `Set`:
  1. `js/config.js` → `BANNED_NPUBS` (respaldo, npubs).
  2. `localStorage["forosraiz_bans"]` (overrides locales).
  3. Evento 39000 firmado por `ADMIN_NPUB` (en vivo).
- `isBanned(pubHex)` se consulta en:
  - `relay-sync.js` `mergeBoard` → los posts de baneados **ni se fusionan**.
  - `board.js` render de hilos/respuestas (doble seguridad).
  - `db.js` `postsByAuthor` (feed/notificaciones).
  - `activity.js` feed de seguidos + `profile.js` (placeholder "baneado").
- `pruneBanned()` borra del estado local los posts ya guardados de baneados.

## 5. Limitaciones (importantes)

- Moderación **client-side por consenso**: los eventos de los baneados siguen
  en los relays; cualquiera con una copia modificada de la web podría verlos.
  No es borrado, es invisibilidad para los visitantes de esta app.
- No se pueden "eliminar cuentas": la nsec es la identidad, y los relays ajenos
  no borran eventos de otros.
- Si `ADMIN_NPUB` está vacío en el foro, los baneos del panel **no** se aplican
  allí (el panel avisa "modo provisional").
- Los anónimos solo publican en `/g/` y **local** (10 min): no requieren baneo.

## 6. Referencias de código

- Panel: `Admin_forum/js/` → `utils/relays.js` (pool/query/publish/subscribe),
  `store/state.js` (sesión+datos), `store/moderation.js` (lista+baneo),
  `view/{dashboard,users,bans}.js`, `main.js` (entrada/bloqueo/pestañas).
- Foro: `tox-forum/js/` → `utils/relays.js` (`queryEvents`,
  `subscribeKindEvents`), `store/moderation.js` (consumo), `config.js`.