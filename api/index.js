'use strict';
/**
 * Vercel entry point using the classic, well-established "/api directory"
 * convention — one file per deployment unit, mapped 1:1 to a route by
 * Vercel, with vercel.json rewriting every /api/* request to this single
 * file so our own server/router.js can do the actual path matching
 * (/api/cases, /api/cases/:id, etc.) exactly as it already did.
 *
 * This replaces the newer "captured server.js" zero-config approach
 * (still present at ../server.js, still used for local dev and for the
 * Render fallback path) — that approach was expected to auto-detect
 * server.js with no configuration at all, but in production it silently
 * fell back to a static-only deployment (Vercel's build log showed a
 * ~30ms build with no `npm install` and no Function created), so this
 * project pins to the older, unambiguous convention instead, which has no
 * such auto-detection step to get wrong. See the Go-Live Guide for the
 * full story.
 *
 * Static frontend files (public/**) are NOT served from here — Vercel
 * serves that directory directly via its CDN with zero configuration,
 * which is also simpler/faster than routing those requests through this
 * function. This file only ever needs to handle /api/* requests.
 */
const { readBody, sendJson } = require('../server/router');
const router = require('../server/routes');
const { seed } = require('../server/seed');

let seedPromise = null;
function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seed().catch((err) => {
      seedPromise = null; // allow a retry on the next request
      throw err;
    });
  }
  return seedPromise;
}

module.exports = async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    await ensureSeeded();

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    const match = router.match(req.method, pathname);
    if (!match) {
      return sendJson(res, 404, { error: `No API route for ${req.method} ${pathname}` });
    }

    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = await readBody(req);
    }

    const query = Object.fromEntries(url.searchParams.entries());
    const handler = match.handlers[0];
    await handler(req, res, match.params, body, query);
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Internal server error', detail: err.message });
    }
  }
};
