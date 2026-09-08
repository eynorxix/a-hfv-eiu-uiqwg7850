/* ===== directorio de usuarios: autores detectados + registrados (kind 13370),
   gestion de rol (admin/collab/comun) y estado (activo/baneado) ===== */
import { fmtDate } from "../utils/text.js";
import { posts, nameOf, ensureNames } from "../store/state.js";
import * as roles from "../store/roles.js";
import { toast } from "../utils/dom.js";

const ROLES_LABEL = { admin: "Admin", collab: "Colaborador", comun: "Comun" };

export function renderUsers(rerender) {
  var wrap = document.createElement("div");
  wrap.className = "users-view";
  wrap.id = "users-view";

  var h = document.createElement("h3");
  h.textContent = "Usuarios y colaboradores";
  wrap.appendChild(h);

  var help = document.createElement("p");
  help.className = "rp-text";
  help.textContent = "Asigna un rol y un estado a cada usuario. Colaboradores y admins aparecen en el panel lateral del foro; los baneados no pueden publicar. Se publica todo como un evento kind 39001 firmado con tu clave.";
  wrap.appendChild(help);

  /* agregar usuario por npub/hex manualmente */
  var addRow = document.createElement("div");
  addRow.className = "add-ban";
  var inp = document.createElement("input");
  inp.type = "text";
  inp.placeholder = "npub o pubkey hex del usuario a agregar";
  var roleSel = document.createElement("select");
  roleSel.className = "role-select";
  [["collab", "Colaborador"], ["comun", "Comun"], ["admin", "Admin"]].forEach(function (r) {
    var o = document.createElement("option");
    o.value = r[0];
    o.textContent = r[1];
    roleSel.appendChild(o);
  });
  var addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Agregar";
  addRow.appendChild(inp);
  addRow.appendChild(roleSel);
  addRow.appendChild(addBtn);
  addBtn.addEventListener("click", function () {
    var value = inp.value.trim();
    if (!value) return;
    roles.normalizePub(value).then(function (hex) {
      if (!hex) { toast("No es una npub ni una pubkey hex valida", "err"); return; }
      roles.setRole(hex, roleSel.value);
      toast("Agregado " + (ROLES_LABEL[roleSel.value] || roleSel.value) + ": " + hex.slice(0, 10));
      inp.value = "";
      rerender();
    });
  });
  wrap.appendChild(addRow);

  var updReg = document.createElement("p");
  updReg.className = "upd-line";
  var updBtn = document.createElement("button");
  updBtn.type = "button";
  updBtn.className = "btn2";
  updBtn.textContent = "Buscar usuarios registrados en relays";
  updBtn.addEventListener("click", function () {
    updBtn.disabled = true;
    updBtn.textContent = "Buscando\u2026";
    roles.queryRegistrations().then(function () {
      updBtn.disabled = false;
      updBtn.textContent = "Buscar usuarios registrados en relays";
      toast("Busqueda de registros completada");
      rerender();
    });
  });
  updReg.appendChild(updBtn);
  wrap.appendChild(updReg);

  var users = buildUserList();
  ensureNames(users.map(function (u) { return u.hex; }));

  if (users.length === 0) {
    var empty = document.createElement("p");
    empty.className = "rp-text";
    empty.textContent = "Aun no hay usuarios con posts ni registros en los relays.";
    wrap.appendChild(empty);
    return wrap;
  }

  var tbl = document.createElement("table");
  tbl.className = "user-table";
  var thead = document.createElement("thead");
  var tr = document.createElement("tr");
  ["Nombre", "npub", "Rol", "Estado", "Posts", ""].forEach(function (c) {
    var th = document.createElement("th");
    th.textContent = c;
    tr.appendChild(th);
  });
  thead.appendChild(tr);
  tbl.appendChild(thead);
  var tbody = document.createElement("tbody");

  users.forEach(function (u) {
    var hex = u.hex;
    var trb = document.createElement("tr");
    trb.className = roles.isBanned(hex) ? "row-banned" : "";

    var tdName = document.createElement("td");
    tdName.textContent = nameOf(hex);
    tdName.title = nameOf(hex);
    trb.appendChild(tdName);

    var tdHex = document.createElement("td");
    var short = document.createElement("code");
    short.textContent = hex.slice(0, 16) + "\u2026";
    short.title = hex;
    tdHex.appendChild(short);
    trb.appendChild(tdHex);

    /* rol */
    var tdRole = document.createElement("td");
    var sel = document.createElement("select");
    sel.className = "role-select";
    [["collab", "Colaborador"], ["comun", "Comun"], ["admin", "Admin"]].forEach(function (r) {
      var o = document.createElement("option");
      o.value = r[0];
      o.textContent = r[1];
      if (roles.roleOf(hex) === r[0]) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      roles.setRole(hex, sel.value);
      toast("Rol de " + nameOf(hex) + " -> " + (ROLES_LABEL[sel.value] || sel.value));
      rerender();
    });
    tdRole.appendChild(sel);
    trb.appendChild(tdRole);

    /* estado */
    var tdSt = document.createElement("td");
    var banned = roles.isBanned(hex);
    var stBtn = document.createElement("button");
    stBtn.type = "button";
    stBtn.className = "btn2 " + (banned ? "danger" : "block");
    stBtn.textContent = banned ? "Baneado" : "Activo";
    stBtn.addEventListener("click", function () {
      roles.setStatus(hex, banned ? "activo" : "banned");
      toast((banned ? "Activado: " : "Baneado: ") + nameOf(hex));
      rerender();
    });
    tdSt.appendChild(stBtn);
    trb.appendChild(tdSt);

    var tdCount = document.createElement("td");
    tdCount.textContent = u.count;
    trb.appendChild(tdCount);

    var tdAct = document.createElement("td");
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn2";
    removeBtn.textContent = "Quitar";
    removeBtn.title = "Quitar de la lista de roles";
    removeBtn.addEventListener("click", function () {
      roles.removeEntry(hex);
      toast("Quitado de la lista: " + nameOf(hex));
      rerender();
    });
    tdAct.appendChild(removeBtn);
    trb.appendChild(tdAct);

    tbody.appendChild(trb);
  });

  tbl.appendChild(tbody);
  wrap.appendChild(tbl);

  var pubRow = document.createElement("div");
  pubRow.className = "pub-row";
  var pubBtn = document.createElement("button");
  pubBtn.type = "button";
  pubBtn.className = "btn2 primary";
  pubBtn.textContent = "Publicar roles en relays";
  pubBtn.addEventListener("click", function () {
    pubBtn.disabled = true;
    pubBtn.textContent = "Publicando\u2026";
    roles.publishNow(function (tries, attempts) {
      pubBtn.textContent = "Publicando\u2026 intento " + tries + "/" + attempts;
    }).then(function (ok) {
      pubBtn.disabled = false;
      pubBtn.textContent = "Publicar roles en relays";
      if (ok > 0) toast("Roles publicados en " + ok + " relays");
      else toast("No se pudo publicar tras varios intentos: revisa tu clave activa", "err");
      rerender();
    });
  });
  pubRow.appendChild(pubBtn);
  wrap.appendChild(pubRow);

  return wrap;
}

function buildUserList() {
  var map = {};   /* hex -> { count, ts } */

  posts.forEach(function (p) {
    if (!p.pubkey) return;
    if (!map[p.pubkey]) map[p.pubkey] = { count: 0, ts: 0 };
    map[p.pubkey].count++;
    if ((p.created_at || 0) * 1000 > map[p.pubkey].ts) map[p.pubkey].ts = (p.created_at || 0) * 1000;
  });

  roles.registeredList().forEach(function (r) {
    if (!r.pubHex) return;
    if (!map[r.pubHex]) map[r.pubHex] = { count: 0, ts: 0 };
    map[r.pubHex].count++;
    if ((r.ts || 0) * 1000 > map[r.pubHex].ts) map[r.pubHex].ts = (r.ts || 0) * 1000;
  });

  /* asegura que alguien agregado manualmente pero sin posts/registros salga */
  roles.currentList().forEach(function (hex) {
    if (!map[hex]) map[hex] = { count: 0, ts: 0 };
  });

  var out = Object.keys(map).map(function (hex) {
    return { hex: hex, count: map[hex].count, ts: map[hex].ts };
  });
  return out.sort(function (a, b) { return b.ts - a.ts; });
}