'use strict';
// Compatibility alias. The real server now lives in server.js at the
// project root — Vercel's zero-config Node server detection requires a
// file literally named server.js there (see that file's header comment,
// and the Go-Live Guide, for why). render.yaml's startCommand has been
// updated to call `node server.js` directly; this file just keeps the old
// `node server/index.js` path working too, in case anything still uses it.
require('../server.js');
