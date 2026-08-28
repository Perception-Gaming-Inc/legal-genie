'use strict';
/**
 * Optional "AI smart-fill" helper — lets a user paste free text (an email,
 * a case summary, a contract excerpt...) or upload a
 * file (PDF or image), and have Gemini extract the relevant fields for a
 * given module (cases / contracts / documents) so the form
 * shows up pre-filled instead of needing to be typed in by hand. The user
 * always sees the pre-filled form before saving, so this only ever removes
 * typing — it never submits anything on its own.
 *
 * Uses Google's Gemini API rather than a paid provider specifically because
 * Gemini has a genuinely free tier (no credit card required, just rate
 * limits) — see README's "AI smart-fill" section for the tradeoffs.
 *
 * DELIBERATELY OPTIONAL: unlike server/store.js (which throws at startup if
 * Supabase isn't configured, because the whole app is unusable without a
 * database), this module must NOT throw at require-time if there's no
 * GEMINI_API_KEY yet. The rest of the app has to keep working normally
 * even before anyone sets up AI — only the one "AI Smart-Fill" button should
 * fail (with a clear message) until a key is added. That's why the env var
 * is read lazily inside extractFields(), not at the top of the file.
 *
 * Uses Node's built-in global fetch (available since Node 18) — no new npm
 * dependency, consistent with the rest of this project.
 *
 * Setup: get a free key at https://aistudio.google.com/apikey (no credit
 * card needed), then set GEMINI_API_KEY as an environment variable
 * (locally, or in Vercel's Project Settings -> Environment Variables — see
 * the README's AI section). Everything else works with zero setup.
 */

// Google rolls its model lineup over fairly often, and — as confirmed in
// real testing on this project — sometimes restricts an older model from
// *new* API keys/users well before that model's official deprecation date,
// which is exactly what happened with the previous default here
// (gemini-2.5-flash started returning 404 "no longer available to new
// users" for a freshly created key). gemini-3.6-flash is the current
// confirmed-working default as of when this was last updated. If this ever
// happens again, no code change is needed — just set GEMINI_MODEL to
// whatever's current from https://ai.google.dev/gemini-api/docs/models.
// Check https://aistudio.google.com/rate-limit (after signing in) for your
// account's current free-tier limits and which models they apply to.
const DEFAULT_MODEL = 'gemini-3.6-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Same dependency-free .xlsx reader server/import.js already uses for the
// Case Management Excel-import feature — reused here (see filePart() below)
// so an uploaded Excel test-report can go through AI smart-fill too,
// instead of needing to be manually re-typed or converted to PDF first.
const { xlsxToText } = require('./xlsx-lite');

// Confirmed directly by Tiffany: some Providers show only a short in-game
// watermark/badge on their own screens rather than a spelled-out name (e.g.
// "OP" for Omniplay), and the AI otherwise has no way to know that mapping.
// Add to this as more of these turn up in real testing — used below to
// steer the `provider` field (both the single-game one and each entry in
// `detectedGames`) toward the full name actually used elsewhere in this
// system, instead of leaving the AI to either guess or copy the raw
// watermark text verbatim (which would silently create a duplicate
// Document Center provider tab like "OP" alongside the real "Omniplay" one
// — the exact kind of fragmentation the normKey()/pickRepresentative()
// grouping in public/js/app.js's renderDocuments() otherwise guards
// against, just for a full-name-vs-abbreviation mismatch instead of a
// casing/whitespace one).
const PROVIDER_WATERMARK_ALIASES = { OP: 'Omniplay' };
const PROVIDER_WATERMARK_ALIASES_TEXT = Object.entries(PROVIDER_WATERMARK_ALIASES)
  .map(([short, full]) => `"${short}" = ${full}`).join(', ');

// ---------------------------------------------------------------------------
// Per-module extraction schemas
// ---------------------------------------------------------------------------
// Field names here must exactly match the form field `name`s in
// public/js/app.js's per-module `fields()` — the extracted object is used
// directly to pre-fill those inputs. Fields that reference *other records*
// by internal ID (owner/assignee/relatedCaseId/...) are intentionally left
// out: the AI has no way to know your team's user IDs or your existing
// case/contract IDs, so those stay for the person to pick from the dropdown.
const MODULE_SCHEMAS = {
  cases: {
    label: 'legal case / matter',
    properties: {
      title: { type: 'string', description: 'A short, concrete case title (not a full sentence).' },
      type: { type: 'string', enum: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'] },
      priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
      status: { type: 'string', enum: ['Open', 'In Progress', 'Closed'] },
      deadline: { type: 'string', description: 'ISO date YYYY-MM-DD if a specific deadline/due date is mentioned. Omit this field entirely if none is mentioned — do not guess.' },
      description: { type: 'string', description: 'A clear 2-4 sentence summary of the matter, written for a legal case record.' },
      provider: { type: 'string', description: 'The overseas game Provider company this relates to (e.g. FC, JDB, VP), only if this is a PAGCOR game-submission case. Omit entirely if not applicable/mentioned.' },
      gameTitle: { type: 'string', description: 'The specific game title being submitted to PAGCOR, if mentioned. Omit if not mentioned.' },
      gameId: { type: 'string', description: 'The Game ID / Table ID for this game, if stated anywhere in the source material. Omit if not stated.' },
      gameType: { type: 'string', enum: ['Slots', 'Arcade-Type', 'Table', 'eBingo', 'Other'], description: 'The game\'s type/category, only if this is a PAGCOR game-submission case and it is identifiable. Omit entirely if not applicable/identifiable.' },
      gameVersion: { type: 'string', description: 'The game\'s version/manual version number, if stated. Omit if not stated.' },
      withJackpot: { type: 'string', enum: ['Yes', 'No'], description: 'Whether the game has a jackpot feature, only if this is explicitly stated. Omit entirely if not mentioned.' },
    },
    required: ['title'],
  },
  documents: {
    label: 'document being filed into the document center',
    properties: {
      title: { type: 'string', description: 'A short, descriptive title for this document.' },
      category: { type: 'string', enum: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'] },
      provider: { type: 'string', description: `The overseas game Provider company — the actual manufacturer/developer of the game (e.g. FC, JDB, VP, Omniplay) — that this document is from/about, if identifiable from the content. IMPORTANT: this is NOT necessarily the company whose name/letterhead is most prominent in the document. A Math Model Report, RNG Test Report, or RTP verification report is typically issued BY an independent testing/certification lab ABOUT a game made by a different company — the lab\'s name (e.g. an RNG/RTP testing house) is who tested and signed the report, not the Provider. Only set \`provider\` to the actual game manufacturer named in the document (often in a game title, "on behalf of", or "manufacturer" line); omit entirely rather than guess if only a testing lab\'s name is identifiable. Separately, a short brand watermark/logo/badge shown directly on a game\'s OWN screen (e.g. a small mark in a corner of the slot machine UI itself, as opposed to a separate testing lab\'s letterhead) IS legitimate evidence of the Provider — fill it in even though it is short or shown as a logo rather than spelled out; do not omit it just for being brief. Known watermark abbreviations used by this legal team: ${PROVIDER_WATERMARK_ALIASES_TEXT} — always write out the FULL Provider name (e.g. "Omniplay", not "OP") when you recognize one of these, so it matches how this company is already tracked elsewhere in the system.` },
      gameTitle: { type: 'string', description: 'The specific game title this document relates to, if identifiable. Omit if not mentioned.' },
      gameId: { type: 'string', description: 'The Game ID / Table ID for the game this document relates to, if stated anywhere in the source material. Omit if not stated.' },
      reportType: { type: 'string', enum: ['Math Model Report', 'RNG Test Report', 'Game Rules / Paytable', 'PAGCOR Submission Letter', 'Letter of Approval (LOA)', 'Other'], description: 'What kind of PAGCOR-related report/document this is, if identifiable from the content or file name. Omit entirely if it does not look like one of these.' },
      // Learned from real-world testing: a single "front-end testing
      // screenshots" report very often bundles several DIFFERENT games'
      // screenshots into one file, each with its own mini result table
      // (Balance/Grand/Major/Bet/Winnings). The single provider/gameTitle/
      // gameId fields above have no correct single answer in that case —
      // this optional array lets the AI say "actually, here are the N
      // distinct games in this one file" instead of guessing just one (or
      // leaving them blank). public/js/app.js's showFormModal only acts on
      // this when it has 2+ entries: it shows a checklist so the user picks
      // which game folders this same file should be filed into (creating
      // one document record per checked game, same file content in each —
      // same "let the human choose, AI only proposes" rule as everywhere
      // else in this app).
      detectedGames: {
        type: 'array',
        description: 'ONLY populate this when the document/file actually covers MORE THAN ONE distinct game at once — e.g. a combined front-end testing screenshot report, or any other bundle covering multiple titles in one file. In that case, list every distinct game mentioned, each as its own entry with its own provider/gameTitle/gameId (same rule as the `provider` field above: the actual manufacturer, never a testing/certification lab). Omit this field entirely (or leave it empty/absent) when the document is about a single game, or about no specific game at all — never force a single-entry list just to fill this field.',
        items: {
          properties: {
            provider: { type: 'string', description: `The actual game manufacturer/developer for this specific game (e.g. FC, JDB, VP, Omniplay), if identifiable. A short brand watermark/logo/badge shown directly on the game's OWN screen — distinct from a separate testing/certification lab's letterhead — IS legitimate evidence of the Provider; fill it in even though it is short or shown as a logo rather than spelled out, especially if the SAME mark appears consistently across every game in this bundle. Known watermark abbreviations used by this legal team: ${PROVIDER_WATERMARK_ALIASES_TEXT} — always write out the FULL Provider name when you recognize one of these. Only omit when there is genuinely no such indication anywhere for this game — never invent a name that does not actually appear.` },
            gameTitle: { type: 'string', description: 'This specific game\'s title, exactly as it appears in the document.' },
            gameId: { type: 'string', description: 'This specific game\'s Game ID / Table ID, if stated anywhere for it. Omit if not stated.' },
          },
          required: ['gameTitle'],
        },
      },
    },
    required: ['title'],
    // Learned from real-world testing: burying the multi-game instruction
    // only in `detectedGames`'s own field description wasn't reliable
    // enough on an actual multi-page, screenshot-heavy PDF (10 games' worth
    // of slot-machine screenshots) — the model would sometimes miss it
    // entirely (leaving every game field blank) or latch onto one wrong
    // guess instead of recognizing the bundle. Putting the same instruction
    // up front in the main prompt too (see extractFields() below, which
    // appends this after its generic instructions) gives it much more
    // weight relative to the sheer amount of visual content in a file like
    // that, instead of being one line of schema metadata among many.
    extraPromptInstructions:
      'This document might actually cover MORE THAN ONE distinct game at once (the most common example: a ' +
      'front-end testing screenshot report that bundles several different games\' screenshots and mini result ' +
      'tables one after another). First judge whether the document as a whole looks like this — if it does, you ' +
      'MUST list EVERY distinct game you find in the document in the detectedGames field; do not just pick one ' +
      'to fill into provider/gameTitle/gameId, and do not give up and leave it blank just because there are many ' +
      'games. If this document genuinely only concerns a single game (or no specific game at all), leave ' +
      'detectedGames empty and just fill provider/gameTitle/gameId normally. Also note: a Provider does not ' +
      'always appear as a full company name — the game screen itself often has a short brand watermark/logo in a ' +
      'corner, and that watermark alone IS legitimate evidence of the Provider; do not skip filling it in just ' +
      `because it's short or just a small logo. Known watermark abbreviations: ${PROVIDER_WATERMARK_ALIASES_TEXT} — ` +
      'when you recognize one of these, always write out the full company name rather than the abbreviation ' +
      'itself, so it matches how this Provider is tracked elsewhere in the system; if the same watermark appears ' +
      'consistently across every game screen in this document, that usually means the whole batch is the same Provider.',
  },
};

// ---------------------------------------------------------------------------
// PAGCOR "Notice of Approval" extraction
// ---------------------------------------------------------------------------
// A separate, narrower entry point from extractFields() above: this reads an
// official PAGCOR approval-notice letter (often a scanned image with NO text
// layer at all, so pdf-parse in pagcor-check.js can't read it) and pulls out
// which game(s) it approves. This exists specifically because PAGCOR's own
// public "List of EGLD-approved Electronic Games" PDFs lag behind these
// individual notices by weeks — Tiffany gets the real approval letter from
// PAGCOR directly, often well before the public list catches up, so relying
// only on the public list means real approvals sit unrecognized in the
// meantime. Letting her upload the notice itself and have AI read it closes
// that gap instead of waiting on PAGCOR's own batch publishing schedule.
const APPROVAL_NOTICE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    games: {
      type: 'ARRAY',
      description: 'Every individual game this notice approves. A single notice can cover more than one game.',
      items: {
        type: 'OBJECT',
        properties: {
          gameTitle: { type: 'STRING', description: 'The game\'s name exactly as written in the notice.' },
          gameId: { type: 'STRING', description: 'The Game ID / Table ID for this game, if the notice states one. Omit if not stated.' },
          provider: { type: 'STRING', description: 'The game provider/brand this game belongs to (e.g. Omniplay, FC, JDB, Yellow Bat, Vertex Play), if identifiable. Omit if not stated.' },
        },
        required: ['gameTitle'],
      },
    },
    approvalDate: { type: 'STRING', description: 'ISO date YYYY-MM-DD the notice is dated or the approval takes effect, if stated. Omit if not stated.' },
    noticeReference: { type: 'STRING', description: 'The notice/document reference number, e.g. "SYS-26-07-290", if stated. Omit if not stated.' },
  },
  required: ['games'],
};

// ---------------------------------------------------------------------------
// Gemini Context Caching (added 2026-08-28, at Tiffany's request) — every
// Telegram question previously resent the ENTIRE Knowledge Base (all
// company-approved FAQ entries + all document summaries, now several
// full page-by-page manual summaries deep) to Gemini from scratch, even for
// back-to-back questions seconds apart. That's a lot of repeated input
// tokens for content that barely changes minute to minute. Gemini's
// CachedContent API lets that large, slow-changing block (KB FAQs/document
// summaries + the assistant's standing instructions) be uploaded ONCE and
// referenced by name on every later request instead of resent — the parts
// that genuinely change per question (this chat's cases, calendar events,
// tasks, today's date, the question itself) are still sent fresh every time.
//
// Deliberately fails soft: if cache creation fails for ANY reason (API
// key/tier doesn't support explicit caching, the KB is currently too small
// to meet Gemini's minimum cacheable-token floor, a transient network/API
// error, etc.) this silently falls back to sending everything inline on
// every request, exactly as it worked before this existed. The bot must
// keep answering questions correctly even when the optimization itself
// isn't available — this is a cost/latency improvement, never a
// requirement.
const crypto = require('crypto');
const GEMINI_CACHE_TTL_SECONDS = Number(process.env.GEMINI_CACHE_TTL_SECONDS) || 1800; // 30 min

// In-memory only — resets on server restart / cold start, which is fine
// since a cold start is exactly when re-deriving it is cheap and correct
// anyway. Persisting the Google-side cache name across restarts (e.g. in
// server/store.js) isn't worth the complexity for what's a cost/latency
// optimization, not a correctness requirement.
let kbCache = null; // { name, hash, model, expiresAtMs }

function hashStableText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// The part of the prompt that's identical for every question at a given
// moment — the assistant's standing instructions. Deliberately excludes
// anything isAdmin/Provider/question/case/calendar/task-specific (that
// still goes in the live per-request text below) so this same cache serves
// EVERY chat, admin or Provider-scoped alike, not just one.
const STABLE_SYSTEM_INSTRUCTION =
  'You are a helpful assistant embedded in a Telegram group chat for a legal/regulatory team tracking PAGCOR ' +
  'game submissions. Each message will tell you whether this is an internal/admin chat (all Providers\' cases ' +
  'visible — name which Provider a case belongs to when it\'s not obvious) or a single Provider\'s own chat (only ' +
  'discuss THAT Provider\'s own cases, never another Provider\'s) — follow that scope strictly. Company-approved ' +
  'Knowledge Base content (FAQ entries and reference-document summaries, given below) is general PAGCOR/' +
  'regulatory material, not tied to any one case. Each message will also include that chat\'s current cases, the ' +
  'team\'s shared Calendar events (visible to everyone, not Provider-specific), a list of TEAM Task Management ' +
  'items (Personal tasks are deliberately never shown to you), and today\'s date — use today\'s date to resolve ' +
  'relative dates like "tomorrow" or "this week" in questions about upcoming events or task due dates. First ' +
  'decide whether the message is a genuine, on-topic question — about case status/stage/required documents/' +
  'dates/rejection reasons, a general PAGCOR/regulatory question, a question about upcoming/scheduled Calendar ' +
  'events, or a question about outstanding/team Task Management items. If it is, set shouldRespond to true, EVEN ' +
  'IF the case data, Knowledge Base content, Calendar events, and Task items given don\'t actually cover it — in ' +
  'that situation, don\'t guess: reply with a short, honest "I don\'t have information on that — you may want to ' +
  'ask Crystal directly" instead (in the same language as the question), rather than staying silent, since a real ' +
  'on-topic question deserves some reply even when the answer is "I don\'t know." Only set shouldRespond to false ' +
  '(and leave answer empty) when the message ISN\'T really a question for this bot at all — ordinary conversation ' +
  'between people, a greeting, or something entirely unrelated to cases/PAGCOR (e.g. the weather, the stock ' +
  'market) — so the bot doesn\'t reply to every stray message in a busy group. Never guess or invent a stage, ' +
  'date, document status, calendar event, or task that isn\'t present in the case data, Knowledge Base content, ' +
  'Calendar events, or Task items given. Keep answers short and friendly.';

async function deleteGeminiCache(name) {
  const apiKey = process.env.GEMINI_API_KEY;
  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/${name}`, {
      method: 'DELETE',
      headers: { 'x-goog-api-key': apiKey },
    });
  } catch (err) { /* best-effort cleanup only — the TTL expires it either way */ }
}

// Returns the cached content's resource name (e.g. "cachedContents/abc123")
// on success, or null if caching isn't usable right now for any reason.
// Callers MUST treat null as "fall back to sending everything inline" —
// this never throws.
async function getOrRefreshKbCache({ kbFaqLines, kbDocLines, model }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const stableText =
    `Company-approved Knowledge Base FAQ entries:\n${kbFaqLines.length ? kbFaqLines.join('\n') : '(none on file yet)'}\n\n` +
    `Company-approved Knowledge Base reference document summaries:\n${kbDocLines.length ? kbDocLines.join('\n') : '(none on file yet)'}`;
  // Re-hash on every call (cheap) so a KB edit — a new FAQ, a rewritten
  // document summary, a newly-Active document — is picked up on the very
  // next question instead of staying stale for up to GEMINI_CACHE_TTL_SECONDS.
  const hash = hashStableText(STABLE_SYSTEM_INSTRUCTION + ' ' + stableText + ' ' + model);

  const now = Date.now();
  if (kbCache && kbCache.hash === hash && kbCache.expiresAtMs > now + 30000) {
    return kbCache.name;
  }

  const staleCache = kbCache;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/cachedContents', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        model: `models/${model}`,
        systemInstruction: { parts: [{ text: STABLE_SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts: [{ text: stableText }] }],
        ttl: `${GEMINI_CACHE_TTL_SECONDS}s`,
      }),
    });
    if (!response.ok) {
      // Most likely cause: this KB is currently too small to meet Gemini's
      // minimum cacheable-token floor, or this API key's tier doesn't
      // support explicit caching. Either way, just don't cache this time —
      // answerGroupQuestion() falls back to the original inline behavior.
      kbCache = null;
      return null;
    }
    const data = await response.json();
    if (!data?.name) {
      kbCache = null;
      return null;
    }
    kbCache = { name: data.name, hash, model, expiresAtMs: now + GEMINI_CACHE_TTL_SECONDS * 1000 };
    // Best-effort: drop the now-superseded cache at Google so unused ones
    // don't linger — failures here are harmless, TTL cleans them up anyway.
    if (staleCache && staleCache.name !== kbCache.name) deleteGeminiCache(staleCache.name);
    return kbCache.name;
  } catch (err) {
    kbCache = null;
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pulls the "Please retry in Xs" hint out of Gemini's own 429 message body so
// the retry wait roughly matches what Google itself is telling us to wait,
// instead of guessing a fixed backoff. Falls back to a short fixed delay when
// no hint is present (or it's absurdly long — never wait more than 10s per
// attempt, this is a synchronous user-facing request, not a batch job).
function retryDelayMs(detail, attempt) {
  const match = String(detail || '').match(/retry in ([\d.]+)s/i);
  const hinted = match ? Math.ceil(parseFloat(match[1]) * 1000) : null;
  if (hinted && Number.isFinite(hinted)) return Math.min(hinted, 10000);
  return Math.min(1000 * 2 ** attempt, 8000);
}

// 2026-08-24 (at Tiffany's request, after the free-tier 20-req/day quota got
// hit mid-session and every AI feature failed hard with a raw HTTP 429):
// retry a rate-limited call a couple of times with a short backoff before
// giving up, and when it still fails, surface a plain-language message
// instead of the raw Google error text — legal staff shouldn't have to parse
// "generativelanguage.googleapis.com/generate_content_free_tier_requests" to
// understand "try again in a bit".
async function callGemini(requestBody, attempt = 0) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let response;
  try {
    response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw new Error(`Failed to connect to the AI service: ${err.message}`);
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch (e) { /* ignore */ }
    if (response.status === 429 && attempt < 2) {
      await sleep(retryDelayMs(detail, attempt));
      return callGemini(requestBody, attempt + 1);
    }
    if (response.status === 429) {
      throw new Error('The AI service is busy right now (rate limit reached) — please wait a minute and try again.');
    }
    throw new Error(`AI service error (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = await response.json();
  const text_ = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text_) {
    throw new Error('The AI did not return a parseable result. Please try again.');
  }
  try {
    return JSON.parse(text_);
  } catch (err) {
    throw new Error('The AI\'s response could not be parsed. Please try again.');
  }
}

/**
 * @param {{fileName?: string, fileContentBase64: string}} input
 * @returns {Promise<{games: Array<{gameTitle: string, gameId?: string, provider?: string}>, approvalDate?: string, noticeReference?: string}>}
 */
async function extractApprovalNotice({ fileName, fileContentBase64 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI reading is not set up yet — add GEMINI_API_KEY to your environment variables first ' +
      '(see the README\'s AI setup section; you can get a free key at https://aistudio.google.com/apikey, ' +
      'no credit card required).'
    );
  }
  if (!fileContentBase64 || !String(fileContentBase64).trim()) {
    throw new Error('Please upload the approval notice file first (PDF or image).');
  }

  const parts = [
    {
      text:
        'This is an official "Notice of Approval" letter sent by PAGCOR (the Philippine gaming regulator) to an ' +
        'operator. It may be a scanned image, may list one or more approved electronic games, and may span ' +
        'multiple pages. Read the whole document carefully and extract, for each approved game: the game name ' +
        '(gameTitle), Game ID/Table ID (gameId, if the letter lists one), and the game manufacturer/Provider name ' +
        '(provider, if mentioned). If the letter states an approval date or a formal reference number, extract ' +
        'those too. Only extract what is actually written in the document — never invent information; omit any ' +
        'field that is unclear or not mentioned rather than guessing.',
    },
    filePart(fileName, fileContentBase64),
  ];

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a document-extraction assistant reading an official PAGCOR game-approval notice ' +
          'letter, which may be a scanned image with no text layer. Extract only facts explicitly ' +
          'visible in the document. Never invent information not present in it.',
      }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: APPROVAL_NOTICE_SCHEMA,
    },
  };

  const result = await callGemini(requestBody);
  return { games: [], ...result };
}

// ---------------------------------------------------------------------------
// AI document summary ("AI Summary") — optional (see GEMINI_API_KEY check
// below, same as every other AI feature in this file). Reads a document
// already stored in Document Center (server/routes.js's
// POST /api/documents/:id/summarize fetches its bytes from Supabase Storage
// and passes them in here) and returns a short plain-language summary plus
// a handful of key facts, so Tiffany doesn't have to read the whole file
// herself just to know what's in it. Deliberately NOT a compliance/approval
// check — it only reports what the document says, it never judges whether
// that's correct or sufficient. See the conversation that led to this: she
// asked for something to save her reading time, not an automated reviewer.
// ---------------------------------------------------------------------------
const DOCUMENT_SUMMARY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: {
      type: 'STRING',
      description: 'A short (2-4 sentence) plain-language summary of what this document is and what it says, written for someone who has not read it and has no other context.',
    },
    keyPoints: {
      type: 'ARRAY',
      description: 'Roughly 3-8 short, concrete key facts pulled from the document — e.g. parties, dates, amounts, game title, test result/conclusion, notable obligations or conditions — whatever is actually most important in THIS document. Each item should be a short standalone phrase or sentence, not a full paragraph.',
      items: { type: 'STRING' },
    },
  },
  required: ['summary', 'keyPoints'],
};

/**
 * @param {{fileName?: string, fileContentBase64?: string, text?: string}} input
 * @returns {Promise<{summary: string, keyPoints: string[]}>}
 */
async function summarizeDocument({ fileName, fileContentBase64, text }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI summary is not set up yet — add GEMINI_API_KEY to your environment variables first ' +
      '(see the README\'s AI setup section; you can get a free key at https://aistudio.google.com/apikey, ' +
      'no credit card required).'
    );
  }
  const hasText = text && String(text).trim().length > 0;
  const hasFile = fileContentBase64 && String(fileContentBase64).trim().length > 0;
  if (!hasText && !hasFile) {
    throw new Error('This document has no readable content, so an AI summary cannot be generated.');
  }

  const parts = [{
    text:
      'Read the following document content and write a short plain-language summary in English (2-4 sentences, ' +
      'understandable to someone who has never read the original), then list 3-8 key facts extracted from the ' +
      'document (e.g. parties, dates, amounts, game title, test result or conclusion, notable clauses — based on ' +
      'what is actually in the document, do not force every category). Only summarize what is actually written in ' +
      'the document — never add, speculate, or comment on anything the document does not mention. This is purely ' +
      'to save reading time, not a review or judgment of whether the document has any issues.',
  }];
  if (hasText) parts.push({ text: String(text) });
  if (hasFile) parts.push(filePart(fileName, fileContentBase64));

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a document-summarization assistant embedded in an internal legal department system ' +
          'for a gaming company. Read the provided document (which may be a contract, a PAGCOR regulatory ' +
          'submission report, an approval letter, or another legal/business document) and produce a short, ' +
          'accurate plain-language summary plus a handful of key facts, purely so the reader does not have ' +
          'to read the whole document themselves to know what is in it. Only report what is actually in the ' +
          'document — never invent facts, and never render a judgment about whether the document is correct, ' +
          'complete, or compliant with anything; that is out of scope for this tool.',
      }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: DOCUMENT_SUMMARY_SCHEMA,
    },
  };

  const result = await callGemini(requestBody);
  return { summary: '', keyPoints: [], ...result };
}

// ---------------------------------------------------------------------------
// AI pre-submission validation — the concrete ask that came out of legal's
// actual workflow feedback: before a PAGCOR game submission goes out, legal
// needs to know (1) whether every required document TYPE is actually
// present, and (2) whether the key parameters (Game ID, Version, Min/Max
// Bet, RTP) that get independently typed into each document by different
// people at different times still agree with each other. Those are two
// different questions — a bundle can be "complete" (every document type
// present) but still internally inconsistent, or vice versa — so this is
// reported as three separate sections rather than one flat checklist:
// documentCompleteness (does each required document TYPE exist at all),
// parameterValidation (does each tracked parameter have a value stated
// ANYWHERE), and documentConsistency (for parameters that do have values,
// do all the documents that mention it agree — shown per-source document so
// legal can see exactly which document said what). overallStatus is
// computed here in JS from the AI's three arrays rather than trusted as an
// AI-authored boolean, so the "Ready for Submission" banner always follows
// the same deterministic rule regardless of how the model phrases its own
// summary. Same "report, don't judge" boundary as summarizeDocument above:
// this only ever says whether something is present/consistent, never
// whether it is legally correct or PAGCOR-acceptable.
// ---------------------------------------------------------------------------
// 'EG Form' removed from this list 2026-08-25 at Tiffany's request — it's
// not treated as a required submission document for AI Submission
// Validation purposes.
const REQUIRED_DOCUMENT_TYPES = ['Game Parameters', 'Game Manual', 'RNG Certification', 'RTP Verification'];
// 'Content Provider Certification' demoted from required to supplementary
// 2026-08-25 at Tiffany's request (option A of the two she was offered):
// still checked and shown in the Document Completeness list so legal can
// see whether it's on file, but its absence never blocks "Ready for
// Submission" — unlike REQUIRED_DOCUMENT_TYPES, missing entries here don't
// count against overallStatus (see its computation below).
const SUPPLEMENTARY_DOCUMENT_TYPES = ['Content Provider Certification'];
const ALL_DOCUMENT_TYPES = [...REQUIRED_DOCUMENT_TYPES, ...SUPPLEMENTARY_DOCUMENT_TYPES];
const CHECKED_PARAMETERS = ['Game ID', 'Game Version', 'Minimum Bet', 'Maximum Bet', 'RTP'];

// PAGCOR's allowed RTP band (2026-08-20, at Tiffany's request) — RTP is
// checked differently from the other four parameters below: it doesn't need
// to match one specific submitted number, it just needs to fall inside this
// range. Bounds are inclusive.
const RTP_MIN_PERCENT = 90;
const RTP_MAX_PERCENT = 96.99;

// Jackpot combined-RTP rule (added 2026-08-25, at Tiffany's request —
// "有Jackpot的RTP是base game跟jackpot的RTP加起來，所以總和的RTP還是不能超過
// 或等於97%"). For a jackpot game, the Base Game RTP stated in its documents
// is only part of the story — the Jackpot RTP (the separate, usually small
// percentage of each bet that feeds the jackpot pool; see server/import.js's
// detectRtpColumn comment on real R88-template columns like "Jackpot RTP%")
// adds on top of it, and the COMBINED total is what must stay under 97%,
// even if the base game RTP alone already looks compliant against
// RTP_MIN_PERCENT..RTP_MAX_PERCENT above. Strict "< 97", not "<= 96.99" —
// Tiffany's rule is phrased as its own cutoff for the combined figure, not
// a reuse of the base-game band.
const JACKPOT_TOTAL_RTP_MAX_PERCENT = 97;

// Parses a value pulled out of a document into a plain percentage number.
// Different games' RTP verification/evaluation reports come from different
// testing labs (GLI, Gaming Associates, BMM, etc.) with their own wording
// and layout — "Total RTP", "Theoretical RTP", "Published RTP%", "RTP%
// Calculated by ga", "Target RTP", sometimes with a units label or trailing
// remark attached (2026-08-20, raised by Tiffany: RTP simply won't always
// come out as a clean bare number). So rather than requiring the whole
// string to be numeric, this pulls out the FIRST number-looking substring
// from whatever text Gemini extracted (e.g. "94.45% (Compliant)" -> 94.45,
// "Total RTP: 94.45" -> 94.45, "0.9445" -> 94.45) and only falls back to the
// fraction/percent ambiguity check (values <=1 assumed to be a raw Excel-
// style fraction, meaning *100) when the source text had no literal "%"
// telling us it was already a percentage. Returns null if no number is
// found at all (kept distinct from a real 0 — a document that genuinely
// says "0%" should still register as a value, just an out-of-range one).
function parseRtpPercent(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return null;
  if (text.includes('%')) return n;
  return n <= 1 ? n * 100 : n;
}

// Loose equality for the four fixed-value parameters (Game ID / Game
// Version / Minimum Bet / Maximum Bet) — a document value is compared
// against the value submitted in the provider's own Excel (expectedValues,
// passed in by the caller — see routes.js, which reads it off the game
// record's gameId/gameVersion/minBet/maxBet fields, themselves populated at
// import time from the Excel's own "GAME ID"/"GAME VERSION"/"MINIMUM BET"/
// "MAXIMUM BET" columns — see server/import.js). Numbers compare
// numerically (so "0.5" and "0.50" match); everything else compares as
// trimmed, case-insensitive text (so "vp_230039_1" matches "VP_230039_1").
function valuesMatch(expected, actual, isCurrencyAmount) {
  if (expected === null || expected === undefined || actual === null || actual === undefined) return false;
  if (isCurrencyAmount) {
    // Minimum/Maximum Bet only — a document can state these with a currency
    // symbol/label attached (e.g. "PHP 0.50", "₱1,000.00") rather than as a
    // bare number, so pull out the first number-looking substring the same
    // way parseRtpPercent does, rather than requiring the whole string to
    // parse cleanly as a number. Thousand-separator commas are stripped
    // first (bug found 2026-08-25 while writing test/ai.test.js: the old
    // regex stopped at the first comma, so "₱1,000.00" — this function's OWN
    // doc-comment example above — parsed as 1, not 1000, and silently
    // reported a real match as a mismatch).
    const expMatch = String(expected).trim().replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    const actMatch = String(actual).trim().replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    const expNum = expMatch ? Number(expMatch[0]) : NaN;
    const actNum = actMatch ? Number(actMatch[0]) : NaN;
    if (Number.isFinite(expNum) && Number.isFinite(actNum)) return expNum === actNum;
    return false;
  }
  // Game ID / Game Version — these are identifiers, not arithmetic values
  // (e.g. "v1.10" is a different version from "v1.1", not the number 1.1),
  // so no embedded-number extraction here: only an exact full-string numeric
  // match (so "0.5" still equals "0.50" if a version happens to look
  // numeric) or an exact case-insensitive text match count as equal.
  const expNum = Number(String(expected).trim());
  const actNum = Number(String(actual).trim());
  if (Number.isFinite(expNum) && Number.isFinite(actNum)) return expNum === actNum;
  return String(expected).trim().toLowerCase() === String(actual).trim().toLowerCase();
}

const SUBMISSION_VALIDATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentCompleteness: {
      type: 'ARRAY',
      description: `Exactly ${ALL_DOCUMENT_TYPES.length} entries, one for each of: ${ALL_DOCUMENT_TYPES.join(', ')} — always all of them, in that order, even when a type is not present at all (present: false in that case rather than omitting it). ${SUPPLEMENTARY_DOCUMENT_TYPES.join(', ')} ${SUPPLEMENTARY_DOCUMENT_TYPES.length > 1 ? 'are' : 'is'} supplementary (nice-to-have, not required for submission) — still check and report on it the same way, the caller treats it differently, not you.`,
      items: {
        type: 'OBJECT',
        properties: {
          documentType: { type: 'STRING', enum: ALL_DOCUMENT_TYPES },
          present: { type: 'BOOLEAN', description: 'true if one of the provided documents is (or clearly contains) this document type.' },
          detail: { type: 'STRING', description: 'One short sentence — e.g. which document matched this type, or that none did.' },
        },
        required: ['documentType', 'present', 'detail'],
      },
    },
    parameterValidation: {
      type: 'ARRAY',
      description: `Exactly ${CHECKED_PARAMETERS.length} entries, one for each of: ${CHECKED_PARAMETERS.join(', ')} — always all of them, in that order. This only checks whether a value exists ANYWHERE among the documents, not whether it is consistent (that is documentConsistency below).`,
      items: {
        type: 'OBJECT',
        properties: {
          parameter: { type: 'STRING', enum: CHECKED_PARAMETERS },
          present: { type: 'BOOLEAN', description: 'true if at least one document states a value for this parameter.' },
          detail: { type: 'STRING', description: 'One short sentence — e.g. that no document mentions this parameter at all.' },
        },
        required: ['parameter', 'present', 'detail'],
      },
    },
    documentConsistency: {
      type: 'ARRAY',
      description: `Exactly ${CHECKED_PARAMETERS.length} entries, one for each of: ${CHECKED_PARAMETERS.join(', ')} — always all of them, in that order.`,
      items: {
        type: 'OBJECT',
        properties: {
          parameter: { type: 'STRING', enum: CHECKED_PARAMETERS },
          status: {
            type: 'STRING',
            enum: ['match', 'mismatch', 'missing', 'in_range', 'out_of_range'],
            description: 'Your best-effort read of this — the caller recomputes the authoritative status itself from the `values` you extract below, so this field is only a fallback and does not need to be precise.',
          },
          values: {
            type: 'ARRAY',
            description: 'One entry per document that explicitly states a value for this parameter (omit documents that do not mention it). Empty array if status is "missing".',
            items: {
              type: 'OBJECT',
              properties: {
                source: { type: 'STRING', description: 'The document\'s name/title, exactly as given in this request, identifying which document this value came from.' },
                value: { type: 'STRING', description: 'The value as stated in that document, as plain text.' },
              },
              required: ['source', 'value'],
            },
          },
          detail: { type: 'STRING', description: 'One short sentence summarizing the comparison.' },
        },
        required: ['parameter', 'status', 'values', 'detail'],
      },
    },
    summary: {
      type: 'STRING',
      description: 'One short plain-language sentence summarizing the overall result.',
    },
  },
  required: ['documentCompleteness', 'parameterValidation', 'documentConsistency', 'summary'],
};

/**
 * @param {{
 *   caseTitle?: string, gameTitle?: string, gameId?: string,
 *   expectedValues?: {gameId?: string|null, gameVersion?: string|null, minBet?: number|null, maxBet?: number|null},
 *   documents: Array<{fileName?: string, fileContentBase64: string}>,
 * }} input `expectedValues` is the provider's own submitted values (read off
 *   the case's Excel import — see server/import.js / routes.js's
 *   rowToGame()) for the four fixed-value parameters. RTP has no
 *   corresponding entry: it's checked against the RTP_MIN_PERCENT/
 *   RTP_MAX_PERCENT range below instead of against one specific number.
 * @returns {Promise<{
 *   overallStatus: 'ready'|'not_ready',
 *   documentCompleteness: Array<{documentType: string, present: boolean, detail: string}>,
 *   parameterValidation: Array<{parameter: string, present: boolean, detail: string}>,
 *   documentConsistency: Array<{parameter: string, status: 'match'|'mismatch'|'missing'|'in_range'|'out_of_range', values: Array<{source: string, value: string}>, expectedValue: string|null, detail: string}>,
 *   summary: string,
 * }>}
 */
async function checkDocumentConsistency({ caseTitle, gameTitle, gameId, expectedValues, documents, withJackpot }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI pre-submission check is not set up yet — add GEMINI_API_KEY to your environment variables first ' +
      '(see the README\'s AI setup section; you can get a free key at https://aistudio.google.com/apikey, ' +
      'no credit card required).'
    );
  }
  const docs = (Array.isArray(documents) ? documents : []).filter((d) => d && d.fileContentBase64 && String(d.fileContentBase64).trim());
  if (docs.length < 2) {
    throw new Error('This case needs at least 2 related documents with an attached file before an AI pre-submission check can run.');
  }

  const context = [
    caseTitle ? `Case: ${caseTitle}` : null,
    gameTitle ? `Game: ${gameTitle}` : null,
    gameId ? `Game ID: ${gameId}` : null,
  ].filter(Boolean).join(', ');

  // Maps CHECKED_PARAMETERS entries to expectedValues keys — used both to
  // build the prompt line below and, after the response comes back, to
  // recompute each parameter's real status in JS (see the post-processing
  // block below `callGemini`).
  const EXPECTED_VALUE_KEYS = { 'Game ID': 'gameId', 'Game Version': 'gameVersion', 'Minimum Bet': 'minBet', 'Maximum Bet': 'maxBet' };
  const expectedLines = Object.entries(EXPECTED_VALUE_KEYS)
    .map(([label, key]) => [label, expectedValues && expectedValues[key] != null ? expectedValues[key] : null])
    .filter(([, v]) => v !== null)
    .map(([label, v]) => `${label}: ${v}`);

  const parts = [{
    text:
      `The following are ${docs.length} documents related to the same PAGCOR game-submission case${context ? ` (${context})` : ''}. ` +
      'Perform a pre-submission check, broken into three parts — report all three in full, do not omit any of them: ' +
      `1) Document completeness: check whether each of these ${ALL_DOCUMENT_TYPES.length} submission document types is present — ${ALL_DOCUMENT_TYPES.join(', ')} ` +
      `(${SUPPLEMENTARY_DOCUMENT_TYPES.join(', ')} ${SUPPLEMENTARY_DOCUMENT_TYPES.length > 1 ? 'are' : 'is'} supplementary/optional, the rest are required — check and report on all of them regardless). ` +
      'If any one document clearly belongs to a type, count it as present; mark it not present if no matching document is found (judge the type from the document\'s actual content, not just its file name). ' +
      `2) Parameter completeness: check whether each of these ${CHECKED_PARAMETERS.length} parameters has a value stated in "at least one document" — ${CHECKED_PARAMETERS.join(', ')}. ` +
      'This only judges whether a value exists, not whether it is consistent. ' +
      '3) For these same parameters, list every document that explicitly states a value for it along with that value, exactly as written in that document — ' +
      'never invent a value or a document that is not actually there. Do NOT judge match/mismatch/range yourself; the caller recomputes that deterministically from the raw values you list here. ' +
      'Note on RTP specifically: different games\' RTP verification/evaluation reports may come from different independent testing labs, each with its own layout and wording — ' +
      'terms like "Total RTP", "Theoretical RTP", "Target RTP", "Published RTP%", or "RTP% Calculated" can all be the value to extract here, and it may be written as a percentage (94.45%) ' +
      'or a decimal fraction (0.9445). Extract whichever number that document states as ITS RTP value for this specific game, in whatever format/wording it actually uses — ' +
      'do not require an exact phrase match, and do not mark RTP "missing" just because a report uses different terminology than another one does.' +
      (expectedLines.length
        ? ` For reference, the provider's own submitted values for this game are — ${expectedLines.join('; ')} — extract each document's stated value independently of this regardless of whether it agrees.`
        : ''),
  }];
  docs.forEach((d, i) => {
    parts.push({ text: `[Document ${i + 1}: ${d.fileName || `Document ${i + 1}`}]` });
    parts.push(filePart(d.fileName, d.fileContentBase64));
  });

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a pre-submission validation assistant embedded in an internal legal department system for ' +
          'a gaming company, reviewing PAGCOR (Philippine gaming regulator) game-submission document bundles ' +
          'before they go out. Given several documents about the same game submission, check document type ' +
          'completeness and parameter completeness exactly as requested, and extract each document\'s stated ' +
          'value for each tracked parameter verbatim — reporting every requested item even when the answer is ' +
          '"not present" or "missing" rather than omitting it. This tool focuses purely on pre-submission ' +
          'validation — never judge whether a value is legally correct, compliant, or PAGCOR-acceptable, and ' +
          'never invent a value or a document that is not actually there. Do not decide match/mismatch/range ' +
          'status yourself — the caller recomputes that deterministically from the values you extract.',
      }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SUBMISSION_VALIDATION_SCHEMA,
    },
  };

  const result = await callGemini(requestBody);
  const documentCompleteness = Array.isArray(result.documentCompleteness) ? result.documentCompleteness : [];
  const parameterValidation = Array.isArray(result.parameterValidation) ? result.parameterValidation : [];
  const rawConsistency = Array.isArray(result.documentConsistency) ? result.documentConsistency : [];

  // Partial-failure detection (2026-08-24, at Tiffany's request) — the
  // schema instructs Gemini to report on EVERY entry in
  // REQUIRED_DOCUMENT_TYPES/CHECKED_PARAMETERS "even when the answer is
  // missing", so a response that comes back with fewer entries than that
  // isn't "this game happens to be missing everything" — it's the AI call
  // itself only partially complying with its own schema (truncation, a
  // schema-compliance hiccup, etc.). Recorded here, BEFORE the "Game
  // Parameters" override below can grow documentCompleteness by one entry,
  // so a spreadsheet-triggered addition never masks a genuinely short
  // response (or vice versa — falsely flags one that was actually complete
  // before the override ran).
  const aiResponseIncomplete = (
    documentCompleteness.length < ALL_DOCUMENT_TYPES.length
    || parameterValidation.length < CHECKED_PARAMETERS.length
    || rawConsistency.length < CHECKED_PARAMETERS.length
  );

  // "Game Parameters" completeness override — added 2026-08-20 after
  // Tiffany noticed the SAME Annex A Excel submission form got judged
  // "Present" for one game (Fortune Panda) and "Missing" for another
  // (Power of Odin) within the same check run ("一開始匯入的excel就是
  // Parameters" — the Excel IS the Game Parameters document, full stop).
  // That inconsistency is Gemini's own document-type classification being
  // asked to judge the same evidence twice and landing on two different
  // answers — same root problem the deterministic documentConsistency
  // recompute below already solves for match/mismatch/range, just for
  // completeness instead. The Excel/CSV submission form's presence is a
  // simple, checkable fact (its file extension), not something that needs
  // an LLM's judgment call, so: if a spreadsheet file is among the
  // documents actually being compared, "Game Parameters" is always
  // present — never left to vary run to run.
  // Checked two ways, since the caller (server/routes.js) passes each
  // document's TITLE as `fileName` when one is set (e.g. "Annex A New
  // Games Request for Approval - Vertex Play", which has no file
  // extension at all) rather than its actual on-disk file name — so a
  // plain filename-extension check alone would miss most real Excel
  // submissions. `fileContentBase64` is a `data:<mimeType>;base64,...`
  // URL built from the file's real extension via server/mime.js's
  // mimeFor(), so it stays reliable regardless of what the title says.
  const isSpreadsheetDoc = (d) => (
    /^data:(application\/vnd\.openxmlformats-officedocument\.spreadsheetml|application\/vnd\.ms-excel|text\/csv)/i.test(String(d.fileContentBase64 || ''))
    || /\.(xlsx|xls|xlsm|csv)$/i.test(String(d.fileName || ''))
  );
  const hasSpreadsheetDoc = docs.some(isSpreadsheetDoc);
  if (hasSpreadsheetDoc) {
    const spreadsheetDoc = docs.find(isSpreadsheetDoc);
    const idx = documentCompleteness.findIndex((d) => d && d.documentType === 'Game Parameters');
    const entry = {
      documentType: 'Game Parameters',
      present: true,
      detail: `The submission spreadsheet (${spreadsheetDoc.fileName}) contains the game's declared parameters (Game ID, Game Version, Minimum/Maximum Bet, RTP).`,
    };
    if (idx === -1) documentCompleteness.push(entry);
    else documentCompleteness[idx] = entry;
  }

  // Recompute each parameter's status deterministically from the raw
  // (EXPECTED_VALUE_KEYS declared once above, near the prompt-building code)
  // per-document values Gemini extracted, rather than trusting whatever
  // match/mismatch/range judgment it made itself (the schema still asks for
  // one as a fallback, but this is the one actually used) — see the two
  // rule types 2026-08-20 (at Tiffany's request):
  //   - RTP: no single "correct" value to match — checked against the
  //     PAGCOR-allowed RTP_MIN_PERCENT–RTP_MAX_PERCENT range instead.
  //   - Game ID / Game Version / Minimum Bet / Maximum Bet: checked against
  //     the provider's own submitted value (expectedValues, from the
  //     Excel import) if one is on file; falls back to the older
  //     "do the documents at least agree with each other" comparison when
  //     no expected value is available (e.g. a legacy pre-Excel-import case).
  const documentConsistency = CHECKED_PARAMETERS.map((parameter) => {
    const entry = rawConsistency.find((c) => c && c.parameter === parameter) || {};
    const values = Array.isArray(entry.values) ? entry.values.filter((v) => v && v.value != null && String(v.value).trim()) : [];
    const detail = typeof entry.detail === 'string' ? entry.detail : '';

    if (parameter === 'RTP') {
      const parsed = values.map((v) => ({ ...v, percent: parseRtpPercent(v.value) })).filter((v) => v.percent !== null);

      // Jackpot combined-RTP rule — see JACKPOT_TOTAL_RTP_MAX_PERCENT above.
      // Only kicks in when this game is flagged With Jackpot AND a Jackpot
      // RTP figure is actually on file (from the provider's own Excel
      // import — server/import.js's jackpotRtp column detection); otherwise
      // falls through to the ordinary base-game-only band check below,
      // same as before this rule existed.
      const jackpotRtpValue = withJackpot === 'Yes' && expectedValues && expectedValues.jackpotRtp != null
        ? Number(expectedValues.jackpotRtp)
        : null;
      if (jackpotRtpValue !== null && !Number.isNaN(jackpotRtpValue) && parsed.length > 0) {
        const combined = parsed.map((v) => ({ ...v, totalPercent: v.percent + jackpotRtpValue }));
        const status = combined.every((v) => v.totalPercent < JACKPOT_TOTAL_RTP_MAX_PERCENT) ? 'in_range' : 'out_of_range';
        const displayValues = combined.map((v) => ({
          ...v,
          value: `${Math.round(v.percent * 100) / 100}% base + ${Math.round(jackpotRtpValue * 100) / 100}% jackpot = ${Math.round(v.totalPercent * 100) / 100}% total`,
        }));
        return {
          parameter,
          status,
          values: displayValues,
          expectedValue: `< ${JACKPOT_TOTAL_RTP_MAX_PERCENT}% combined (base game + jackpot)`,
          detail: detail || 'This game has a jackpot, so its combined RTP (base game RTP + jackpot RTP) must stay under 97%, per Tiffany\'s compliance rule for jackpot games.',
        };
      }

      const status = parsed.length === 0
        ? 'missing'
        : parsed.every((v) => v.percent >= RTP_MIN_PERCENT && v.percent <= RTP_MAX_PERCENT)
          ? 'in_range'
          : 'out_of_range';
      // Normalize each document's displayed value to a percentage string
      // (2026-08-24, at Tiffany's request) — documents state RTP in mixed
      // formats ("94.07%" vs a raw decimal fraction like "0.9445"), and
      // without this the modal showed them inconsistently side by side
      // instead of e.g. "94.07%" next to "94.45%".
      const displayValues = parsed.map((v) => ({ ...v, value: `${Math.round(v.percent * 100) / 100}%` }));
      return { parameter, status, values: displayValues, expectedValue: `${RTP_MIN_PERCENT}%–${RTP_MAX_PERCENT}%`, detail };
    }

    const expectedKey = EXPECTED_VALUE_KEYS[parameter];
    const expectedValue = expectedValues && expectedValues[expectedKey] != null ? expectedValues[expectedKey] : null;
    const isCurrencyAmount = parameter === 'Minimum Bet' || parameter === 'Maximum Bet';
    let status;
    if (values.length === 0) {
      status = 'missing';
    } else if (expectedValue !== null) {
      status = values.every((v) => valuesMatch(expectedValue, v.value, isCurrencyAmount)) ? 'match' : 'mismatch';
    } else {
      // No submitted value on file for this game (e.g. legacy case) — fall
      // back to the original behavior of checking the documents agree with
      // each other, since there's nothing else to compare against.
      const firstValue = values[0].value;
      status = values.every((v) => valuesMatch(firstValue, v.value, isCurrencyAmount)) ? 'match' : 'mismatch';
    }
    return { parameter, status, values, expectedValue: expectedValue !== null ? String(expectedValue) : null, detail };
  });

  // overallStatus is derived here (not trusted from the model) so the
  // "Ready for Submission" banner always follows the same fixed rule: every
  // required document type must be present, every tracked parameter must
  // have a value somewhere, RTP must fall in the allowed range, and the
  // other four parameters must match their submitted (Excel) value.
  // Each array gets its own `.length > 0` guard, not just documentCompleteness
  // — Array.prototype.every() vacuously returns true on an empty array, so
  // without this, a malformed/truncated Gemini response that comes back
  // with an empty parameterValidation or documentConsistency (schema
  // non-compliance, an API hiccup, etc.) would silently report "ready" for
  // a real PAGCOR filing without ever actually validating those sections.
  // aiResponseIncomplete (computed above, before the Game Parameters
  // override) takes priority over the normal ready/not_ready verdict — an
  // 'error' status is a distinct, third outcome from 'ready'/'not_ready' so
  // the UI can tell "the AI call itself didn't fully come back, please
  // re-run this" apart from "this was actually checked and something is
  // genuinely wrong". Without this distinction a truncated response reads
  // identically to a real compliance failure, which is worse than useless
  // for legal staff deciding whether to trust the result.
  // Only REQUIRED_DOCUMENT_TYPES entries count toward "Ready for
  // Submission" — a SUPPLEMENTARY_DOCUMENT_TYPES entry (e.g. Content
  // Provider Certification, demoted 2026-08-25 at Tiffany's request) is
  // still shown in documentCompleteness above, but a missing one never
  // blocks overallStatus the way a missing required document does.
  const requiredCompleteness = documentCompleteness.filter((d) => REQUIRED_DOCUMENT_TYPES.includes(d.documentType));
  const overallStatus = aiResponseIncomplete ? 'error' : (
    requiredCompleteness.length > 0
    && requiredCompleteness.every((d) => d.present)
    && parameterValidation.length > 0
    && parameterValidation.every((p) => p.present)
    && documentConsistency.length > 0
    && documentConsistency.every((c) => c.status === 'match' || c.status === 'in_range')
  ) ? 'ready' : 'not_ready';

  return {
    overallStatus,
    partial: aiResponseIncomplete,
    documentCompleteness,
    // Passed through so the frontend (public/js/app.js's
    // showConsistencyResultModal) can render supplementary entries with a
    // neutral/informational badge instead of the same red "Missing" treatment
    // required entries get — a missing supplementary document is expected to
    // happen sometimes and isn't a compliance problem the way a missing
    // required one is.
    supplementaryDocumentTypes: SUPPLEMENTARY_DOCUMENT_TYPES,
    parameterValidation,
    documentConsistency,
    summary: aiResponseIncomplete
      ? 'The AI did not return a complete result for every required document type / parameter this run — please re-run the check rather than relying on this result.'
      : (typeof result.summary === 'string' ? result.summary : ''),
  };
}

// (The AI Case-Intake Wizard — "upload all documents for a game submission
// at once and let AI organize them into a new Case" — was removed entirely
// 2026-08-26 at Tiffany's request, since real case creation is done via the
// Excel import instead and this had become dead/unreachable code on the
// frontend already. Removed along with it: this module's
// extractCaseFromDocuments/CASE_INTAKE_SCHEMA, server/routes.js's
// /api/cases/extract-from-documents route, and public/js/app.js's
// showCaseIntakeWizard and its supporting functions.)

function schemaFor(module) {
  const schema = MODULE_SCHEMAS[module];
  if (!schema) {
    throw new Error(`Unknown AI module "${module}". Expected one of: ${Object.keys(MODULE_SCHEMAS).join(', ')}`);
  }
  return schema;
}

// Gemini's `responseSchema` (structured JSON output) uses UPPERCASE type
// names (STRING/OBJECT/ARRAY/...) — a genuinely different convention from
// the lowercase JSON-Schema-style types used in MODULE_SCHEMAS above (and
// from Gemini's OWN functionDeclarations.parameters format, which *does*
// use lowercase — an inconsistency in Gemini's API itself, not a typo here).
// Recursive so a module schema can nest an `array` field whose `items` is
// itself an object with its own `properties` (see documents' `detectedGames`
// above) — every field before that one was a flat string/enum, so this used
// to be a flat single-level map; the recursion only ever triggers for a
// field that actually declares nested `items`.
function convertSchemaProp(def) {
  const prop = { type: String(def.type || 'string').toUpperCase() };
  if (def.description) prop.description = def.description;
  if (def.enum) prop.enum = def.enum;
  if (prop.type === 'ARRAY' && def.items) {
    prop.items = def.items.properties ? toGeminiResponseSchema(def.items) : convertSchemaProp(def.items);
  }
  return prop;
}
function toGeminiResponseSchema({ properties, required }) {
  const converted = {};
  for (const [key, def] of Object.entries(properties)) {
    converted[key] = convertSchemaProp(def);
  }
  return { type: 'OBJECT', properties: converted, required: required || [] };
}

// ---------------------------------------------------------------------------
// File-input handling
// ---------------------------------------------------------------------------
// Frontend sends fileContentBase64 as a data: URL (from FileReader.readAsDataURL),
// e.g. "data:application/pdf;base64,JVBERi0xLjQK...". Split off the real mime
// type and the raw base64 payload.
function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  return { mimeType: m[1], base64: m[2] };
}

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Builds the Gemini content part for an uploaded file, or throws a friendly
// error for file types Gemini can't take directly (e.g. legacy .xls/.docx)
// — those users should paste the text instead.
function filePart(fileName, fileContentBase64) {
  const parsed = parseDataUrl(fileContentBase64);
  if (!parsed) throw new Error('Could not read the uploaded file — please try re-uploading it.');
  const { mimeType, base64 } = parsed;

  if (mimeType === 'application/pdf' || SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return { inlineData: { mimeType, data: base64 } };
  }
  if (mimeType === 'text/plain') {
    return { text: Buffer.from(base64, 'base64').toString('utf8') };
  }
  if (mimeType === XLSX_MIME_TYPE) {
    // Gemini has no native "spreadsheet" input type the way it does for
    // PDF/images, so this converts the workbook into a flat, tab-separated
    // text table first (see xlsx-lite.js's xlsxToText()) and sends that as
    // a plain text part instead — same path a pasted-in text excerpt
    // already goes through just above.
    let text;
    try {
      text = xlsxToText(Buffer.from(base64, 'base64'));
    } catch (err) {
      throw new Error(`There was a problem reading this Excel file: ${err.message}`);
    }
    return { text: `The following is the content of the Excel file "${fileName || ''}", tab-separated by column:\n${text}` };
  }
  throw new Error(
    `AI smart-fill currently only supports PDF, images (PNG/JPG/GIF/WEBP), plain text files, or Excel (.xlsx) — this file is "${mimeType}". ` +
    'Please paste the text content instead, or convert it to PDF and try again.'
  );
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
/**
 * @param {{module: string, text?: string, fileName?: string, fileContentBase64?: string}} input
 * @returns {Promise<object>} the extracted fields object (matches the module's form fields)
 */
async function extractFields({ module, text, fileName, fileContentBase64 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI smart-fill is not set up yet — add GEMINI_API_KEY to your environment variables first ' +
      '(see the README\'s AI setup section; you can get a free key at https://aistudio.google.com/apikey, ' +
      'no credit card required). Until then, every other part of the system is unaffected — only this button ' +
      'is temporarily unavailable.'
    );
  }
  const schema = schemaFor(module);

  const hasText = text && String(text).trim().length > 0;
  const hasFile = fileContentBase64 && String(fileContentBase64).trim().length > 0;
  if (!hasText && !hasFile) {
    throw new Error('Please paste some text or upload a file first, then click "AI Smart-Fill".');
  }

  const parts = [{
    text:
      `The following is data the user provided related to a "${schema.label}" record (may be pasted text and/or ` +
      'an attached file). Extract fields based only on this data itself — never invent or supplement content the ' +
      'data does not mention; omit any field you are unsure of rather than guessing. Always use YYYY-MM-DD format ' +
      'for dates.' +
      (schema.extraPromptInstructions ? ` ${schema.extraPromptInstructions}` : ''),
  }];
  if (hasText) parts.push({ text: String(text) });
  if (hasFile) parts.push(filePart(fileName, fileContentBase64));

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a data-extraction assistant embedded in an internal legal department system. ' +
          'You are given free-form text and/or a file, and must extract only the facts explicitly ' +
          'present in it. Never invent information that is not present.',
      }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiResponseSchema(schema),
    },
  };

  // Routed through the shared callGemini() (2026-08-24) instead of a second
  // hand-rolled fetch, so Smart-Fill gets the same 429 retry/backoff and
  // plain-language rate-limit message as every other AI feature in this file.
  return callGemini(requestBody);
}

// ---------------------------------------------------------------------------
// Telegram group Q&A bot (added 2026-08-19, at Tiffany's request)
// ---------------------------------------------------------------------------
// Every message posted in a Provider's Telegram group (the same group
// notifyProviderTelegram in routes.js already posts PAGCOR Stage updates
// into) gets run through this — it decides for itself whether the message
// was actually a question the bot should answer (about that Provider's
// cases: status, stage, documents, timelines) versus ordinary chit-chat
// between people, and only replies when it's confident it's the former.
// Deliberately conservative (shouldRespond defaults toward false) since a
// bot that jumps into unrelated conversation with a wrong or irrelevant
// reply is worse than one that occasionally misses a real question — see
// server/routes.js's telegram webhook handler for how this is wired up.
//
// Fallback reply for a genuine-but-unanswerable question (added 2026-08-26,
// at Tiffany's request): a real on-topic question that the bot has no data
// for used to get total silence, indistinguishable from the bot simply
// being broken — this is exactly what made today's Telegram-not-replying
// troubleshooting session so hard to diagnose. Now shouldRespond stays true
// for any genuine on-topic question, with the model falling back to a short
// "no information on file, ask Crystal directly" reply instead of an
// invented answer when the data doesn't cover it. Only truly off-topic/non-
// question messages (small talk, greetings, the weather) still get total
// silence. "Crystal" is hardcoded here at Tiffany's request as the point of
// contact — see Settings > Users for the current Crystal Bayquen (Admin)
// account; update this string if that contact ever changes.
const GROUP_QA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    shouldRespond: {
      type: 'BOOLEAN',
      description: 'true if this message is a genuine, on-topic question the bot should reply to — either because the case data/Knowledge Base/Calendar events/Task items can actually answer it, OR because it\'s clearly a real question about a case/Provider/PAGCOR-regulatory/calendar/task topic that the bot happens to lack data for (in that second situation, still set this true and use the "no information on file, ask Crystal" fallback wording described under `answer`). Set false ONLY for messages that are not really questions at all for this bot — greetings, small talk, messages clearly directed at another person, or topics entirely unrelated to cases/PAGCOR/calendar/tasks (e.g. the weather, the stock market) — so the bot stays silent rather than replying to every stray message. When genuinely unsure whether it\'s even a real question, prefer false.',
    },
    answer: {
      type: 'STRING',
      description: 'A short, direct, friendly reply, in the same language the question was asked in. When the case data, Knowledge Base, Calendar events, or Task items actually cover it, answer from ONLY that data — never invent a stage, date, document status, event, or task not present in it. When it\'s a genuine on-topic question but nothing given actually answers it, instead reply with a brief, honest "I don\'t have information on that — you may want to ask Crystal directly" in that same language (never guess at an answer in this situation either). Empty string when shouldRespond is false.',
    },
  },
  required: ['shouldRespond', 'answer'],
};

/**
 * @param {{providerName: string|null, question: string, cases: Array<object>, kbFaqs?: Array<object>, kbDocuments?: Array<object>, calendarEvents?: Array<object>, tasks?: Array<object>, isAdmin?: boolean}} input
 *   `isAdmin` (added 2026-08-26, at Tiffany's request) — true for the one
 *   designated internal/admin Telegram chat (see server/routes.js's
 *   telegramAdminChatId), which is allowed to ask about ANY Provider's
 *   cases rather than being locked to a single Provider. When true,
 *   `providerName` is ignored (pass null) and `cases` should be every
 *   Provider's cases, not one Provider's — each case line is labelled with
 *   its own Provider so the model can tell them apart.
 *   `kbFaqs`/`kbDocuments` (added 2026-08-25, at Tiffany's request) — the
 *   company-approved Knowledge Base content (Knowledge Base > FAQ /
 *   Documents) with status 'Active', so the bot can also answer general
 *   PAGCOR/regulatory questions that aren't about any one specific case, as
 *   long as there's approved KB content to ground the answer in.
 *   Draft/Pending Review/Archived entries are deliberately excluded by the
 *   caller (server/routes.js's telegram webhook handler) before this is
 *   called — only Tiffany-approved content should ever be quoted back to a
 *   Provider. kbDocuments only contributes its `notes` (a human-written
 *   summary) — the underlying linked/uploaded file's actual content is
 *   never fetched or sent here, so a document with no notes written
 *   contributes nothing beyond its title (most real KB question-answering
 *   value ends up coming from kbFaqs' short direct answers and from
 *   kbDocuments entries that do have a notes summary; both are optional and
 *   independently useful — pass whichever exist).
 *   `calendarEvents` (added 2026-08-27, at Tiffany's request) — freeform
 *   Calendar page entries (server/routes.js's /api/calendar-events:
 *   `title`, `date`, optional `note`), so the bot can also answer "what's
 *   coming up" / "any events on X date" questions. These are visible to
 *   everyone regardless of Provider (same as the Calendar page itself), so
 *   the caller should pass every calendar event on file, not filter by
 *   Provider/isAdmin.
 *   `tasks` (added 2026-08-27, at Tiffany's request) — Task Management
 *   entries the bot may discuss, so it can answer "what's outstanding" /
 *   task-status questions. Deliberately restricted by the caller
 *   (server/routes.js's telegram webhook handler) to TEAM tasks only —
 *   `type !== 'personal'` — since a Task can be marked Personal specifically
 *   to keep it visible only to its creator/assignee (see
 *   filterPersonalTasks() in routes.js); a group-chat bot must never expose
 *   a Personal task to the whole group. Each entry expected as
 *   `{title, dueDate, status, provider, assigneeNames}` — `provider` (the
 *   Provider of the task's linked case, if any) is caller-resolved so this
 *   function doesn't need the full cases/users tables just for that; for a
 *   non-admin chat the caller should have already filtered to only this
 *   Provider's own case-linked tasks (same Provider-isolation rule as
 *   `cases`).
 * @returns {Promise<{shouldRespond: boolean, answer: string}>}
 */
async function answerGroupQuestion({ providerName, question, cases, kbFaqs, kbDocuments, calendarEvents, tasks, isAdmin }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
  if (!question || !String(question).trim()) throw new Error('No message text to answer.');

  // A multi-game case (see server/routes.js's crudRoutes onCreate/onUpdate
  // for /api/cases) never gets a case-level `pagcorStage`/`gameTitle` — each
  // game under `c.games[]` tracks its own Stage/Game ID/With
  // Jackpot/Rejection Reason independently, and the case row itself is left
  // with no top-level PAGCOR fields at all. This used to read `c.pagcorStage`
  // / `c.gameTitle` directly, so for any multi-game case the bot always saw
  // "Stage=Unknown" (or the case's generic Open/In Progress/Closed `status`)
  // regardless of what any individual game's real PAGCOR Stage was — asking
  // the bot about a specific game that had just been marked Approved would
  // report stale/wrong information even though the change was saved
  // correctly. Fixed 2026-08-26: expand every multi-game case into one line
  // per game (each carrying its own Stage/Game ID/With Jackpot/Rejection
  // Reason), and only fall back to the case's own flat fields for a
  // legacy/non-PAGCOR case that has no `games` array at all.
  const caseLines = (Array.isArray(cases) ? cases : []).flatMap((c) => {
    const games = Array.isArray(c.games) && c.games.length ? c.games : [c];
    return games.map((g) => {
      const bits = [
        // isAdmin: each line is labelled with its own Provider up front,
        // since this list now spans every Provider instead of just one.
        isAdmin ? `Provider=${c.provider || 'Unknown'}` : null,
        `Stage=${g.pagcorStage || c.status || 'Unknown'}`,
        `Submit Date=${c.deadline || 'N/A'}`,
        g.gameId ? `Game ID=${g.gameId}` : null,
        g.withJackpot ? `With Jackpot=${g.withJackpot}` : null,
        g.pagcorStage === 'Rejected' && g.rejectionReason ? `Rejection Reason=${g.rejectionReason}` : null,
      ].filter(Boolean).join(', ');
      return `- ${g.gameTitle || c.title}${c.caseNumber ? ` (Case ${c.caseNumber})` : ''}: ${bits}`;
    });
  });

  const kbFaqLines = (Array.isArray(kbFaqs) ? kbFaqs : []).map((f) => `- Q: ${f.question}\n  A: ${f.answer}`);
  // Only documents that actually have a written summary are worth sending —
  // a bare title/category with no notes gives the model nothing to answer
  // from and would just be noise in the prompt.
  const kbDocLines = (Array.isArray(kbDocuments) ? kbDocuments : [])
    .filter((d) => d.notes && String(d.notes).trim())
    .map((d) => `- ${d.title}${d.category ? ` (${d.category})` : ''}: ${d.notes}`);

  // Sorted chronologically so "what's coming up" reads naturally; the model
  // is also told today's date (below) so it can resolve "tomorrow"/"this
  // week" relative to it rather than guessing.
  const calendarLines = (Array.isArray(calendarEvents) ? calendarEvents : [])
    .slice()
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map((e) => `- ${e.date || 'N/A'}: ${e.title || '(untitled)'}${e.note ? ` — ${e.note}` : ''}`);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Team tasks only — the caller has already excluded Personal tasks and
  // (for a non-admin/Provider chat) already restricted to this Provider's
  // own case-linked tasks. See the JSDoc above for why.
  const taskLines = (Array.isArray(tasks) ? tasks : [])
    .slice()
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    .map((t) => {
      const bits = [
        t.dueDate ? `Due=${t.dueDate}` : null,
        `Status=${t.status || 'Unknown'}`,
        isAdmin && t.provider ? `Provider=${t.provider}` : null,
        t.assigneeNames ? `Assignee=${t.assigneeNames}` : null,
      ].filter(Boolean).join(', ');
      return `- ${t.title || '(untitled)'}: ${bits}`;
    });

  const chatScopeLine = isAdmin
    ? 'Chat: internal/admin (all Providers\' cases visible — name which Provider each case belongs to when not obvious)'
    : `Chat: Provider "${providerName}" only — only discuss this Provider's own cases, never another Provider's.`;

  const dynamicLines =
    `${chatScopeLine}\n\n` +
    `${isAdmin ? 'All Providers\' cases on file' : 'This Provider\'s cases on file'}:\n${caseLines.length ? caseLines.join('\n') : '(no cases on file yet)'}\n\n` +
    `Today's date: ${todayStr}\n\n` +
    `Shared Calendar events on file:\n${calendarLines.length ? calendarLines.join('\n') : '(none on file yet)'}\n\n` +
    `${isAdmin ? 'Team Task Management items on file' : 'This Provider\'s own Task Management items on file'} (Personal tasks excluded):\n${taskLines.length ? taskLines.join('\n') : '(none on file yet)'}\n\n` +
    `Group message: "${question}"`;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const cacheName = await getOrRefreshKbCache({ kbFaqLines, kbDocLines, model });

  const requestBody = cacheName
    ? {
        // Fast path: the standing instructions + KB FAQs/document summaries
        // already live in Google's cache under `cacheName` — only the
        // genuinely-per-question content is sent here.
        cachedContent: cacheName,
        contents: [{ parts: [{ text: dynamicLines }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: GROUP_QA_SCHEMA },
      }
    : {
        // Fallback: caching isn't usable right now (see getOrRefreshKbCache's
        // comments) — send everything inline exactly as before this feature
        // existed, so the bot keeps working regardless.
        systemInstruction: { parts: [{ text: STABLE_SYSTEM_INSTRUCTION }] },
        contents: [{
          parts: [{
            text:
              `${chatScopeLine}\n\n` +
              `${isAdmin ? 'All Providers\' cases on file' : 'This Provider\'s cases on file'}:\n${caseLines.length ? caseLines.join('\n') : '(no cases on file yet)'}\n\n` +
              `Company-approved Knowledge Base FAQ entries:\n${kbFaqLines.length ? kbFaqLines.join('\n') : '(none on file yet)'}\n\n` +
              `Company-approved Knowledge Base reference document summaries:\n${kbDocLines.length ? kbDocLines.join('\n') : '(none on file yet)'}\n\n` +
              `Today's date: ${todayStr}\n\n` +
              `Shared Calendar events on file:\n${calendarLines.length ? calendarLines.join('\n') : '(none on file yet)'}\n\n` +
              `${isAdmin ? 'Team Task Management items on file' : 'This Provider\'s own Task Management items on file'} (Personal tasks excluded):\n${taskLines.length ? taskLines.join('\n') : '(none on file yet)'}\n\n` +
              `Group message: "${question}"`,
          }],
        }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: GROUP_QA_SCHEMA },
      };
  return callGemini(requestBody);
}

module.exports = {
  extractFields, extractApprovalNotice, summarizeDocument, checkDocumentConsistency,
  answerGroupQuestion, MODULE_SCHEMAS, toGeminiResponseSchema,
  // Exported for the automated test suite only (test/ai.test.js) — these were
  // previously internal-only helpers. Purely additive (no behavior change);
  // lets the RTP range-check / value-comparison logic underneath
  // checkDocumentConsistency be unit-tested directly instead of only via a
  // full mocked Gemini call. Added 2026-08-25 at Tiffany's request, first
  // step toward automated test coverage for the compliance-critical logic.
  parseRtpPercent, valuesMatch, JACKPOT_TOTAL_RTP_MAX_PERCENT, RTP_MIN_PERCENT, RTP_MAX_PERCENT,
};
