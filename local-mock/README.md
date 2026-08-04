# Local mock database (no real Supabase project needed)

This folder contains a **fake, in-memory `@supabase/supabase-js` package**
that behaves like a tiny local database — no real Supabase project, no
internet connection, no real credentials required. It's for trying out the
app (and testing new features like AI smart-fill / AI Assistant) on your
own machine without touching your real, live data.

**This is never used in production** — Vercel doesn't know this folder
exists, and it's already excluded from git by `.gitignore` (anything named
`node_modules` is ignored, at any depth), so it's safe to leave sitting
here in your project folder; it will never get committed or deployed.

## How to use it

```bash
cd ~/Downloads/"lms 3"
npm install
SUPABASE_URL=http://local-mock \
SUPABASE_SERVICE_ROLE_KEY=local-mock-key \
GEMINI_API_KEY=你的 Gemini API key \
node server.js
```

Then open **http://localhost:3000**.

- `SUPABASE_URL` must be **exactly** `http://local-mock` (that literal
  string) — `server/store.js` and `server/storage.js` check for that exact
  value to know to load this folder's fake package instead of the real
  `@supabase/supabase-js`. `SUPABASE_SERVICE_ROLE_KEY` can be anything
  (the mock ignores its actual value, it just needs to be *present* — same
  startup check the real thing has).
- `GEMINI_API_KEY` is still optional here too — leave it out and
  everything works except the AI buttons, same as always. Get a free one
  (no credit card) at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
- Every time you stop (Ctrl+C) and restart `node server.js`, the data
  resets and gets freshly re-seeded with the same demo accounts
  (admin/admin123, etc.) — nothing persists between runs. That's normal
  and often exactly what you want for repeated testing.
- This is completely separate from your real Supabase database — nothing
  you do here (creating test cases, uploading test files, etc.) ever
  touches your actual production data.

(An earlier version of this instruction also set `NODE_PATH=...` — that's
no longer needed and can be dropped. It turned out not to reliably work
once `npm install` had installed the real `@supabase/supabase-js` package,
since Node's module resolution checks the ordinary `node_modules` folder
*before* ever consulting `NODE_PATH`, so the real package won regardless.
`store.js`/`storage.js` now detect the `http://local-mock` sentinel
directly instead.)

## When NOT to use this

If you want to test against your *real* data (e.g. to confirm something
works with your actual cases/contracts before it goes live), use your real
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` instead — see the main
README's "Running it locally" section.
