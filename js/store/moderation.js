/* ===== moderacion: lista de baneados del panel =====
   Modelo "kill-list": el panel mantiene UNA lista (la deseada), persistida
   en localStorage, y la publica entera como un evento kind 39000 firmado
   por la clave admin. En cada publicacion, los relays reemplazan el evento
   anterior (kind addressable). El foro (js/store/moderation.js de
   tox-forum) lee ese evento y filtra a los autores baneados. */
import { BAN_KIND, BAN_DTAG } from "../config.js";
import { getNip19 } from "../utils/nostr-lib.js";
import { queryEvents, subscribeEvents, publishBanList } from "../utils/relays.js";
import { admin } from "./state.js";

var LOCAL_KEY = "forosraiz_admin_bans";

var local = {};      /* lista deseada: pubhex -> true */
var published = {};  /* lo que hay publicado ahora mismo en los relays */
var onBans = [];
var closer = null;

export function onBanChange(cb) { onBans.push(cb); }
function notify() { onBans.forEach(function (cb) { cb(); }); }

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

export function isBanned(pubHex) { return !!(pubHex && (local[pubHex] || published[pubHex])); }

export function currentList() { return Object.keys(local).sort(); }
export function publishedList() { return Object.keys(published).sort(); }

export function ban(pubHex) {
  local[pubHex] = true;
  saveLocal();
  notify();
}
export function unban(pubHex) {
  delete local[pubHex];
  delete published[pubHex];
  saveLocal();
  notify();
}

/* aplica el evento mas reciente del admin (autor verificado) */
function applyBanEvent(ev) {
  if (ev.kind !== BAN_KIND) return;
  var tags = ev.tags || [];
  var ptag = tags.filter(function (t) { return t[0] === "p" && t[1]; }).map(function (t) { return t[1]; });
  /* la lista del evento reemplaza a lo que habia publicado */
  published = {};
  ptag.forEach(function (hex) { published[hex] = true; });
  /* la lista deseada = lo publicado + lo pendiente local */
  Object.keys(published).forEach(function (hex) { if (!local[hex]) local[hex] = true; });
  saveLocal();
  notify();
}

/* lee lo publicado por el admin (0 o 1 evento: addressable) */
export function refreshPublished() {
  var adminHex = normalizedAdminHex();
  if (!adminHex) return Promise.resolve();
  return queryEvents({ kinds: [BAN_KIND], authors: [adminHex], "#d": [BAN_DTAG], limit: 10 }, { maxWait: 7000 })
    .then(function (events) {
      var newest = null;
      events.forEach(function (ev) {
        if (!newest || ev.created_at > newest.created_at) newest = ev;
      });
      if (newest) applyBanEvent(newest);
    })
    .catch(function () {});
}

/* se suscribe en vivo a la lista publicada del admin */
export function subscribePublished() {
  var adminHex = normalizedAdminHex();
  if (!adminHex) return Promise.resolve(null);
  if (closer) return Promise.resolve(closer);
  var lastTs = 0;
  return subscribeEvents({ kinds: [BAN_KIND], authors: [adminHex], "#d": [BAN_DTAG] }, function (ev) {
    if (ev.kind !== BAN_KIND) return;
    if ((ev.created_at || 0) < lastTs) return;
    lastTs = ev.created_at || 0;
    applyBanEvent(ev);
  }).then(function (c) {
    closer = c;
    return closer;
  });
}

export function closeLive() {
  if (closer) { try { closer.close(); } catch (e) {} closer = null; }
}

/* publica la lista completa actual. Devuelve Promise<count de relays> */
export function publishNow() {
  var list = currentList();
  return publishBanList(list).then(function (ok) {
    if (ok > 0) refreshPublished();
    return ok;
  });
}

/* admin efectivo: la clave con la que se entro al panel (los eventos que
   queremos leer son los publicados por ESA clave; ADMIN_NPUB solo se usa
   como validacion de rol en main.js). */
function normalizedAdminHex() {
  return admin.pubHex || null;
}

/* bloque exportable para pegar en js/config.js del foro (npubs) */
export function exportConfigBlock() {
  var hexes = currentList();
  return getNip19().then(function (nip19) {
    var lines = hexes.map(function (hex) { return "  \"" + nip19.npubEncode(hex) + "\""; });
    return "export var BANNED_NPUBS = [\n" + lines.join(",\n") + "\n];\n";
  });
}

loadLocal();