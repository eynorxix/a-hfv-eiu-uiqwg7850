/* ===== utilidad de documento: notificacion visual (toast) ===== */

export function toast(message, type) {
  var wrap = document.getElementById("toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "toast-wrap";
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  var el = document.createElement("div");
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(function () {
    el.classList.add("out");
    setTimeout(function () { el.remove(); }, 350);
  }, 3800);
}

/* copia texto al portapapeles con respaldo para contextos que lo bloquean */
export function copyText(text) {
  var fallback = function () {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {}, fallback);
  } else {
    fallback();
  }
}