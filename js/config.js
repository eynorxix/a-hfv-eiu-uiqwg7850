/* ===== configuracion del panel de control de ForosRaiz =====
   ADMIN_NPUB: la npub del admin del foro. Los baneos que publique ESTE
   panel solo seran tomados en serio por los visitantes si aqui y en
   js/config.js del repo tox-forum figura la MISMA npub.
   Si lo dejas vacio, el panel funciona en modo "provisional": usa la
   clave que introduzcas, pero el foro no confiara en sus baneos. */

export var ADMIN_NPUB = "npub12us3dz6l88e9v3j6qhcpru9wp0jh2tk02zrd2uqcvkyezf257jrq2cyel2";   /* ejemplo: "npub1qf0..." */

export var PAGE = "https://eynorxix.github.io/Admin_forum/";

/* mismos relays que el foro */
export var RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://nostr.mom",
  "wss://relay.ditto.pub",
  "wss://antiprimal.net",
];

/* kinds del contrato con tox-forum (ver CONTROL_PANEL.md) */
export var POST_KIND = 33033;   /* posts del foro */
export var BAN_KIND = 39000;    /* lista de baneados del admin (legacy) */
export var BAN_DTAG = "forosraiz-banlist-v1";
export var REG_KIND = 13370;    /* registro de usuario (publicado por el usuario) */
export var REG_DTAG = "forosraiz-user-v1";
export var ROLE_KIND = 39001;   /* roles y baneos del admin (reemplaza 39000) */
export var ROLE_DTAG = "forosraiz-roles-v1";
