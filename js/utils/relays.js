/* ===== acceso a relays Nostr para el panel de control =====
   Mismo stack que el foro (nostr-tools via CDN + SimplePool). Este panel:
   - lee los posts del foro (kind 33033) para estadisticas y moderacion,
   - publica la lista de baneados (kind 39000) firmada con la clave admin. */
import { loadNostrLib } from "./nostr-lib.js";
import { getActiveSec } from "./nostr.js";
import { RELAYS, POST_KIND, BAN_KIND, BAN_DTAG } from "../config.js";

var pool = null;

function getPool() {
  return loadNostrLib().then(function (lib) {
    if (!pool) pool = new lib.SimplePool();
    return { lib: lib, pool: pool };
  });
}

export function queryEvents(filter, opts) {
  return getPool().then(function (p) {
    return p.pool.querySync(RELAYS, filter, { maxWait: (opts && opts.maxWait) || 8000 });
  });
}

/* suscripcion en vivo: filtra (verifyEvent + dedupe) y reenvia cada evento.
   Devuelve Promise<closer> para poder cerrarla al cerrar sesion. */
export function subscribeEvents(filter, onEvent) {
  return getPool().then(function (p) {
    var seen = {};
    return p.pool.subscribeMany(RELAYS, [filter], {
      onevent: function (ev) {
        try { if (!p.lib.verifyEvent(ev)) return; } catch (e) { return; }
        if (seen[ev.id]) return;
        seen[ev.id] = true;
        onEvent(ev);
      },
      maxWait: 9000
    });
  });
}

/* deja un evento POST_KIND en forma util para el tablero del panel */
function parsePostEvent(lib, ev) {
  try { if (!lib.verifyEvent(ev)) return null; } catch (e) { return null; }
  var dTag = ev.tags.find(function (t) { return t[0] === "d"; });
  var board = "?";
  var no = null;
  if (dTag) {
    var parts = (dTag[1] || "").split(":");
    if (parts.length >= 3) { board = parts[1]; no = parts[2]; }
  }
  var bTag = ev.tags.find(function (t) { return t[0] === "board"; });
  if (bTag && bTag[1]) board = bTag[1];
  var image = null;
  var im = ev.tags.find(function (t) { return t[0] === "imeta"; });
  if (im) {
    var m = /url (\S+)/.exec(im[1] || "");
    if (m) image = m[1];
  }
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    board: board,
    no: no,
    content: (ev.content || "").slice(0, 200),
    image: image,
    created_at: ev.created_at || 0
  };
}

export function parsePostEvents(events) {
  return getPool().then(function (p) {
    var out = [];
    events.forEach(function (ev) {
      var post = parsePostEvent(p.lib, ev);
      if (post) out.push(post);
    });
    return out;
  });
}

/* publica un draft y devuelve cuantos relays confirmaron */
function doPublish(draft) {
  var sec = getActiveSec();
  if (!sec) return Promise.resolve(0);
  return getPool().then(function (p) {
    var event = p.lib.finalizeEvent(draft, sec);
    var promises = p.pool.publish(RELAYS, event).map(function (pr) {
      return new Promise(function (resolve) {
        var settled = false;
        var timer = setTimeout(function () {
          if (!settled) { settled = true; resolve(false); }
        }, 9000);
        pr.then(function (ok) {
          if (!settled) { settled = true; clearTimeout(timer); resolve(!!ok); }
        }).catch(function () {
          if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
        });
      });
    });
    return Promise.all(promises).then(function (oks) {
      return oks.filter(Boolean).length;
    });
  }).catch(function () { return 0; });
}

/* publica un draft ya construido y devuelve cuantos relays confirmaron.
   Se usa para publicar cualquier kind (roles, baneos, etc.) con la clave admin. */
export function doPublishLocal(draft) {
  return doPublish(draft);
}

/* publica y REINTENTA solo hasta que al menos minRelays relays confirmen (o
   se agoten los attempts). Devuelve el mejor recuento logrado.
   onProgress(tries, attempts, ok) se llama tras cada intento. */
export function doPublishWithRetry(draft, opts, onProgress) {
  opts = opts || {};
  var attempts = opts.attempts || 5;
  var minRelays = (opts.minRelays == null) ? 1 : opts.minRelays;
  var delayMs = opts.delayMs || 1500;
  var best = 0;
  var tries = 0;
  function attempt() {
    tries++;
    return doPublish(draft).then(function (ok) {
      if (ok > best) best = ok;
      if (onProgress) onProgress(tries, attempts, ok);
      if (best >= minRelays || tries >= attempts) return best;
      return new Promise(function (res) {
        setTimeout(function () { res(attempt()); }, delayMs);
      });
    });
  }
  return attempt();
}

/* publica la LISTA COMPLETA de baneados (kind 39000, kind addressable:
   cada publicacion reemplaza a la anterior para el mismo admin+d-tag). */
export function publishBanList(pubHexes) {
  var now = Math.floor(Date.now() / 1000);
  var tags = [["d", BAN_DTAG]];
  (pubHexes || []).forEach(function (hex) { tags.push(["p", hex]); });
  var content = JSON.stringify({ v: 1, updated_at: now });
  return doPublish({ kind: BAN_KIND, created_at: now, tags: tags, content: content });
}

/* perfil (kind 0) del admin para mostrar nombre/avatar en el header */
export function fetchAdminProfile(pubHex) {
  return queryEvents({ kinds: [0], authors: [pubHex], limit: 5 }, { maxWait: 5000 })
    .then(function (events) {
      var newest = null;
      events.forEach(function (ev) {
        if (!newest || ev.created_at > newest.created_at) newest = ev;
      });
      if (!newest) return { name: null, picture: null };
      try {
        var data = JSON.parse(newest.content || "{}");
        return {
          name: data.display_name || data.name || null,
          picture: data.picture || null
        };
      } catch (e) { return { name: null, picture: null }; }
    })
    .catch(function () { return { name: null, picture: null }; });
}

export { POST_KIND, BAN_KIND, BAN_DTAG };