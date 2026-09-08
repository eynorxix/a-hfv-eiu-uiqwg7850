/* ===== roles de usuarios: colaborador/admin/comun y estado (activo/baneado) =====
   El panel mantiene UNA lista deseada (roles[hex] = { role, status }), persistida
   en localStorage, y la publica entera como un evento kind 39001 firmado por la
   clave admin (addressable). El foro (tox-forum js/store/moderation.js) lee ese
   evento y aplica roles y baneos a los visitantes.
   Ademas escucha los eventos kind 13370 (registro de usuarios) para saber
   quienes se crearon cuentas. */
import { ROLE_KIND, ROLE_DTAG, REG_DTAG } from "../config.js";
import { getNip19 } from "../utils/nostr-lib.js";
import { queryEvents, subscribeEvents, doPublishWithRetry } from "../utils/relays.js";
import { admin } from "./state.js";

var LOCAL_KEY = "forosraiz_admin_roles";

var local = {};        /* lista deseada: pubhex -> { role, status } */
var published = {};    /* lo que esta publicado ahora mismo en los relays */
var onRoles = [];
var closer = null;
var regCloser = null;
var regs = [];         /* registros detectados (kind 13370) */

export function onRolesChange(cb) { onRoles.push(cb); }
function notify() { onRoles.forEach(function (cb) { cb(); }); }

function loadLocal() {
  try { local = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; }
  catch (e) { local = {}; }
}
function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(local)); } catch (e) {}
}

/* convierte npub o hex -> hex. Devuelve Promise<hex|null> */
export function normalizePub(input) {
  var s = String(input || "").trim();
  if (!s) return Promise.resolve(null);
  if (/^[0-9a-f]{64}$/.test(s)) return Promise.resolve(s);
  if (/^npub1/.test(s)) {
    return getNip19().then(function (nip19) {
      var d = nip19.decode(s);
      return (d && d.type === "npub") ? d.data : null;
    }).catch(function () { return null; });
  }
  return Promise.resolve(null);
}

export function roleOf(pubHex) {
  if (local[pubHex]) return local[pubHex].role || "comun";
  if (published[pubHex]) return published[pubHex].role || "comun";
  return null; /* sin rol asignado */
}
export function statusOf(pubHex) {
  if (local[pubHex]) return local[pubHex].status || "activo";
  if (published[pubHex]) return published[pubHex].status || "activo";
  return "activo"; /* por defecto activo */
}
export function isBanned(pubHex) {
  return statusOf(pubHex) === "banned";
}

/* filas deseadas: hex -> { role, status } */
export function currentList() {
  return Object.keys(local).sort();
}
export function publishedList() {
  return Object.keys(published).sort();
}

export function setRole(pubHex, role) {
  if (!local[pubHex]) local[pubHex] = { role: "comun", status: "activo" };
  local[pubHex].role = role;
  saveLocal();
  notify();
}
export function setStatus(pubHex, status) {
  if (!local[pubHex]) local[pubHex] = { role: "comun", status: "activo" };
  local[pubHex].status = status;
  saveLocal();
  notify();
}
export function removeEntry(pubHex) {
  delete local[pubHex];
  delete published[pubHex];
  saveLocal();
  notify();
}

/* registros detectados (kind 13370) */
export function registeredList() { return regs.slice(); }

function upsertReg(ev) {
  var reg = { pubHex: ev.pubkey, ts: ev.created_at || 0 };
  try {
    var data = JSON.parse(ev.content || "{}");
    reg.name = data.name || null;
    reg.icon = data.icon || null;
    reg.desc = data.desc || null;
    reg.mainForum = data.mainForum || null;
    reg.forums = data.forums || null;
  } catch (e) { reg.name = null; }
  var i = regs.findIndex(function (r) { return r.pubHex === ev.pubkey; });
  if (i >= 0) regs[i] = reg;
  else regs.push(reg);
  notify();
}

export function queryRegistrations() {
  return queryEvents({ kinds: [13370], "#d": [REG_DTAG], limit: 200 }, { maxWait: 7000 })
    .then(function (events) {
      events.forEach(function (ev) { upsertReg(ev); });
      notify();
    })
    .catch(function () {});
}

export function subscribeRegistrations() {
  if (regCloser) return Promise.resolve(regCloser);
  return subscribeEvents({ kinds: [13370], "#d": [REG_DTAG] }, function (ev) {
    upsertReg(ev);
    notify();
  }).then(function (c) {
    regCloser = c;
    return regCloser;
  });
}

/* aplica el evento mas reciente del admin (autor verificado) */
function applyRoleEvent(ev) {
  if (ev.kind !== ROLE_KIND) return;
  var tags = ev.tags || [];
  published = {};
  tags.forEach(function (t) {
    if (t[0] !== "p" || !t[1] || !/^[0-9a-f]{64}$/.test(t[1])) return;
    /* formato: ["p", hex, "role", <rol>, "status", <estado>] */
    var role = tagVal(t, "role") || "comun";
    var status = tagVal(t, "status") || "activo";
    published[t[1]] = { role: role, status: status };
  });
  /* la lista deseada = lo publicado + lo pendiente local */
  Object.keys(published).forEach(function (hex) {
    if (!local[hex]) local[hex] = published[hex];
  });
  saveLocal();
  notify();
}

/* extrae el valor de una etiqueta con su valor (p. ej. "role", "collab") */
function tagVal(tag, label) {
  for (var i = 2; i < tag.length - 1; i++) {
    if (tag[i] === label && tag[i + 1]) return tag[i + 1];
  }
  return null;
}

/* lee lo publicado por el admin (0 o 1 evento: addressable) */
export function refreshPublished() {
  var adminHex = normalizedAdminHex();
  if (!adminHex) return Promise.resolve();
  return queryEvents({ kinds: [ROLE_KIND], authors: [adminHex], "#d": [ROLE_DTAG], limit: 10 }, { maxWait: 7000 })
    .then(function (events) {
      var newest = null;
      events.forEach(function (ev) {
        if (!newest || ev.created_at > newest.created_at) newest = ev;
      });
      if (newest) applyRoleEvent(newest);
    })
    .catch(function () {});
}

/* se suscribe en vivo a la lista publicada del admin */
export function subscribePublished() {
  var adminHex = normalizedAdminHex();
  if (!adminHex) return Promise.resolve(null);
  if (closer) return Promise.resolve(closer);
  var lastTs = 0;
  return subscribeEvents({ kinds: [ROLE_KIND], authors: [adminHex], "#d": [ROLE_DTAG] }, function (ev) {
    if (ev.kind !== ROLE_KIND) return;
    if ((ev.created_at || 0) < lastTs) return;
    lastTs = ev.created_at || 0;
    applyRoleEvent(ev);
  }).then(function (c) {
    closer = c;
    return closer;
  });
}

export function closeLive() {
  if (closer) { try { closer.close(); } catch (e) {} closer = null; }
  if (regCloser) { try { regCloser.close(); } catch (e) {} regCloser = null; }
}

/* publica la lista completa actual (kind 39001) con REINTENTOS automaticos:
   un solo clic, y si los relays no confirman al instante vuelve a intentar
   hasta lograrlo (o agotar los intentos). Devuelve Promise<count de relays>.
   onProgress(tries, attempts, ok) se informa tras cada intento para la UI. */
export function publishNow(onProgress) {
  var now = Math.floor(Date.now() / 1000);
  var list = currentList();
  var tags = [["d", ROLE_DTAG]];
  list.forEach(function (hex) {
    var r = local[hex] || { role: "comun", status: "activo" };
    tags.push(["p", hex, "role", r.role, "status", r.status]);
  });
  var content = JSON.stringify({ v: 1, updated_at: now });
  return doPublishWithRetry(
    { kind: ROLE_KIND, created_at: now, tags: tags, content: content },
    { attempts: 6, minRelays: 1, delayMs: 1500 },
    onProgress
  ).then(function (ok) {
    if (ok > 0) refreshPublished();
    return ok;
  });
}

/* admin efectivo: la clave con la que se entro al panel */
function normalizedAdminHex() {
  return admin.pubHex || null;
}

loadLocal();