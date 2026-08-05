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
- **Data now persists across restarts.** Every mutating action (creating a
  case, running the Excel import, editing something, etc.) is saved to
  `local-mock/data.json` right away, and that file is read back in the next
  time `node server.js` starts — so stopping the server (Ctrl+C, or an
  EADDRINUSE forcing a restart, or picking up a backend code change) no
  longer throws away test data like an imported real workbook. Seeding
  (the demo accounts, 5 sample cases) only ever happens once, on a
  genuinely empty database, exactly like the real Supabase-backed path —
  it won't run again just because you restarted.
  - **Want a genuinely fresh start** (back to only the 5 seeded demo
    cases)? Stop the server and delete the snapshot file:
    `rm local-mock/data.json`, then start `node server.js` again.
  - **Want to keep your imported data but remove just the 5 built-in demo
    cases** (e.g. after running `import-real-data.js`, so Case Management
    shows only your real games)? Run
    `node local-mock/remove-seed-demo-cases.js` — see that file's own
    header comment for details. It matches by exact title, so it never
    touches a real imported case even though two of the five demo cases
    (like your real ones) have a Provider set.
  - **Want to remove the 6 placeholder demo documents in Document Center
    too** (Standard NDA Template, AML Policy, etc.)? These all seed with no
    actual file attached (`filePath: null` — that's why their filename
    shows as plain text instead of a download link), so there's nothing
    real to lose by deleting them. Run
    `node local-mock/remove-seed-demo-documents.js` — same exact-title
    matching approach, safe to run even if you've already uploaded real
    documents.
  - This file is your own local test data, so it's already excluded from
    git via `.gitignore` (`local-mock/data.json`) — it'll never get
    committed or pushed.
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
