/* ===== punto de entrada del panel de control ===== */
import { warmNostr, getNip19 } from "./utils/nostr-lib.js";
import { toast, copyText } from "./utils/dom.js";
import { esc } from "./utils/text.js";
import * as st from "./store/state.js";
import * as mod from "./store/moderation.js";
import * as roles from "./store/roles.js";
import { queryEvents, parsePostEvents } from "./utils/relays.js";
import { admin } from "./store/state.js";
import { POST_KIND, ADMIN_NPUB, PAGE } from "./config.js";
import * as dashboard from "./view/dashboard.js";
import { renderUsers } from "./view/users.js";
import { renderBans } from "./view/bans.js";

warmNostr();

var content = document.getElementById("content");
var chip = document.getElementById("admin-chip");

var currentTab = "panel";
var renderTimer = null;

function rerender() {
  if (renderTimer) return;
  renderTimer = setTimeout(function () {
    renderTimer = null;
    renderTab();
  }, 250);
}

st.onSession(function () {
  if (st.hasAdmin()) bootData();
  render();
});

/* datos iniciales y suscripciones tras entrar como admin */
function bootData() {
  st.loadCachedPosts();
  st.loadCachedNames();
  mod.refreshPublished();
  mod.subscribePublished();
  roles.queryRegistrations();
  roles.subscribeRegistrations();
  dashboard.initDashboard(rerender);
  queryEvents({ kinds: [POST_KIND], limit: 300 }, { maxWait: 9000 })
    .then(parsePostEvents)
    .then(function (list) { st.addPosts(list); })
    .catch(function () {});
}

document.addEventListener("DOMContentLoaded", render);
render();

/* ==================== pantalla de bloqueo (solo admin) ==================== */
function renderLock() {
  var wrap = document.createElement("div");
  wrap.className = "lock-screen";

  var box = document.createElement("div");
  box.className = "lock-box";

  var h = document.createElement("h2");
  h.textContent = "Panel restringido";
  box.appendChild(h);

  var p = document.createElement("p");
  p.className = "rp-text";
  p.textContent = "Introduce la nsec del admin del foro para entrar. Los baneos quedaran firmados con esa clave.";
  box.appendChild(p);

  var ta = document.createElement("textarea");
  ta.placeholder = "nsec1\u2026 (clave secreta del admin)";
  box.appendChild(ta);

  var btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Entrar como admin";
  btn.addEventListener("click", function () {
    var nsec = (ta.value || "").trim();
    if (!nsec) return;
    btn.disabled = true;
    btn.textContent = "Verificando clave\u2026";
    st.tryLogin(nsec).then(function (ok) {
      if (!ok) {
        btn.disabled = false;
        btn.textContent = "Entrar como admin";
        toast("La clave no es una nsec valida", "err");
        return;
      }
      /* validacion de rol contra la config (si esta definida) */
      if (!ADMIN_NPUB) {
        render();
        showProvisionalNotice(admin.npub);
        return;
      }
      var cfgHex = null;
      if (/^[0-9a-f]{64}$/.test(ADMIN_NPUB)) {
        cfgHex = ADMIN_NPUB;
      } else {
        try { var d = getNip19().decode(ADMIN_NPUB); cfgHex = d.type === "npub" ? d.data : null; } catch (e) {}
      }
      if (cfgHex && cfgHex !== admin.pubHex) {
        st.logout();
        btn.disabled = false;
        btn.textContent = "Entrar como admin";
        toast("Esta clave NO es la admin configurada en js/config.js", "err");
        return;
      }
      render();
    });
  });
  box.appendChild(btn);

  var note = document.createElement("p");
  note.className = "lock-note";
  note.innerHTML = "Para que el foro conf&iacute;e en estos baneos, define <code>ADMIN_NPUB</code> en <code>js/config.js</code> de este panel <b>y</b> del repo <code>tox-forum</code> (ver <code>CONTROL_PANEL.md</code>).";
  box.appendChild(note);

  wrap.appendChild(box);
  return wrap;
}

function showProvisionalNotice(npub) {
  toast("Modo provisional: aun no se definio ADMIN_NPUB en js/config.js", "warn");
  var banner = document.createElement("div");
  banner.className = "banner warn";
  var t = document.createElement("span");
  t.textContent = "ADMIN_NPUB vacio: pega esta npub en js/config.js de este panel y del foro para que el baneo aplique a los visitantes. ";
  var code = document.createElement("code");
  code.textContent = npub;
  var cp = document.createElement("button");
  cp.type = "button";
  cp.className = "btn2";
  cp.textContent = "Copiar";
  cp.addEventListener("click", function () {
    copyText(npub);
    toast("npub copiada");
  });
  banner.appendChild(t);
  banner.appendChild(document.createElement("br"));
  banner.appendChild(code);
  banner.appendChild(cp);
  content.insertBefore(banner, content.firstChild);
}

/* ==================== panel (ya logueado) ==================== */
function renderPanel() {
  var wrap = document.createElement("div");
  wrap.className = "panel";

  updateChip();

  var tabs = document.createElement("nav");
  tabs.className = "tabs";
  [["panel", "Panel"], ["users", "Usuarios"], ["bans", "Baneos"]].forEach(function (t) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn" + (currentTab === t[0] ? " active" : "");
    btn.textContent = t[1];
    btn.dataset.tab = t[0];
    btn.addEventListener("click", function () {
      currentTab = t[0];
      render();
    });
    tabs.appendChild(btn);
  });
  var logout = document.createElement("button");
  logout.type = "button";
  logout.className = "btn2 logout-btn";
  logout.textContent = "Cerrar sesion";
  logout.addEventListener("click", function () {
    dashboard.stopDashboard();
    mod.closeLive();
    roles.closeLive();
    st.logout();
    currentTab = "panel";
    render();
  });
  tabs.appendChild(logout);
  wrap.appendChild(tabs);

  var holder = document.createElement("div");
  holder.id = "tab-content";
  wrap.appendChild(holder);
  content.appendChild(wrap);
  renderTab();
  return wrap;
}

function renderTab() {
  var c = document.getElementById("tab-content");
  if (!c) return;
  c.innerHTML = "";
  if (currentTab === "panel") {
    c.appendChild(dashboard.renderDashboard());
  } else if (currentTab === "users") {
    c.appendChild(renderUsers(rerender));
  } else {
    c.appendChild(renderBans(rerender));
  }
}

function updateChip() {
  chip.innerHTML = "";
  if (!st.hasAdmin()) { chip.textContent = ""; return; }
  var nm = document.createElement("span");
  nm.className = "name";
  nm.textContent = admin.name || admin.npub.slice(0, 14) + "\u2026";
  var np = document.createElement("span");
  np.className = "chip-npub";
  np.textContent = admin.npub;
  chip.appendChild(nm);
  chip.appendChild(np);
}

function render() {
  content.innerHTML = "";
  if (!st.hasAdmin()) {
    content.appendChild(renderLock());
  } else {
    renderPanel();
  }
}