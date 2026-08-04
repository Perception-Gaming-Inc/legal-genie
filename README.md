# Legal Genie

An internal web application for the Legal Department of a gaming machine and
online gaming manufacturer. Covers case management, contract management,
regulatory compliance tracking, a document center, task management, an
approval workflow, notifications, and role-based user administration.

This started as a **working prototype for pilot use and demonstration** and
has since been hardened and re-architected for a real, hosted go-live on a
free-tier stack: **Vercel** (application hosting) + **Supabase** (managed
Postgres database + file storage). See the separate **Go-Live Guide**
document for the full reasoning, cost breakdown, and click-by-click
deployment steps.

An earlier, fully self-contained version of this app — running on Node's
built-in SQLite (`node:sqlite`) with zero external packages, deployable to
Render — was built and tested first, and is preserved as a fallback path.
See "Two deployment paths" below if you ever want to switch back to it.

## Requirements

- **To run locally:** Node.js 22.x (matches the version pinned in
  `package.json`'s `engines` field and used in testing), plus `npm install`
  once (to fetch `@supabase/supabase-js`) and a Supabase project's
  credentials (see the Go-Live Guide to create one — it's free).
- **To actually go live:** a Vercel account and a Supabase account (both
  free tiers work; see the Go-Live Guide for the tradeoffs of the free
  tiers vs. paid).

## Running it locally

```bash
cd legal-genie
npm install
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node server.js
```

Then open **http://localhost:3000** in a browser.

Unlike the earlier prototype, there's no local database file created
automatically — `server/store.js` talks to your Supabase project over the
network, so you need a Supabase project already created with the schema
from `server/supabase-schema.sql` run once (Dashboard → SQL Editor → paste
the file's contents → Run). The Go-Live Guide walks through this
end-to-end, including creating the Storage bucket documents/contract
files are saved to.

On first request after boot, the app seeds your (empty) database with
sample departments, roles, users, cases, contracts, compliance items,
documents, tasks, approvals and notifications, so you can explore every
module immediately. This seeding is safe to leave in place — it checks for
existing users first and does nothing if your database already has data,
so it won't ever duplicate records on a later restart or redeploy.

### Demo accounts

| Username | Password      | Role          |
|----------|---------------|---------------|
| admin    | admin123      | Admin (full access) |
| jchen    | password123   | Legal Manager |
| mtan     | password123   | Legal Staff   |
| lwong    | password123   | Legal Staff   |
| viewer   | password123   | Viewer (read-only) |

**Change these before real use** — see "Known limitations & before you
launch" below.

To run on a different port locally: `PORT=8080 node server.js`.

## What's included

- **Dashboard** – pending tasks, upcoming deadlines (cases/contracts/compliance), recent notifications, pending approvals.
- **Case Management** – create/view/edit/close cases; owner, priority, status, deadline, notes.
- **Contract Management** – contract records, counterparty, dates, status, and a version history log (with optional file upload per version).
- **Compliance** – country/regulation/requirement tracker with due dates and status.
- **Document Center** – categorized documents (Templates, Policies, Agreements, Certificates, Other) with upload/download, linkable to a case or contract.
- **Task Management** – personal and team tasks with status and due dates, linkable to a case/contract.
- **Approval Center** – submit a request, assign a reviewer, approve/reject with comments; requester is notified of the decision.
- **Notification Center** – contract expiry, compliance due dates, approval decisions, task assignments.
- **Settings** – Users, Roles & Permissions (view/create/edit/delete/approve per module), Departments.

Role-based access control is enforced on both the API (server-side, so it
cannot be bypassed) and the UI (relevant buttons/nav items hidden per role).

## Architecture

```
legal-genie/
├── server.js              Vercel entry point (also used for local dev &
│                           Render) — HTTP server, static file serving,
│                           request routing. Must stay named server.js at
│                           the project root: Vercel auto-detects it.
├── server/
│   ├── index.js            Thin compatibility alias -> ../server.js
│   ├── router.js           Minimal router + JSON body parsing (no Express)
│   ├── store.js             Supabase (Postgres) datastore — active path
│   ├── storage.js           Supabase Storage file handling — active path
│   ├── supabase-schema.sql  Run once in Supabase's SQL editor before first deploy
│   ├── store.sqlite-backup.js  Preserved SQLite datastore (Render fallback path — see below)
│   ├── auth.js              Password hashing (PBKDF2), sessions, lockout, permission checks
│   ├── seed.js              Demo data seeding (safe to re-run; no-ops once seeded)
│   ├── mime.js              Static file content-type lookup
│   └── routes.js            All REST API endpoints
├── public/               Frontend (vanilla JS + a small self-contained CSS
│   ├── index.html        framework — no React/Vue/Bootstrap CDN dependency)
│   ├── css/
│   │   ├── fonts.css      Self-hosted "Carlito" typeface (base64-embedded, see note below)
│   │   ├── bootstrap-lite.css
│   │   └── style.css
│   └── js/
├── package.json          Declares @supabase/supabase-js (Vercel's build runs npm install)
├── render.yaml           Render Blueprint — Render fallback path only (see below)
└── .node-version         Pins the Node version for Render specifically
```

The backend is a single Node.js HTTP server (`server.js`, built on the
`http` module — no Express or other web framework). The frontend is a
single-page app (hash-based routing) that talks to a JSON REST API under
`/api/...`. Authentication uses a bearer session token (created on login,
checked on every API call, 12-hour expiry); passwords are hashed with
PBKDF2/SHA-512, never stored in plain text; accounts lock for 15 minutes
after 5 failed login attempts.

The UI font ("Carlito", a metric-compatible, modern-looking alternative to
Calibri) is embedded directly in `fonts.css` as base64 so no internet
connection or system font is required at runtime. It is licensed under the
SIL Open Font License 1.1, which permits bundling with software; the license
text can be found at https://openfontlicense.org.

## Data model

Supabase (a hosted Postgres database) holds a single `records` table:
`(collection, id, data jsonb, created_at)`, primary key `(collection, id)`
— one row per record, keyed by which collection it belongs to (`users`,
`roles`, `departments`, `cases`, `caseNotes`, `contracts`,
`contractVersions`, `compliance`, `documents`, `tasks`, `approvals`,
`notifications`, `sessions`), with the record itself kept as a JSONB blob.
This mirrors the shape the app already used in its earlier prototype and
SQLite phases, which kept the actual business logic in `routes.js`/`auth.js`
essentially unchanged through every datastore swap — only `store.js` itself
differs between deployment paths. See `server/supabase-schema.sql` for the
exact schema, including the `increment_counter` function used for
human-readable sequential numbers like `CASE-0001` / `CTR-0001`.

**Row Level Security is intentionally left off** on these tables — this
app's own server-side code enforces every permission check before it ever
queries the database, and always connects with the Supabase *service role*
key (never the public anon key), so RLS would be redundant. This means the
service role key must never be exposed to the browser or committed to
source control — see the Go-Live Guide's environment variable setup.

## Two deployment paths

This project has been built and tested against two different hosting
architectures at different points, and both are preserved in this folder:

1. **Vercel + Supabase (current, recommended path)** — `server.js` (root),
   `server/store.js`, `server/storage.js`, `server/supabase-schema.sql`,
   `package.json`. Both free tiers. See the Go-Live Guide.
2. **Render + embedded SQLite (earlier, preserved fallback)** — built and
   tested first; kept in case you ever want a single-host, no-external-
   database alternative. `render.yaml` and `.node-version` are a ready-made
   Render Blueprint; `server/store.sqlite-backup.js` is the working
   SQLite-based datastore from that phase.

   **If you ever want to switch back to this path**, it's not quite a
   single file swap any more: copy `store.sqlite-backup.js` over
   `server/store.js`, **and** restore local-disk file upload handling in
   `server/routes.js` (it currently calls `server/storage.js`, which is
   Supabase-Storage-specific — the Supabase-Storage-based version doesn't
   fall back to local disk on its own). Ask your developer (or Claude, in a
   new session) to help with this if you need it; it's a contained, well-
   understood change, just not something to do casually by hand.

Everything else — the frontend, the business logic in `routes.js`/`auth.js`,
the permission model, the seed data — is identical between both paths.

## Known limitations & before you launch

- **Change the demo account passwords** (or delete the demo accounts
  entirely) before giving real staff access — `server/seed.js` creates them
  with well-known passwords for evaluation purposes.
- **Vercel Hobby (free) plan is restricted to personal, non-commercial use**
  per Vercel's own terms. Running a company's internal legal department
  tool on it is a judgment call/accepted risk if you're on the free tier —
  see the Go-Live Guide for the full discussion and what upgrading to Pro
  changes (and doesn't change).
- **4.5 MB request/response size limit on Vercel Functions** (Hobby and
  Pro both) — this applies to document uploads and downloads, since both
  go through the same server function. Most Office documents and simple
  PDFs are well under this; large scanned/bundled PDFs may not be. See the
  Go-Live Guide for what to do if this becomes a real problem (a follow-up
  enhancement — direct browser-to-Supabase-Storage upload — removes the
  limit entirely, but wasn't built now since it's a larger change than
  today's migration).
- **Supabase free tier**: 500 MB database, 1 GB file storage, and the
  project auto-pauses after 7 days with no activity (an admin visit to the
  dashboard, or the first request after a pause, un-pauses it — see the
  Go-Live Guide).

## Path to production

1. **Database** — ✅ done. Managed Postgres via Supabase, with atomic
   sequence numbers (`increment_counter`) and no local disk to lose.
2. **File storage** — ✅ done. Documents and contract version files live in
   Supabase Storage, not local disk (which wouldn't persist reliably on
   Vercel's serverless functions anyway).
3. **Auth hardening** — ✅ partially done: accounts now lock for 15 minutes
   after 5 failed login attempts. Still open: password complexity rules,
   SSO/SAML integration with corporate identity if required, shorter/
   refreshable session tokens.
4. **HTTPS & hosting** — ✅ done. Vercel provisions HTTPS automatically.
5. **Backups** — Supabase's paid tiers include automated backups; the free
   tier does not. Worth revisiting if/when this moves off the free tier.
6. **Audit trail** — the data model already timestamps records
   (`createdAt`/`updatedAt`); a dedicated audit log table for immutable
   history (who viewed/changed what) is still a future addition, not yet
   built.
7. **Testing & code review** — the Supabase/Vercel rewrite was verified
   with an in-memory mock of the Supabase client covering login/lockout,
   dashboard aggregation, sequential numbering, file upload+download
   round-tripping, and the notifications bulk-read endpoint — but this
   sandbox has no network access to test against a *real* Supabase project
   or a real Vercel deployment, so that first real end-to-end check happens
   after you deploy (the Go-Live Guide has a smoke-test checklist for
   exactly that). There is still no automated test suite committed to the
   project — add one before treating this as fully production-grade.
8. **Basic security headers** — ✅ done (`X-Content-Type-Options`,
   `X-Frame-Options`, `Referrer-Policy` on every response). A stricter
   Content-Security-Policy is a further improvement, but would need the
   frontend's inline `style="..."` attributes reviewed first so it doesn't
   break the UI.

None of the above require rewriting the module logic (cases, contracts,
compliance, etc.) — they are infrastructure hardening steps around the
existing application.

## Future expansion (from the original proposal)

- AI-assisted contract review
- Automated contract expiration reminders (email/SMS)
- A structured regulatory database per jurisdiction
- Game certification tracking
- IP management module
- Reporting & analytics dashboard

The module structure and permission model were designed so these can be
added as new modules/routes without changing the core architecture — see
the accompanying technical specification document for details.
