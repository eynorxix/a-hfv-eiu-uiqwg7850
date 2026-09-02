/* ===== estado del panel: sesion admin (en memoria, nunca se guarda el nsec),
        acumulador de posts leidos de los relays y cache de nombres ===== */
import { importNsec, getActivePubHex } from "../utils/nostr.js";
import { getNip19 } from "../utils/nostr-lib.js";
import { fetchAdminProfile } from "../utils/relays.js";

export var admin = { pubHex: null, npub: null, name: null, locked: true };

var listeners = [];

function notify() { listeners.forEach(function (cb) { cb(admin); }); }

export function onSession(cb) { listeners.push(cb); }

export function hasAdmin() { return !admin.locked && !!admin.pubHex; }

/* importa una nsec y la deja como clave activa (firma). Devuelve Promise<boolean>. */
export function tryLogin(nsec) {
  return importNsec(nsec).then(function (keys) {
    return getNip19().then(function (nip19) {
      admin.pubHex = keys.pubHex;
      admin.npub = nip19.npubEncode(keys.pubHex);
      admin.locked = false;
      notify();
      fetchAdminProfile(keys.pubHex).then(function (profile) {
        admin.name = profile.name;
        notify();
      });
      return true;
    });
  }).catch(function () {
    return false;
  });
}

export function logout() {
  admin.pubHex = null;
  admin.npub = null;
  admin.name = null;
  admin.locked = true;
  notify();
}

/* ---------- posts acumulados (para estadisticas y usuarios) ---------- */
var POSTS_KEY = "forosraiz_admin_posts";
export var posts = [];
var postListeners = [];

export function onPosts(cb) { postListeners.push(cb); }
function notifyPosts() { postListeners.forEach(function (cb) { cb(posts); }); }

export function addPosts(list) {
  var known = {};
  posts.forEach(function (p) { known[p.id] = true; });
  var changed = false;
  (list || []).forEach(function (p) {
    if (known[p.id]) return;
    known[p.id] = true;
    posts.push(p);
    if (posts.length > 4000) posts.shift();
    changed = true;
  });
  if (changed) { try { localStorage.setItem(POSTS_KEY, JSON.stringify(posts)); } catch (e) {} notifyPosts(); }
}

export function loadCachedPosts() {
  try {
    var raw = JSON.parse(localStorage.getItem(POSTS_KEY) || "[]");
    if (Array.isArray(raw)) posts = raw;
  } catch (e) {}
}

/* ---------- cache de nombres (kind 0) ---------- */
var NAMES_KEY = "forosraiz_admin_names";
export var names = {};
var nameListeners = [];

export function onNames(cb) { nameListeners.push(cb); }
function notifyNames() { nameListeners.forEach(function (cb) { cb(names); }); }

export function setNames(map) {
  Object.keys(map).forEach(function (k) { names[k] = map[k]; });
  try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch (e) {}
  notifyNames();
}

export function loadCachedNames() {
  try { names = JSON.parse(localStorage.getItem(NAMES_KEY) || "{}"); } catch (e) {}
}

export function nameOf(pubHex) {
  if (names[pubHex]) return names[pubHex];
  return (pubHex || "").slice(0, 10);
}

/* recoge los pubkeys ausentes de la cache y pide sus perfiles (kind 0) */
export function ensureNames(list) {
  var wanted = [];
  (list || []).forEach(function (hex) {
    if (hex && !names[hex] && wanted.indexOf(hex) < 0) wanted.push(hex);
  });
  if (!wanted.length) return;
  /* se pide en grupos para no disparar consultas gigantes */
  var chunk = wanted.slice(0, 80);
  queryNamesChunk(chunk).then(function (map) {
    setNames(map);
    if (wanted.length > chunk.length) ensureNames(wanted.slice(chunk.length));
  }).catch(function () {});
}

function queryNamesChunk(pubkeys) {
  return import("../utils/relays.js").then(function (relays) {
    return relays.queryEvents({ kinds: [0], authors: pubkeys, limit: pubkeys.length * 2 }, { maxWait: 5000 })
      .then(function (events) {
        var newest = {};
        var map = {};
        events.forEach(function (ev) {
          if (newest[ev.pubkey] !== undefined && ev.created_at < newest[ev.pubkey]) return;
          newest[ev.pubkey] = ev.created_at;
          map[ev.pubkey] = ev.pubkey.slice(0, 8);
          try {
            var d = JSON.parse(ev.content || "");
            if (d && (d.display_name || d.name)) map[ev.pubkey] = d.display_name || d.name;
          } catch (e) {}
        });
        return map;
      });
  });
}