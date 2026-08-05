'use strict';
/**
 * Tiny, dependency-free ".env file" loader — so environment variables like
 * GEMINI_API_KEY don't have to be retyped in front of every `node server.js`
 * command. Written for this project instead of adding the `dotenv` npm
 * package for the same reason server/xlsx-lite.js exists instead of an xlsx
 * package: this is a small, well-understood format and pulling in a
 * dependency for ~20 lines of parsing isn't worth it.
 *
 * Behavior, matching the common `dotenv` package's conventions closely
 * enough that nothing here should surprise anyone who's used it before:
 *   - Looks for a file named `.env` in the project root (next to
 *     package.json), not the current working directory — so this works the
 *     same whether `node server.js` is run from the project root or
 *     somewhere else.
 *   - Comment lines (starting with #) and blank lines are skipped.
 *   - `KEY=value` — value is trimmed; surrounding single or double quotes
 *     are stripped so `KEY="value with spaces"` and `KEY=value` both work.
 *   - A REAL environment variable already set (e.g. passed on the command
 *     line, or exported in the shell) always wins over the .env file's
 *     value for that same key — .env is a fallback/default, never an
 *     override, so `GEMINI_API_KEY=xxx node server.js` still lets you
 *     temporarily use a different key without editing the file.
 *   - Missing .env file is silent and harmless (most people won't have
 *     one — e.g. on Vercel, real environment variables are always used and
 *     no .env file exists at all).
 *
 * Call loadDotEnv() as the very first thing server.js does, before any
 * other local module is required — server/store.js and server/storage.js
 * read process.env.SUPABASE_URL etc. at their own module top level (not
 * lazily inside a function), so this has to run before those requires, not
 * just before this app starts actually using the values.
 */
const fs = require('fs');
const path = require('path');

function loadDotEnv(envPath = path.join(__dirname, '..', '.env')) {
  let content;
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch (err) {
    return; // no .env file — perfectly normal, nothing to do
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

module.exports = { loadDotEnv };
