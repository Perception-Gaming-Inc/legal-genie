# Legal Genie

An internal web application for the Legal Department of a gaming machine and
online gaming manufacturer. Covers case management, contract management,
a document center, task management, an approval workflow, notifications,
and role-based user administration.

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
sample departments, roles, users, cases, contracts,
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

- **Dashboard** – pending tasks, pending approvals (with inline approve/reject, right on the Dashboard), 30-day PAGCOR follow-up reminders, upcoming deadlines (cases/contracts), PAGCOR submission pipeline overview.
- **Case Management** – create/view/edit/close cases; owner, priority, status, deadline, notes.
- **Contract Management** – contract records, counterparty, dates, status, and a version history log (with optional file upload per version).
- **Document Center** – browsed via Provider tabs (All + one per Provider) over a game list showing Game Title/Game ID/latest upload date, drilling into each game's own document list (built from each document's own Provider/Game Title/Game ID, no separate data model); categorized (Templates, Policies, Agreements, Certificates, Other) with upload/download, linkable to a case or contract; optional AI-generated summary + key facts per document.
- **Task Management** – personal and team tasks with status and due dates, linkable to a case/contract.
- **Approval Center** – submit a request, assign a reviewer, approve/reject with comments; requester is notified of the decision. No longer has its own sidebar entry — day-to-day, pending approvals surface right on the Dashboard (see above); the full page (approval history, etc.) is still reachable at `#/approvals`.
- **Notification Center** – contract expiry, approval decisions, task assignments. Same as Approval Center: no sidebar entry, reachable via the bell icon in the top bar (which also shows an unread-count badge); the full page is still at `#/notifications`.
- **Settings** – Users, Roles & Permissions (view/create/edit/delete/approve per module), Departments.
- **Audit Log** (Admin-only) – system-wide activity feed covering every module (cases, documents, tasks, knowledge base, calendar, approvals, users, roles, departments, settings), plus the original per-field diffs on 6 audited case/game fields. See "System-Wide Activity Log" below.

Role-based access control is enforced on both the API (server-side, so it
cannot be bypassed) and the UI (relevant buttons/nav items hidden per role).

## AI smart-fill (optional)

The "New Case" / "New Contract" / "Upload Document"
forms each have an **AI smart-fill** panel at the top. Paste
in free text (an email, a case summary, a contract excerpt, a regulator's
notice...) and/or upload a file (PDF, image, plain text, or **.xlsx Excel**),
click **"AI Fill"**, and Gemini reads it and pre-fills the matching fields
below — title, type, priority, dates, a summary, etc. Nothing is ever
submitted automatically: the form is just pre-filled, so the person still
reviews and edits before saving, same as filling it by hand.

**Excel (.xlsx) uploads** go through the same dependency-free `.xlsx` reader
already used by Case Management's own Excel-import feature (`server/xlsx-lite.js`
— hand-rolled because this environment has no npm registry access to
install a spreadsheet library; see that file's header comment). Since
Gemini has no native "spreadsheet" input type the way it does for PDF/
images, the workbook is converted into a flat, tab-separated text table
first (`xlsxToText()`) and sent the same way pasted-in text is. Legacy
`.xls` (the older, pre-2007 binary format) isn't supported — only `.xlsx`.

**This is entirely optional.** Every other part of the app works exactly
the same with or without it configured — if the API key below isn't set,
only the "AI Fill" button itself shows a message asking to set it up;
nothing else is affected.

Uses **Google's Gemini API** specifically (rather than a paid-only
provider) because it has a genuinely free tier — no credit card required,
just rate limits (requests-per-minute/day caps; see below).

### Setup (one-time, free)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
   sign in with a Google account, and create an API key — no credit card
   needed for the free tier.
2. Set an environment variable **`GEMINI_API_KEY`** to that key. Two
   different places depending on where you're running the app — you don't
   need to redo this every time you restart `node server.js` locally:
   - **Locally:** copy `.env.example` to `.env` (`cp .env.example .env`) in
     the project root and fill in `GEMINI_API_KEY=` there. `node server.js`
     picks it up automatically from then on — no need to type it in front
     of the command again. `.env` is already in `.gitignore`, so it never
     gets committed; `.env.example` (safe, no real key) is what's checked
     into git instead, as a template. See server/dotenv-lite.js for exactly
     how this is loaded, and the note below on real environment variables
     always taking priority over `.env`.
   - **On Vercel:** Project Settings → Environment Variables (same place
     `SUPABASE_URL` lives; see the Go-Live Guide for the click-by-click
     steps if needed), then redeploy. This is unrelated to the `.env` file
     above — Vercel never reads a `.env` file, only its own dashboard
     settings — and, same idea, only needs doing once, not per-deployment.
3. That's it — no other setup, database changes, or billing required.

If you ever need to temporarily use a different key without editing `.env`,
a real environment variable still wins: `GEMINI_API_KEY=xxx node server.js`
overrides whatever's in the file for that one run.

The free tier has rate limits (a cap on requests per minute/day, not
money) — check your account's current limits at
[aistudio.google.com/rate-limit](https://aistudio.google.com/rate-limit)
after signing in. If your team's usage ever needs more headroom than the
free tier allows, linking a billing account raises those limits (see
[ai.google.dev/gemini-api/docs/billing](https://ai.google.dev/gemini-api/docs/billing)) —
not required to get started, though.

Optionally, set **`GEMINI_MODEL`** to a different model ID (from
[Google's model list](https://ai.google.dev/gemini-api/docs/models)) if you
want to use a newer/faster model later; the app ships with a safe,
known-working default (`gemini-3.6-flash`) so this isn't required to get
started.

### What it can and can't read

- **Pasted text** — always works, for any field.
- **PDF and image files (PNG/JPG/GIF/WEBP)** — read directly.
- **Plain text files (.txt)** — read directly.
- **Word/Excel files (.docx/.xlsx) and other formats** — not supported
  directly; copy the relevant text and paste it instead, or save/print the
  file to PDF first.

Fields that reference another record by internal ID — Owner, Assignee,
Related Case/Contract — are intentionally left for the person to pick from
the dropdown; the AI has no way to know your team's user IDs or your
existing case/contract IDs, so it never guesses those.

See `server/ai.js` for the implementation (all extraction schemas per
module live there, in one place, if you want to adjust what it looks for).

## AI document summary — "AI Key Points" (optional)

Any Document Center row with a file attached gets a sparkle-icon button.
Click it and Gemini reads the actual stored file (RNG report, LOA letter,
contract scan, whatever it is) and returns a short plain-language summary
plus a handful of key facts, so you don't have to open and read the whole
document just to know what's in it.

This is deliberately **just a summary, not a review**: it only reports what
the document says, and it never judges whether the document is correct,
complete, or meets any requirement — see `server/ai.js`'s
`summarizeDocument` for why that's an intentional scope boundary rather
than a missing feature. If you later want an actual compliance/completeness
checker (e.g. "does this RNG report have everything PAGCOR requires"), that
needs a real checklist of what each document type must contain — Gemini's
general knowledge of what these documents typically look like can get you
a reasonable starting point, but a properly reliable version needs your own
domain checklist to check against.

Shares the same `GEMINI_API_KEY` setup as AI smart-fill above.

## AI Assistant (optional)

A chat panel — the **"AI Assistant"** item at the top of the sidebar,
available to everyone regardless of role. Instead of navigating to a
specific module, just describe what you want in plain language:

- *"Find all Philippine client license agreements from last year"* (find
  something) — the assistant searches cases/contracts/documents and answers
  directly.
- *"Create a high-priority commercial case with me as the owner"* (create
  something) — the
  assistant proposes the record it would create (title, type, priority,
  owner, etc. — resolved to your team's real names) as a card with
  **"Confirm" / "Cancel"** buttons. Nothing is written to the database until
  you click confirm — the assistant never creates or changes a record on
  its own.

It shares the same `GEMINI_API_KEY` setup as AI smart-fill above — no
separate setup needed. It also respects the same permission model as the
rest of the app: a Viewer can still ask it to search/look things up, but
if they ask it to create a case, confirming that proposal is rejected with
the same permission error the "New Case" button itself would give them —
the assistant is a shortcut for using the app, not a way around its
permission checks.

**What it does not do yet** (deliberately deferred — see `server/assistant.js`'s
comments for why): it does not read your email/Teams/ERP system to create
cases on its own, and it does not monitor regulatory changes in the
background — both would require integrating a real external system
(mailbox OAuth access, a paid legal/regulatory data feed) that isn't set up
today. Today, a person always types the request that starts things off.

## Document Center — Provider tabs + game list

Document Center replaced its old flat table with a **Provider tab bar over a
list of games**, instead of one flat table. This came directly from feedback
that with hundreds of documents, a flat list stopped being a usable way to
find "all the paperwork for this one game" — and that switching companies
should just re-filter the same list rather than jump to a whole new page.
The grouping is built from fields documents already carry (`provider` /
`gameTitle` — set on upload, by AI smart-fill, or by the batch upload on a
Case's own detail page below), so there's no new data model: a document
with no Provider set falls
into an "Uncategorized Provider" tab, and one with a Provider but no Game
Title falls into an "Uncategorized Game" row within that Provider, rather
than disappearing.

The tab bar reads **All** + one tab per Provider that actually has
documents; clicking a tab filters the game list below it in place — "All"
shows every game across every Provider. Each row in that list is one game,
showing only **Game Title / Game ID / most recent upload date** — everything
else (Category, Report Type, individual files, who uploaded what) stays
hidden until you click into that game. Game ID is its own field directly on
the document (settable on upload, or by AI smart-fill reading the file's
content) — deliberately not looked up from a matching Case, so it still
shows even for games with no Case created yet.

Clicking a game row opens that game's document list — Title / File /
Uploaded By / Uploaded, plus the AI summarize / edit / delete actions.
Category and Report Type are deliberately **not** shown anywhere in this
view: Document Center's job here is just filing and finding files, not
classifying them. Both fields still exist on the upload/edit form and are
still used elsewhere (e.g. sorting non-PAGCOR documents like NDA templates),
just not surfaced on this page. Uploading from inside a game's document list
pre-fills that game's Provider/Game Title/Game ID onto the new document, so
files naturally land back in the game you uploaded them from. See
`renderDocuments()` and the module-level `documentsFolderNav` near the top
of `public/js/app.js`.

## Case detail — batch document upload, auto-filed, auto-compared

Cases are created by hand (the plain "New" button/form, same as ever) —
an earlier version of this feature let AI read a batch of documents and
propose the whole Case for confirmation, but that added a second source of
error (a wrong AI guess on a Case field) for a step that's cheap to just
type once, so it's been dropped in favor of a plainer split: **you create
the Case, the system takes over from there once you start uploading its
documents.**

The **"Upload Documents"** button on a Case's own detail page is for the moment
that case's documents come in — select every file for it at once (RNG
report, Game Manual, approval notice, whatever's on hand):

1. AI reads each file **individually** and proposes just that file's own
   Title / Category / Report Type — unlike the old wizard, there's nothing
   ambiguous left to guess about *which game or provider* a file belongs
   to, since the Case you're already on answers that; AI's only job here is
   classifying each file on its own. Every file gets its own editable row
   (checked by default, individually skippable) so you can fix a wrong
   guess or drop a file before anything is saved. If AI can't read a
   particular file, that row just falls back to the filename as the title
   and a default category — upload still proceeds, you just may want to
   double-check that row's classification.
2. Confirming uploads every checked file as a Document Center record
   already tagged with this Case's Provider / Game Title / Game ID and
   `relatedCaseId` — so it shows up immediately in the right Document
   Center tab + game (see below) with no separate filing step — and, once
   this Case has 2+ documents with files, automatically runs the AI
   consistency check described next, so Compliant/Not appears right away
   instead of a second click. The Case detail page also lists every
   document already linked to it (title, uploader, date, one-click
   download), so what's on file is visible without a trip to Document
   Center.

See `showCaseDocumentUploadModal()` and the "Uploaded Documents" list in
`renderCaseDetail()`, `public/js/app.js`.

### AI Submission Validation (button label still "AI Parameter Consistency Check")

The other half of the same idea: from a case's own detail page (or
automatically after a batch upload there), Gemini reads every Document
Center file linked to that case (needs 2+, each with a file attached) and
runs a **pre-submission validation** covering three things legal actually
cares about before a PAGCOR submission goes out:

1. **Document Completeness** — does each of the 5 required submission
   document *types* exist at all: Game Parameters, Game Manual,
   RNG Certification, RTP Verification, Content Provider Certification.
   ("EG Form" was removed from this list 2026-08-25 at Tiffany's request —
   it's not treated as a required submission document.) Each is reported
   present or not, with a one-line reason.
2. **Parameter Validation** — does each of 5 tracked parameters (Game ID,
   Game Version, Minimum Bet, Maximum Bet, RTP) have a value stated
   *anywhere* among the documents. This is a presence check only.
3. **Document Consistency** — for those same 5 parameters, do the
   documents that state a value actually agree. Every document that
   mentions the parameter is listed individually (`values: [{source,
   value}]`) so it's clear exactly which document said what, then marked
   **match** / **mismatch** / **missing**.

The overall **🟢 Ready for Submission / 🔴 Not Ready for Submission**
banner is computed in `server/ai.js` from those three arrays — not trusted
as an AI-authored boolean — so it always follows the same fixed rule: every
required document type present, every tracked parameter has a value
somewhere, and no parameter disagrees across documents.

Same "report, don't judge" boundary as AI document summary above: none of
this ever says which value is "right" or whether the bundle is legally
compliant — only what's present/missing and where documents disagree. A
real mismatch or gap still needs a human to resolve it. Minimum Bet /
Maximum Bet / RTP are deliberately **not** persisted as real Case fields
(Tiffany's team doesn't track them there) — they only appear in this
validation result, read fresh from the documents each time. See
`REQUIRED_DOCUMENT_TYPES`, `CHECKED_PARAMETERS`, `SUBMISSION_VALIDATION_SCHEMA`,
and `checkDocumentConsistency()` in `server/ai.js`, `POST /api/cases/:id/check-consistency`
in `server/routes.js`, and `showConsistencyResultModal()` in `public/js/app.js`
(shared by the case detail page's button, its batch upload's auto-run, and
the Document Center folder button below) — the modal itself is titled "AI
Submission Validation"; only its content changed, the surrounding page
layout (Case detail, Document Center) is unchanged.

**Also runs straight from a Document Center game folder, with no Case
required.** Not every game folder has a Case behind it yet — documents
filed directly through Document Center's own "New" button never gain a
Related Case unless someone sets one by hand. Requiring a Case first would
mean the one folder Tiffany's actually looking at (with 2+ files sitting
right there) couldn't be compared until she went and created one. Instead,
opening a game's document list shows the same "AI Parameter Consistency Check" button
whenever that folder has 2+ files, running the identical validation against
exactly those documents (picked by ID, not by any Related Case link). See
`POST /api/documents/check-consistency` in `server/routes.js` (same
`ai.checkDocumentConsistency()` under the hood, just fed `documentIds`
straight from the folder instead of a Case's linked documents) and the
`#btnCheckFolderConsistency` handler in `renderDocuments()`,
`public/js/app.js`.

Shares the same `GEMINI_API_KEY` setup as AI smart-fill above.

### System-Wide Activity Log

The Audit Log page (nav item, and `GET /api/audit-log`) tracks two kinds of
entries in one shared `auditLog` table:

1. **Field-level diffs** — the original, narrower behavior: changes to the 6
   audited case/game fields (Game ID, Game Version, Minimum Bet, Maximum
   Bet, RTP, PAGCOR Stage) are logged old-value → new-value. See
   `logCaseAudit`/`logAudit` in `server/routes.js`.
2. **System-wide action log** (added 2026-08-25, at Tiffany's request —
   "the entire system's activity log must be recorded") — every create/update/delete across the
   system is now logged as well: Cases, Documents (including replace-file
   and case notes), Tasks, Knowledge Base (documents and FAQs), Calendar
   Events, Approvals (including decisions), Users, Roles, Departments, and
   Settings. See the `logAction()` helper in `server/routes.js`, called from
   each resource's `afterCreate`/`afterUpdate`/`afterDelete` crudRoutes
   hooks.

The frontend (`renderAuditLog()`, `public/js/app.js`) distinguishes the two
entry shapes by whether `field` is set, and search matches against both the
raw entity type/action and their display labels (`ENTITY_TYPE_LABELS`,
`ACTION_LABELS`).

**Admin-only.** Because this feed now spans every module — more sensitive
than any single module's own `view` permission — access is restricted to
the `Admin` role specifically (not just anyone with `settings:view`, since
Legal Manager also holds that). Enforced both server-side (`GET
/api/audit-log` checks `role.name === 'Admin'` directly, the same pattern
used elsewhere in `server/routes.js` for Admin-only carve-outs) and
client-side (`canView('auditLog')` in `public/js/app.js`, which hides the
nav item for non-Admins).

## PAGCOR game-submission features

A set of small, additive features for the specific workflow of helping
overseas game Providers (e.g. FC, JDB, VP) get a game approved by PAGCOR
(Philippine Amusement and Gaming Corporation) — organizing their math model /
RNG test report, and filing for a Letter of Approval (LOA). None of these are
a new module: they're all extensions of Case Management, the Document
Center, and the AI Assistant/AI smart-fill you already have.

1. **PAGCOR checklist + stage, right on the Case.** Give any Case a
   "Provider" (e.g. `FC`) and it automatically gets the standard checklist
   (Game Manual / Parameter / RTP Certification — matched to what's actually
   tracked in Tiffany's real submission tracking sheet) and a `pagcorStage`
   (Not Started → Preparing Documents → Submitted to PAGCOR → Under PAGCOR
   Review → LOA Approved / Rejected). A case can also carry `gameType`
   (Slots/Arcade-Type/Table/eBingo/Other), `gameId`, `gameVersion`, and
   `withJackpot` (Yes/No) — the other per-game attributes that tracking
   sheet records. Click the checklist button on a case row to tick items off
   as they're done — see `server/pagcor.js` for the shared list,
   `showPagcorChecklistModal()` in `public/js/app.js` for the modal.
2. **Document Center auto-tagging.** The "AI smart-fill" button on Upload
   Document now also detects `provider`, `gameTitle`, and `reportType` (Math
   Model Report / RNG Test Report / Game Rules & Paytable / Submission
   Letter / LOA / Other) straight from the uploaded file or pasted text — see
   the `documents` entry in `server/ai.js`'s `MODULE_SCHEMAS`.

   **Multi-game bundle files.** Some uploads (most commonly a combined
   front-end testing screenshot report) genuinely cover several different
   games in one file, each with its own mini result table — there's no
   single correct `provider`/`gameTitle`/`gameId` to fill in for those. When
   the AI recognizes this (via the schema's optional `detectedGames` array —
   only populated when 2+ distinct games are actually found, see
   `toGeminiResponseSchema()`'s new array/items support in `server/ai.js`),
   the Upload Document form shows a checklist of every detected game instead
   of guessing one; whichever games are checked at Upload time each become
   their own document record (same uploaded file content in every one, just
   different provider/gameTitle/gameId), so the same file shows up filed
   under every relevant Document Center game folder rather than only one.
   See the `detectedGames`-handling block in `showFormModal()`,
   `public/js/app.js`.
3. **LOA expiry/renewal tracking.** Set a case's `loaExpiryDate` once its LOA
   is approved, and it shows up in the Dashboard's "Upcoming Deadlines"
   widget (labeled "LOA Expiry") the same way case deadlines and contract
   expirations already do — no new notification infrastructure, just one
   more date field feeding the existing widget (see `/api/dashboard/summary`
   in `server/routes.js`).
4. **AI Assistant drafts the PAGCOR cover letter.** Ask it directly, e.g.
   *"Draft a PAGCOR submission letter for Provider FC, game Fortune Dragon"* —
   it writes the actual letter text in its reply. This is pure text
   generation (nothing is saved), so it does **not** go through the
   propose-then-confirm flow the create_* actions use — see the system
   prompt in `server/assistant.js`'s `runTurn()`.
5. **Filter Case Management by Provider / PAGCOR Stage.** Once at least one
   case has a Provider set, two filter dropdowns appear above the Case
   Management table so you can quickly see, e.g., "everything for JDB that's
   still Under PAGCOR Review." The Case Management table is also paginated,
   30 rows per page, so a large imported list doesn't turn into one long
   scroll — see `PAGE_SIZE` / `renderPage()` in `renderCases()` in
   `public/js/app.js`.
6. **Dashboard: PAGCOR Submission Pipeline overview.** A row of horizontal
   bars on the Dashboard, one per PAGCOR Stage, sized relative to each
   other, so you can see at a glance how submissions are distributed across
   stages (e.g. "Under PAGCOR Review: 308") without opening Case Management
   at all. Clicking a bar jumps to Case Management with that Stage
   pre-filtered. Only cases with a Provider set (i.e. PAGCOR
   game-submission cases) are counted — see the `pagcorBoard` field added to
   `/api/dashboard/summary` in `server/routes.js`, and `pagcorBoardHtml()`
   in `public/js/app.js`.
7. **Search Case Management by Game ID, Title, or Game Title.** A search box
   next to the Provider/Stage filters narrows the list to whatever text you
   type (substring, case-insensitive) — combines with the other filters, so
   you can e.g. search within a Provider's cases only. Once you have
   hundreds of imported games, this is usually faster than paging through.
   Matches Game ID rather than the internal Case # (Tiffany's own workflow
   is to look games up by their Game ID) — Case # is still visible as its
   own sortable column, just not part of this search box.
8. **Export the case list to CSV.** The "Export CSV" button downloads
   whatever the current Provider/Stage/search filters and sort order show
   (not just the current page) as a `.csv` file — every field the Import
   feature reads, including the PAGCOR checklist as three Yes/No columns —
   for reporting or archiving in Excel. This is a real CSV rather than a
   `.xlsx` file (opens fine in Excel either way) since it needs no library
   or build step — see `exportCasesCsv()` in `public/js/app.js`.
9. **Bulk-update PAGCOR Stage for multiple cases at once.** Checkboxes on
   each case row (plus a "select all on this page" checkbox in the header)
   let you select a batch of cases and set their PAGCOR Stage in one action
   via the toolbar that appears once something's selected, instead of
   opening each case individually. Only touches `pagcorStage` — same as
   editing one case's Stage field by hand, it doesn't recompute
   status/checklist. Requires the same "cases: edit" permission as the
   per-case Edit button — see `POST /api/cases/bulk-update-stage` in
   `server/routes.js`.
10. **Sortable Case Management columns.** Click any column header (Case #,
    Title, Type, Provider, PAGCOR Stage, Owner, Priority, Status, Submit Date)
    to sort by it; click again to reverse. PAGCOR Stage sorts by pipeline
    order (Not Started → ... → Rejected), not alphabetically, and Priority
    sorts High → Medium → Low — see `sortValue()`/`sortComparator()` in
    `renderCases()` in `public/js/app.js`.
11. **Import Excel/CSV de-duplicates.** Re-running the same import (or
    importing a workbook where the same game appears in both a Provider's
    own tab and the master "APPROVED" tab — a real shape in Tiffany's actual
    workbook) no longer creates duplicate cases. Matching is primarily by
    (Provider, Game Title), case-insensitively: a game already in both
    an included Provider sheet and the APPROVED sheet in the **same**
    commit collapses to one case using the APPROVED (final) version; a game
    that already exists as a Case from an **earlier** import run is skipped
    entirely. The import result now reports a `skipped` count alongside
    `created` — see `POST /api/cases/import/commit` in `server/routes.js`.

    On top of that exact-title match, a second pass groups rows by
    (Provider, Game ID) and also collapses them when their titles are close
    enough (after stripping punctuation/case) to be confident it's the same
    game — this is what catches real typos found in Tiffany's own workbook,
    like "CATLA_S MONEY MACHINE" vs "CATLA'S MONEY MACHINE" (an
    underscore-for-apostrophe typo) or "Super Niubi Fortune" vs
    "SuperNiubiFortuneX-huge" (a shorter/longer name variant), both sharing
    one Game ID — which a plain title match would otherwise have let through
    as two separate cases. This check runs both within one commit AND
    against cases already in the database from an earlier commit, so it
    doesn't matter whether all sheets are imported together or in separate
    batches. A Game ID shared by two titles that DON'T look related (found
    in the same workbook: FC's "OPEN VAULT" row has a typo'd Game ID that
    happens to collide with the unrelated "HOT POT PARTY" row) is
    deliberately left as two separate cases rather than merged, since that's
    most likely two real submissions colliding on a mistyped ID, not one
    game recorded twice — these get reported back in a `gameIdConflicts`
    array (shown in a toast + logged to the browser console) instead, so a
    human can check the source sheet. See `titlesLikelySameGame()` and the
    "Stage 2.5" comment in `POST /api/cases/import/commit`, `server/routes.js`.
12. **Game ID column in Case Management.** A "Game ID" column sits right
    after Case # in the table, showing the game's own ID from the source
    spreadsheet (e.g. `8021`, `100001`) — separate from and without changing
    the internal `CASE-####` numbering everything else in the system uses.
    Shows "—" for cases with no Game ID (e.g. non-PAGCOR cases). Sortable
    like any other column — see the `gameId` case in `sortValue()` and the
    new `<td>`/`<th>` in `renderCases()` in `public/js/app.js`.
13. **Case # column shows just the number, click a row for full details.**
    To keep the Case # column narrow, the table now shows only the numeric
    suffix (e.g. `0006` instead of `CASE-0006`) — hover it to see the full
    number in a tooltip, and it's unchanged everywhere else (CSV export,
    search, the underlying record, etc.). Clicking anywhere on a row (except
    its checkbox or the action buttons) navigates to a full case/game detail
    page at `#/cases/<id>` — Game Title, Type, ID, Version, Jackpot,
    Provider, PAGCOR Stage, and the (checkable) PAGCOR Checklist, plus Edit
    and Delete buttons. This was originally a modal, but with every field
    shown at once it felt cramped in a dialog, so it's a real page instead —
    see `renderCaseDetail()`, the `cases`-with-id branch in `route()`, and
    the `tr[data-id]` click handler in `attachRowHandlers()`, all in
    `public/js/app.js`.
14. **30-day PAGCOR follow-up reminder.** A game that's been sitting in
    "Submitted to PAGCOR" or "Under PAGCOR Review" for 30+ days with no
    Stage change is easy to lose track of once it's buried in a spreadsheet
    — this surfaces it right on the Dashboard instead, as both a stat card
    ("PAGCOR Follow-ups Due") and a list of the specific games affected,
    each linking straight to that case. The clock resets whenever the
    Stage actually changes (via the stepper, the Edit form, or a batch
    update) — see `pagcorStageChangedAt` in `server/routes.js`'s cases
    `onCreate`/`onUpdate` and `/api/dashboard/summary`'s `followUps`, and
    `followUpsWidgetHtml()` in `public/js/app.js`.
15. **AI Submission Validation (optional) + batch document upload.**
    On a PAGCOR case's detail page, "AI Parameter Consistency Check" opens the "AI
    Submission Validation" modal: Document Completeness (are the 5 required
    submission document types present), Parameter Validation (does Game ID
    / Game Version / Minimum Bet / Maximum Bet / RTP have a value anywhere),
    and Document Consistency (do the documents that state a value agree,
    shown per source document) across that case's related documents, with
    an overall Ready/Not Ready for Submission banner; the "Upload Documents" button
    on that same page runs this automatically right after a batch upload
    once the case has 2+ documents on file. See the dedicated "Case detail
    — batch document upload, auto-filed, auto-compared" section and the "AI
    Submission Validation" section above for the full writeup.
16. **LOA-approval notification draft.** Once a case's PAGCOR Stage is "LOA
    Approved," an "Approval Notice Draft" button on its detail page assembles a
    ready-to-copy message (game title, Game ID, Provider, approval date,
    LOA expiry) from that case's own fields, with a one-click "Copy Text"
    button. This does **not** send anything anywhere — it only prepares
    text for you to paste into Telegram (or wherever) and send yourself,
    same as every other "draft, don't send" feature in this app. See
    `loaNotificationDraftText()` and the `#btnLoaNotice` handler in
    `renderCaseDetail()`, `public/js/app.js`.
17. **Document Center Provider tabs + game list.** Document Center is
    organized as Provider tabs filtering a game list (Game Title/Game
    ID/latest upload date), drilling into each game's own document list —
    instead of one flat table. See the dedicated "Document Center — Provider
    tabs + game list" section above for the full writeup.

Demo data for the first six is included in `server/seed.js` (two PAGCOR-flavored
cases — one mid-submission, one with an approaching LOA expiry — plus two
tagged documents) so a fresh local/mock database shows them immediately.
Your **existing, already-seeded production database won't get this demo
data automatically** (seeding only runs once, on an empty database) — the
features themselves work regardless; you'd just start from your own real
cases instead of the two demo ones.

### Import Excel/CSV -> bulk-create Cases

A 6th, larger feature: an **"Import Excel/CSV"** button next to "New" on the
Case Management page, for bringing in an existing spreadsheet of game
submissions instead of typing each one in by hand. Built and tested directly
against Tiffany's real tracking workbook (one sheet per Provider of pending
submissions, plus an "APPROVED" sheet with its own extra columns per game) —
343 rows across 6 sheets, imported end-to-end with 0 errors in testing.

How it works:

1. Pick a `.xlsx` or `.csv` file. Every sheet in the workbook is analyzed
   separately (a plain `.csv` is treated as one sheet).
2. For each sheet, common header names are auto-recognized (Game Name/Game
   Title/Title, Provider, Game Type, Game ID, Game Version, Status, With
   Jackpot, Game Manual, Parameter, RTP Certification, Remarks, Date
   Received — matched case-insensitively, so header wording doesn't need to
   be exact). A sheet without its own "Provider" column gets an editable
   suggested Provider name (from the sheet/tab name); a sheet without a
   "Status" column gets an editable default PAGCOR Stage applied to every
   row in it. A sheet **with** a Status column (like "APPROVED") maps
   `STATUS = APPROVED` rows straight to `pagcorStage: 'LOA Approved'` and
   uses that row's own Game Manual/Parameter/RTP Certification values for
   the checklist, instead of a blanket default.
3. Review the per-sheet row counts and sample games, adjust Provider/Stage
   if needed, and click "Confirm Import" — only then does anything get written.

No new npm dependency was added for this — `.xlsx` files are just ZIP
archives of XML, and Node's built-in `zlib` already knows how to decompress
ZIP's "deflate" entries, so `server/xlsx-lite.js` is a small, dependency-free
reader written for this project (see that file's header comment for why:
this sandbox had no registry access to install a package like `xlsx` when
this was built). The actual column-mapping/normalization logic lives in
`server/import.js`; the two endpoints are `POST /api/cases/import/preview`
and `POST /api/cases/import/commit` in `server/routes.js`, both gated behind
the same "cases: create" permission the normal "New Case" button uses.

## Calendar

A month-grid Calendar page (sidebar, styled after the iOS/Google Calendar
apps) that plots four kinds of events together, each with its own color:

- **Submit Date** — every open Case's `deadline` field (red).
  Read-only here — Submit Dates are only ever set in Case Management.
- **Task Management due dates** — including the auto-generated "Follow-up"
  follow-up task `syncDeadlineFollowUpTask()` in `server/routes.js` keeps in
  sync 30 days after each Case's Submit Date (amber), and everything else
  in Task Management (blue). See that function's comment for exactly how
  the follow-up task is created/resynced/cleaned up as a Case's Submit Date
  changes. Also read-only here — Tasks are only ever created in Task
  Management.
- **Calendar events** (purple) — freeform items that are neither a
  Case nor a Task, e.g. a meeting or a personal reminder. These ARE created
  directly from the Calendar page's own "+ New Event" button, backed by their
  own `/api/calendar-events` collection (`server/routes.js`) rather than
  `cases`/`tasks`. Visible to everyone, but only the creator (or an Admin)
  gets the inline edit/delete icons on one.
- **Philippine public holidays** (green; the one special *working* day,
  EDSA anniversary, is shown in neutral gray instead, since it's not a day
  off) — hardcoded in `public/js/app.js`'s `PH_HOLIDAYS_2026`, sourced from
  Malacañang's official 2026 holiday proclamation plus the separate Eid'l
  Fitr / Eid'l Adha proclamations (those follow the Islamic calendar and
  are announced closer to the date each year). This list is year-specific —
  add a matching `PH_HOLIDAYS_<year>` array (and register it in
  `PH_HOLIDAYS_BY_YEAR`) for any other year the page gets browsed into.

Above the big grid: a "Next 7 Days" panel (always the next 7 days,
regardless of what's selected in the grid) and a single selected day's
agenda (defaults to today; clicking a grid cell switches it to that day).

## Architecture

```
legal-genie/
├── api/
│   └── index.js           Vercel entry point (current path) — one Vercel
│                           Function, handles every /api/* request. See
│                           "Why api/index.js and not server.js" below.
├── vercel.json            Rewrites every /api/(.*) request to api/index.js
├── server.js              HTTP server used for LOCAL DEV and the Render
│                           fallback path only (not used on Vercel — see
│                           below). Same request routing as api/index.js,
│                           just wrapped in .listen() instead.
├── server/
│   ├── index.js            Thin compatibility alias -> ../server.js
│   ├── dotenv-lite.js       Loads a local .env file, if present — see "AI smart-fill" above
│   ├── router.js           Minimal router + JSON body parsing (no Express)
│   ├── store.js             Supabase (Postgres) datastore — active path
│   ├── storage.js           Supabase Storage file handling — active path
│   ├── supabase-schema.sql  Run once in Supabase's SQL editor before first deploy
│   ├── store.sqlite-backup.js  Preserved SQLite datastore (Render fallback path — see below)
│   ├── auth.js              Password hashing (PBKDF2), sessions, lockout, permission checks
│   ├── ai.js                Optional AI smart-fill (Anthropic Claude) — see "AI smart-fill" above
│   ├── assistant.js         Optional AI Assistant chat — see "AI Assistant" above
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
├── .env.example          Template for local env vars (copy to .env — see "AI smart-fill" above)
├── package.json          Declares @supabase/supabase-js (Vercel's build runs npm install)
├── render.yaml           Render Blueprint — Render fallback path only (see below)
└── .node-version         Pins the Node version for Render specifically
```

### Why `api/index.js` and not `server.js` on Vercel

Vercel has a newer "zero-config" feature that's supposed to auto-detect a
root-level `server.js` calling `.listen()` and capture it as a Function
with no configuration at all. In real testing on this project, that
feature silently failed instead: Vercel deployed the whole project as
static-only (a ~30ms build, no `npm install`, zero Functions created), so
every `/api/...` request 404'd with no error or warning anywhere in the
build log. Rather than depend on that newer, under-documented behavior,
this project uses Vercel's older, extremely well-established convention
instead: any file under `api/` becomes its own Function, one-to-one. Here
there's just one, `api/index.js`, and `vercel.json` rewrites every
`/api/(.*)` request to it so it can do its own path matching internally
(`server/router.js`) exactly like `server.js` already did. `server.js`
itself is kept for local dev (`npm install && node server.js`) and the
Render fallback path, where its own `.listen()`-based server works fine —
it's simply not what actually runs in production on Vercel anymore.

The backend logic is a single Node.js HTTP handler (`server/router.js` +
`server/routes.js`, built on the `http` module — no Express or other web
framework) shared by both entry points above. The frontend is a
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
`contractVersions`, `documents`, `tasks`, `approvals`,
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
6. **Audit trail** — ✅ done. A dedicated `auditLog` table records every
   create/update/delete across the system (cases, documents, tasks,
   knowledge base, calendar, approvals, users, roles, departments,
   settings), plus the original per-field diffs on the 6 audited case/game
   fields. See the "System-Wide Activity Log" section below.
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
documents, etc.) — they are infrastructure hardening steps around the
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
