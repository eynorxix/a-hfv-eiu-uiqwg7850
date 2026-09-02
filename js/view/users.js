/* ===== directorio de usuarios: cada autor detectado en los posts ===== */
import { fmtDate } from "../utils/text.js";
import { posts, nameOf, ensureNames } from "../store/state.js";
import { isBanned, ban, unban, normalizePub } from "../store/moderation.js";
import { toast } from "../utils/dom.js";

export function renderUsers(rerender) {
  var wrap = document.createElement("div");
  wrap.className = "users-view";
  wrap.id = "users-view";

  var h = document.createElement("h3");
  h.textContent = "Usuarios detectados en los relays";
  wrap.appendChild(h);

  /* ban por npub/hex manualmente */
  var addRow = document.createElement("div");
  addRow.className = "add-ban";
  var inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "npub o pubkey hex del usuario a banear";
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Banear";
  addRow.appendChild(inp);
  addRow.appendChild(addBtn);
  addBtn.addEventListener("click", function () {
    normalizePub(inp.value).then(function (hex) {
      if (!hex) { toast("No es una npub ni una pubkey hex valida", "err"); return; }
      ban(hex);
      toast("Baneado: " + hex.slice(0, 10));
      inp.value = "";
      rerender();
    });
  });
  wrap.appendChild(addRow);

  var agg = aggregate();
  var users = Object.keys(agg).sort(function (a, b) {
    return agg[b].last - agg[a].last;
  });
  ensureNames(users);

  if (users.length === 0) {
    var empty = document.createElement("p");
    empty.className = "rp-text";
    empty.textContent = "Aun no hay usuarios con posts en los relays.";
    wrap.appendChild(empty);
    return wrap;
  }

  var tbl = document.createElement("table");
  tbl.className = "user-table";
  var thead = document.createElement("thead");
  var tr = document.createElement("tr");
  ["Nombre", "Pubkey", "Posts", "Ultimo", ""].forEach(function (c) {
    var th = document.createElement("th");
    th.textContent = c;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  tbl.appendChild(thead);
  var tbody = document.createElement("tbody");

  users.forEach(function (hex) {
    var a = agg[hex];
    var trb = document.createElement("tr");
    trb.className = isBanned(hex) ? "row-banned" : "";
    var tdName = document.createElement("td");
    tdName.textContent = nameOf(hex);
    tdName.title = nameOf(hex);
    trb.appendChild(tdName);
    var tdHex = document.createElement("td");
    var short = document.createElement("code");
    short.textContent = hex.slice(0, 14) + "\u2026";
    short.title = hex;
    tdHex.appendChild(short);
    trb.appendChild(tdHex);
    var tdCount = document.createElement("td");
    tdCount.textContent = a.count;
    trb.appendChild(tdCount);
    var tdLast = document.createElement("td");
    tdLast.textContent = fmtDate(a.last);
    trb.appendChild(tdLast);
    var tdAct = document.createElement("td");
    var b = document.createElement("button");
    b.type = "button";
    b.className = isBanned(hex) ? "btn2" : "btn2 danger";
    b.textContent = isBanned(hex) ? "Desbanear" : "Banear";
    b.addEventListener("click", function () {
      if (isBanned(hex)) { unban(hex); toast("Desbaneado: " + hex.slice(0, 10)); }
      else { ban(hex); toast("Baneado: " + nameOf(hex) + " (" + hex.slice(0, 10) + ")"); }
      rerender();
    });
    tdAct.appendChild(b);
    trb.appendChild(tdAct);
    tbody.appendChild(trb);
  });

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);
  return wrap;
}

function aggregate() {
  var agg = {};
  posts.forEach(function (p) {
    if (!agg[p.pubkey]) agg[p.pubkey] = { count: 0, last: 0, boards: {} };
    agg[p.pubkey].count++;
    if ((p.created_at || 0) * 1000 > agg[p.pubkey].last) agg[p.pubkey].last = (p.created_at || 0) * 1000;
  });
  return agg;
}