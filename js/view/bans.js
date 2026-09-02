/* ===== gestion de baneos: lista, publicacion en relays y exportacion ===== */
import { esc } from "../utils/text.js";
import { nameOf } from "../store/state.js";
import {
  currentList, publishedList, unban, publishNow, exportConfigBlock
} from "../store/moderation.js";
import { copyText, toast } from "../utils/dom.js";
import { RELAYS } from "../config.js";

export function renderBans(rerender) {
  var wrap = document.createElement("div");
  wrap.className = "bans-view";

  var h = document.createElement("h3");
  h.textContent = "Lista de baneados";
  wrap.appendChild(h);

  var bl = document.createElement("p");
  bl.className = "rp-text";
  bl.textContent = "Se publica entera en los relays como un evento kind 39000 firmado con tu clave. Los visitantes del foro la leen y dejan de mostrar a los baneados al instante.";
  wrap.appendChild(bl);

  var counts = document.createElement("p");
  counts.className = "counts";
  counts.textContent = "En lista: " + currentList().length + "  ·  Publicados en relays: " + publishedList().length;
  wrap.appendChild(counts);

  var publishBtn = document.createElement("button");
  publishBtn.type = "button";
  publishBtn.className = "btn2 primary publish-btn";
  publishBtn.textContent = "Publicar lista en relays";
  publishBtn.addEventListener("click", function () {
    publishBtn.disabled = true;
    publishBtn.textContent = "Publicando\u2026";
    publishNow().then(function (ok) {
      publishBtn.disabled = false;
      if (ok >= RELAYS.length / 2) {
        toast("Lista publicada en " + ok + "/" + RELAYS.length + " relays");
      } else if (ok > 0) {
        toast("Solo " + ok + "/" + RELAYS.length + " relays la recibieron", "warn");
      } else {
        toast("Sin conexion a relays: revisa tu clave activa", "err");
      }
      rerender();
    });
  });
  wrap.appendChild(publishBtn);

  var list = currentList();
  if (list.length === 0) {
    var empty = document.createElement("p");
    empty.className = "rp-text";
    empty.textContent = "No hay baneados. Desde el Panel puedes banear autores, o desde Usuarios buscarlos por npub.";
    wrap.appendChild(empty);
  } else {
    var ul = document.createElement("ul");
    ul.className = "ban-list";
    list.forEach(function (hex) {
      var li = document.createElement("li");
      li.className = "ban-item";
      var nm = document.createElement("span");
      nm.className = "name";
      nm.textContent = nameOf(hex);
      nm.title = hex;
      li.appendChild(nm);
      var code = document.createElement("code");
      code.textContent = hex.slice(0, 12) + "\u2026";
      code.title = hex;
      li.appendChild(code);
      var state = document.createElement("span");
      state.className = publishedList().indexOf(hex) >= 0 ? "pub-yes" : "pub-no";
      state.textContent = publishedList().indexOf(hex) >= 0 ? "en relays" : "pendiente";
      li.appendChild(state);
      var ub = document.createElement("button");
      ub.type = "button";
      ub.className = "btn2";
      ub.textContent = "Desbanear";
      ub.addEventListener("click", function () {
        unban(hex);
        toast("Desbaneado: " + hex.slice(0, 10));
        rerender();
      });
      li.appendChild(ub);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
  }

  var expH = document.createElement("h4");
  expH.textContent = "Exportar bloque para js/config.js del foro";
  wrap.appendChild(expH);
  var expP = document.createElement("p");
  expP.className = "rp-text";
  expP.textContent = "Alternativa manual / copia de seguridad: este bloque se puede pegar en BANNED_NPUBS y publicar el foro (hace falta un push a GitHub). El panel lo mantiene al dia solo con el boton de publicar.";
  wrap.appendChild(expP);

  exportConfigBlock().then(function (block) {
    var ta = document.createElement("textarea");
    ta.readOnly = true;
    ta.value = block;
    ta.rows = Math.min(12, Math.max(3, block.split("\n").length));
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn2";
    copyBtn.textContent = "Copiar";
    copyBtn.addEventListener("click", function () {
      copyText(block);
      toast("Bloque copiado al portapapeles");
    });
    wrap.appendChild(ta);
    wrap.appendChild(copyBtn);
  });

  return wrap;
}