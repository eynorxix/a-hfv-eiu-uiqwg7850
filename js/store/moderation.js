/* ===== moderacion: envoltorio sobre roles para mantener compatibilidad =====
   La lista de baneados ya no es un conjunto plano: ahora forma parte del
   estado de roles (kind 39001, ver store/roles.js). Este modulo conserva la
   API antigua (ban/unban/isBanned/publishNow...) delegando en roles.js,
   para que las vistas de "Baneos" y otros consumidores sigan funcionando. */
import { BAN_KIND, BAN_DTAG } from "../config.js";
import { getNip19 } from "../utils/nostr-lib.js";
import * as roles from "./roles.js";

export function normalizePub(input) { return roles.normalizePub(input); }

/* un usuario esta baneado si su status en roles es "banned" */
export function isBanned(pubHex) { return roles.isBanned(pubHex); }

export function currentList() {
  return roles.currentList().filter(function (hex) { return roles.statusOf(hex) === "banned"; });
}
export function publishedList() {
  return roles.publishedList().filter(function (hex) { return roles.statusOf(hex) === "banned"; });
}

export function ban(pubHex) { roles.setStatus(pubHex, "banned"); }
export function unban(pubHex) { roles.setStatus(pubHex, "activo"); }

export function onBanChange(cb) { roles.onRolesChange(cb); }

export function refreshPublished() { return roles.refreshPublished(); }
export function subscribePublished() { return roles.subscribePublished(); }
export function closeLive() { return roles.closeLive(); }
export function publishNow() { return roles.publishNow(); }

/* bloque exportable para pegar en js/config.js del foro (npubs) */
export function exportConfigBlock() {
  var hexes = currentList();
  return getNip19().then(function (nip19) {
    var lines = hexes.map(function (hex) { return "  \"" + nip19.npubEncode(hex) + "\""; });
    return "export var BANNED_NPUBS = [\n" + lines.join(",\n") + "\n];\n";
  });
}

export { BAN_KIND, BAN_DTAG };