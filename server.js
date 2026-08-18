'use strict';
/**
 * Canonical server entry point — used for local development, for Render
 * (see render.yaml's startCommand), and for Vercel.
 *
 * On Vercel specifically, this file's NAME and LOCATION are load-bearing:
 * Vercel looks for a file literally named server.{js,cjs,mjs,ts,cts,mts}
 * at the project root (or src/), and — seeing the server.listen() call at
 * the bottom of this file run during module startup — "captures" it as a
 * single Vercel Function that receives every incoming request. No
 * vercel.json is needed for this ("zero configuration" is the actual name
 * Vercel gives this feature). See the Go-Live Guide for the full
 * walkthrough and for why this file lives at the project root rather than
 * inside server/ alongside the modules it uses.
 *
 * seed() (server/seed.js) is async because store.js (server/store.js)
 * talks to Supabase over the network rather than reading local disk. It's
 * awaited lazily, on the first request, rather than at module top level —
 * that way server.listen() below still runs immediately and synchronously
 * at module load, exactly matching what Vercel's own docs show and expect
 * from this file. seed() is idempotent (it checks Supabase for existing
 * users before inserting anything), so re-running it on every cold start
 * is harmless and cheap once the database has already been seeded once.
 */
// Load a project-root .env file (if any) BEFORE anything else — this has
// to come before every other require() below, since server/store.js and
// server/storage.js read process.env.SUPABASE_URL etc. at their own module
// top level (not lazily inside a function). See server/dotenv-lite.js for
// exactly what this does and why it's a small hand-written loader rather
// than the `dotenv` npm package.
require('./server/dotenv-lite').loadDotEnv();

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { readBody, sendJson } = require('./server/router');
const { mimeFor } = require('./server/mime');
const router = require('./server/routes');
const { seed } = require('./server/seed');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

// Run once per warm process (cold start), not once per request. If seeding
// fails (e.g. Supabase env vars misconfigured), clear the cached promise
// so the next request tries again instead of caching a permanent failure.
let seedPromise = null;
function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

function serveStatic(req, res, pathname) {
  let filePath = pathname === '/' ? '/index.html' : pathname;
  let fullPath = path.join(PUBLIC_DIR, filePath);

  // prevent path traversal
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback: unknown non-api routes serve index.html
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, content) => {
        if (err2) {
          res.writeHead(404);
          return res.end('Not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeFor(fullPath), 'Content-Length': stat.size });
    fs.createReadStream(fullPath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  // Basic hardening headers on every response (safe, zero risk of breaking
  // the UI — unlike a strict Content-Security-Policy, which would need the
  // frontend's inline `style="..."` attributes reviewed first; see README).
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    await ensureSeeded();

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (!pathname.startsWith('/api/')) {
      return serveStatic(req, res, pathname);
    }

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
});

server.listen(PORT, () => {
  console.log(`Legal Genie running at http://localhost:${PORT}`);
});

// Due-today follow-up email reminders (added 2026-08-18) — see
// server/routes.js's checkAndSendFollowUpReminders for what this actually
// does and server/email.js for the one-time Resend setup. Runs once shortly
// after boot (so a reminder due today still goes out even if the process
// was only just (re)started), then hourly after that. Requires this process
// to keep running continuously to ever fire — harmless but ineffective in a
// serverless deployment (e.g. Vercel, where each request spins up a fresh,
// short-lived instance) since the interval never gets the chance to tick;
// this is written for the persistent Render deployment (see render.yaml)
// or a long-running local `node server.js` session. Each call is
// independently try/caught and awaits its own ensureSeeded() so it can't
// run against an un-seeded store, and a single failure (e.g. Resend not
// configured yet) never crashes the timer itself.
const FOLLOW_UP_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
async function runFollowUpReminderCheck() {
  try {
    await ensureSeeded();
    await router.runDueFollowUpReminders();
  } catch (err) {
    console.error('[email] follow-up reminder check failed:', err.message);
  }
}
setTimeout(runFollowUpReminderCheck, 30 * 1000);
setInterval(runFollowUpReminderCheck, FOLLOW_UP_CHECK_INTERVAL_MS);
