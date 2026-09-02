/* ===== panel principal: estadisticas y feed en vivo con acciones de baneo ===== */
import { fmtDate } from "../utils/text.js";
import { posts, nameOf, ensureNames } from "../store/state.js";
import { isBanned, currentList, ban, unban } from "../store/moderation.js";
import { subscribeEvents } from "../utils/relays.js";
import { POST_KIND } from "../config.js";
import { toast } from "../utils/dom.js";

var liveCloser = null;
var rerender = null;

export function initDashboard(onChange) {
  rerender = onChange || function () {};
  if (liveCloser) return;
  subscribeEvents({ kinds: [POST_KIND], limit: 0 }, function (ev) {
    import("../utils/relays.js").then(function (r) { return r.parsePostEvents([ev]); }).then(function (list) {
      import("../store/state.js").then(function (st) { st.addPosts(list); }).then(rerender);
    });
  }).then(function (closer) { liveCloser = closer; })
    .catch(function () {});
}

export function stopDashboard() {
  if (liveCloser) { try { liveCloser.close(); } catch (e) {} liveCloser = null; }
}

function uniqueUsers() {
  var seen = {};
  posts.forEach(function (p) { seen[p.pubkey] = true; });
  return Object.keys(seen);
}

function byBoard() {
  var counts = {};
  posts.forEach(function (p) {
    counts[p.board] = (counts[p.board] || 0) + 1;
  });
  return counts;
}

export function renderDashboard() {
  var users = uniqueUsers();
  ensureNames(users);
  var boards = byBoard();

  var wrap = document.createElement("div");
  wrap.className = "dash";

  var h = document.createElement("h3");
  h.textContent = "Resumen en vivo";
  wrap.appendChild(h);

  var cards = document.createElement("div");
  cards.className = "stat-cards";
  cards.appendChild(statCard("Usuarios", String(users.length)));
  cards.appendChild(statCard("Posts", String(posts.length)));
  cards.appendChild(statCard("Baneados", String(currentList().length)));
  wrap.appendChild(cards);

  var bh = document.createElement("h4");
  bh.textContent = "Posts por foro";
  wrap.appendChild(bh);
  var bars = document.createElement("div");
  bars.className = "board-bars";
  var order = Object.keys(boards).sort();
  order.forEach(function (b) {
    var row = document.createElement("div");
    row.className = "bar-row";
    var label = document.createElement("span");
    label.className = "bar-label";
    label.textContent = "/" + b + "/";
    var track = document.createElement("div");
    track.className = "bar-track";
    var w = document.createElement("div");
    w.className = "bar-fill";
    var max = Math.max.apply(null, order.map(function (x) { return boards[x]; }).concat([1]));
    w.style.width = Math.round((boards[b] / max) * 100) + "%";
    track.appendChild(w);
    row.appendChild(label);
    row.appendChild(track);
    var n = document.createElement("span");
    n.className = "bar-count";
    n.textContent = boards[b];
    row.appendChild(n);
    bars.appendChild(row);
  });
  wrap.appendChild(bars);

  var lh = document.createElement("h4");
  lh.textContent = "Ultimas publicaciones";
  wrap.appendChild(lh);

  var list = document.createElement("div");
  list.className = "live-list";
  var items = posts.slice(-60).reverse();
  if (items.length === 0) {
    var empty = document.createElement("p");
    empty.className = "rp-text";
    empty.textContent = "Cargando publicaciones de los relays\u2026";
    list.appendChild(empty);
  } else {
    items.forEach(function (p) {
      list.appendChild(postRow(p));
    });
  }
  wrap.appendChild(list);
  return wrap;
}

function statCard(label, value) {
  var card = document.createElement("div");
  card.className = "stat-card";
  var v = document.createElement("div");
  v.className = "stat-value";
  v.textContent = value;
  var l = document.createElement("div");
  l.className = "stat-label";
  l.textContent = label;
  card.appendChild(v);
  card.appendChild(l);
  return card;
}

function postRow(p) {
  var banned = isBanned(p.pubkey);
  var row = document.createElement("div");
  row.className = "live-post" + (banned ? " banned" : "");
  var head = document.createElement("div");
  head.className = "live-head";
  var nm = document.createElement("span");
  nm.className = "name";
  nm.textContent = nameOf(p.pubkey);
  nm.title = p.pubkey;
  head.appendChild(nm);
  var tag = document.createElement("span");
  tag.className = "board-tag";
  tag.textContent = "/" + p.board + "/";
  head.appendChild(tag);
  var no = document.createElement("span");
  no.className = "no";
  no.textContent = p.no ? " No. " + p.no : "";
  head.appendChild(no);
  var date = document.createElement("span");
  date.className = "date";
  date.textContent = " " + fmtDate((p.created_at || 0) * 1000);
  head.appendChild(date);
  if (banned) {
    var btag = document.createElement("span");
    btag.className = "ban-chip";
    btag.textContent = "banned";
    head.appendChild(btag);
  }
  row.appendChild(head);
  var body = document.createElement("div");
  body.className = "live-body";
  body.textContent = p.content || (p.image ? "(imagen)" : "");
  row.appendChild(body);
  var actions = document.createElement("div");
  actions.className = "live-actions";
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = banned ? "btn2" : "btn2 danger";
  btn.textContent = banned ? "Desbanear" : "Banear autor";
  btn.addEventListener("click", function () {
    if (banned) { unban(p.pubkey); toast("Desbaneado: " + p.pubkey.slice(0, 10)); }
    else { ban(p.pubkey); toast("Baneado: " + nameOf(p.pubkey) + " (" + p.pubkey.slice(0, 10) + ")"); }
    rerender();
  });
  actions.appendChild(btn);
  row.appendChild(actions);
  return row;
}