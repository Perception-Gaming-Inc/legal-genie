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

async function callGemini(requestBody) {
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
const REQUIRED_DOCUMENT_TYPES = ['EG Form', 'Game Parameters', 'Game Manual', 'RNG Certification', 'RTP Verification', 'Content Provider Certification'];
const CHECKED_PARAMETERS = ['Game ID', 'Game Version', 'Minimum Bet', 'Maximum Bet', 'RTP'];

const SUBMISSION_VALIDATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentCompleteness: {
      type: 'ARRAY',
      description: `Exactly ${REQUIRED_DOCUMENT_TYPES.length} entries, one for each of: ${REQUIRED_DOCUMENT_TYPES.join(', ')} — always all of them, in that order, even when a type is not present at all (present: false in that case rather than omitting it).`,
      items: {
        type: 'OBJECT',
        properties: {
          documentType: { type: 'STRING', enum: REQUIRED_DOCUMENT_TYPES },
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
            enum: ['match', 'mismatch', 'missing'],
            description: '"match" = every document that mentions this parameter states the same value; "mismatch" = two or more documents state different values for it; "missing" = no document mentions it at all.',
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
 * @param {{caseTitle?: string, gameTitle?: string, gameId?: string, documents: Array<{fileName?: string, fileContentBase64: string}>}} input
 * @returns {Promise<{
 *   overallStatus: 'ready'|'not_ready',
 *   documentCompleteness: Array<{documentType: string, present: boolean, detail: string}>,
 *   parameterValidation: Array<{parameter: string, present: boolean, detail: string}>,
 *   documentConsistency: Array<{parameter: string, status: 'match'|'mismatch'|'missing', values: Array<{source: string, value: string}>, detail: string}>,
 *   summary: string,
 * }>}
 */
async function checkDocumentConsistency({ caseTitle, gameTitle, gameId, documents }) {
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

  const parts = [{
    text:
      `The following are ${docs.length} documents related to the same PAGCOR game-submission case${context ? ` (${context})` : ''}. ` +
      'Perform a pre-submission check, broken into three parts — report all three in full, do not omit any of them: ' +
      `1) Document completeness: check whether each of these ${REQUIRED_DOCUMENT_TYPES.length} required submission document types is present — ${REQUIRED_DOCUMENT_TYPES.join(', ')}. ` +
      'If any one document clearly belongs to a type, count it as present; mark it not present if no matching document is found (judge the type from the document\'s actual content, not just its file name). ' +
      `2) Parameter completeness: check whether each of these ${CHECKED_PARAMETERS.length} parameters has a value stated in "at least one document" — ${CHECKED_PARAMETERS.join(', ')}. ` +
      'This only judges whether a value exists, not whether it is consistent. ' +
      '3) Document consistency: for these same parameters, list every document that explicitly states a value for it along with that value, ' +
      'then judge whether those values agree: mark "match" if they all agree, "mismatch" if two or more documents state different values, "missing" if no document mentions it at all. ' +
      'Only compare whether the values agree with each other — do not judge which value is "correct" or "compliant", and never invent a value that is not actually written in a document.',
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
          'completeness, parameter completeness, and cross-document parameter consistency exactly as requested, ' +
          'reporting every requested item even when the answer is "not present" or "missing" rather than omitting ' +
          'it. This tool focuses purely on pre-submission validation — never judge whether a value is legally ' +
          'correct, compliant, or PAGCOR-acceptable, only whether required documents/values are present and ' +
          'whether documents agree with each other. Never invent a value or a document that is not actually there.',
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
  const documentConsistency = Array.isArray(result.documentConsistency) ? result.documentConsistency : [];
  // overallStatus is derived here (not trusted from the model) so the
  // "Ready for Submission" banner always follows the same fixed rule: every
  // required document type must be present, every tracked parameter must
  // have a value somewhere, and no parameter may disagree across documents.
  // Each array gets its own `.length > 0` guard, not just documentCompleteness
  // — Array.prototype.every() vacuously returns true on an empty array, so
  // without this, a malformed/truncated Gemini response that comes back
  // with an empty parameterValidation or documentConsistency (schema
  // non-compliance, an API hiccup, etc.) would silently report "ready" for
  // a real PAGCOR filing without ever actually validating those sections.
  const overallStatus = (
    documentCompleteness.length > 0
    && documentCompleteness.every((d) => d.present)
    && parameterValidation.length > 0
    && parameterValidation.every((p) => p.present)
    && documentConsistency.length > 0
    && documentConsistency.every((c) => c.status === 'match')
  ) ? 'ready' : 'not_ready';

  return {
    overallStatus,
    documentCompleteness,
    parameterValidation,
    documentConsistency,
    summary: typeof result.summary === 'string' ? result.summary : '',
  };
}

// ---------------------------------------------------------------------------
// AI-assisted Case intake from multiple documents at once — the "when a new
// case comes in, import all its documents at once and have AI organize them
// into a Case" workflow. Unlike extractFields()
// below (one file/text -> one module's fields), this always takes several
// files together (the whole bundle a Provider sends for one submission).
//
// IMPORTANT, learned from real-world testing: a single PAGCOR submission
// bundle very often covers MULTIPLE games at once — e.g. one Notice of
// Approval letter with an "Annex A" table listing 3 separate games under
// one Provider (this is completely normal PAGCOR practice, not an edge
// case). An earlier version of this function proposed a single flat Case
// object with one `gameTitle` field, which meant Gemini had no correct
// single value to put there when 3 different games were named — it
// (correctly, per its own instructions not to guess) left gameTitle
// blank, which looked to the user like "the AI failed to fill in the most
// important field" rather than "there wasn't one right answer to give."
// The fix: split the response into `common` (fields that really are
// shared across every game in the bundle — Type/Priority/Status/
// Deadline/Description/Provider) and `games` (an array, ALWAYS an array
// even when there's only one game, with each game's own title/gameTitle/
// gameId/gameType/gameVersion/withJackpot as a separate entry). The
// frontend (public/js/app.js's showCaseIntakeWizard) creates one Case per
// entry in `games`, reusing the same uploaded documents for all of
// them — same "user reviews everything before it's saved" rule as every
// other AI feature here; this only ever proposes, server/routes.js's
// /api/cases/extract-from-documents never creates anything itself.
// ---------------------------------------------------------------------------
const CASE_INTAKE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    common: {
      type: 'OBJECT',
      description: 'Fields that genuinely apply the same way to every game in `games` below (e.g. they were all submitted/approved together, under the same Provider). Omit any that don\'t clearly apply to all of them.',
      properties: {
        type: { type: 'STRING', enum: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'] },
        priority: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
        status: { type: 'STRING', enum: ['Open', 'In Progress', 'Closed'] },
        deadline: { type: 'STRING', description: 'ISO date YYYY-MM-DD if a specific deadline/due date is mentioned that applies to all games here. Omit if none/not applicable.' },
        description: { type: 'STRING', description: 'A clear 2-4 sentence summary of this submission, written for a legal case record. Mention that it covers multiple games if `games` has more than one entry.' },
        provider: { type: 'STRING', description: 'The overseas game Provider company these games belong to (e.g. FC, JDB, VP), if this is a PAGCOR game-submission bundle. Omit entirely if not applicable/mentioned.' },
      },
    },
    games: {
      type: 'ARRAY',
      description:
        'Every distinct game these documents describe, each as its own separate entry — ALWAYS an array, even when there is only 1 game. ' +
        'A single PAGCOR notice or submission bundle can legitimately cover several games at once (e.g. an approval letter with an ' +
        '"Annex A"-style table listing multiple games under one Provider) — when that happens, list every one of them here as separate ' +
        'entries. NEVER merge multiple distinct games into one entry, and never pick just one to represent the rest.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'A short, concrete case title for this specific game (not a full sentence), e.g. "PAGCOR game submission - Fortune Dragon".' },
          gameTitle: { type: 'STRING', description: 'This game\'s title, exactly as written in the documents.' },
          gameId: { type: 'STRING', description: 'This game\'s Game ID / Table ID, if stated anywhere. Omit if not stated.' },
          gameType: { type: 'STRING', enum: ['Slots', 'Arcade-Type', 'Table', 'eBingo', 'Other'], description: 'This game\'s type/category, if identifiable. Omit if not identifiable.' },
          gameVersion: { type: 'STRING', description: 'This game\'s version/manual version number, if stated. Omit if not stated.' },
          withJackpot: { type: 'STRING', enum: ['Yes', 'No'], description: 'Whether this specific game has a jackpot feature, only if explicitly stated. Omit entirely if not mentioned.' },
        },
        required: ['gameTitle'],
      },
    },
  },
  required: ['games'],
};

/**
 * @param {{documents: Array<{fileName?: string, fileContentBase64: string}>}} input
 * @returns {Promise<{common: object, games: Array<{title?: string, gameTitle: string, gameId?: string, gameType?: string, gameVersion?: string, withJackpot?: string}>}>}
 */
async function extractCaseFromDocuments({ documents }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'The AI case-intake wizard is not set up yet — add GEMINI_API_KEY to your environment variables first ' +
      '(see the README\'s AI setup section; you can get a free key at https://aistudio.google.com/apikey, ' +
      'no credit card required).'
    );
  }
  const docs = (Array.isArray(documents) ? documents : []).filter((d) => d && d.fileContentBase64 && String(d.fileContentBase64).trim());
  if (!docs.length) {
    throw new Error('Please upload at least one document so the AI can help organize the case data.');
  }

  const parts = [{
    text:
      `The following are ${docs.length} PAGCOR submission-related documents (may include RNG reports, Game ` +
      'Manuals, approval notices, etc). Read through these documents and organize the case data that should be ' +
      'created. Note: a single document (especially an approval notice) often covers MULTIPLE different games at ' +
      'once (e.g. an attached table listing 2-3 different games) — in that case, list each game as its own ' +
      'separate entry in the `games` array; do not merge them into one entry, and do not pick just one to ' +
      'represent the rest. As for Type, Priority, Status, Deadline, Description, Provider — if these genuinely ' +
      'apply to the whole batch of games, put them in `common`; when documents disagree on the same field, use ' +
      'whichever version looks the most complete/authoritative; omit any field the documents never mention rather ' +
      'than guessing.',
  }];
  docs.forEach((d, i) => {
    parts.push({ text: `[Document ${i + 1}: ${d.fileName || `Document ${i + 1}`}]` });
    parts.push(filePart(d.fileName, d.fileContentBase64));
  });

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a document-extraction assistant embedded in an internal legal department system for a ' +
          'gaming company. Given several documents that together describe one PAGCOR submission bundle, extract ' +
          'the Case fields to propose. Pay close attention to whether the documents describe ONE game or SEVERAL ' +
          '— a single approval notice commonly covers multiple games via a table/annex, and each one must become ' +
          'its own separate entry in `games`, never merged or reduced to just one. Only extract facts explicitly ' +
          'present in the documents — never invent information. The user will review and can edit every field ' +
          'before anything is saved, so it is fine (and preferred) to omit a field rather than guess at it.',
      }],
    },
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: CASE_INTAKE_SCHEMA,
    },
  };

  const result = await callGemini(requestBody);
  return { common: {}, games: [], ...result };
}

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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
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
    throw new Error(`AI service error (${response.status})${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json();
  const text_ = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text_) {
    throw new Error('The AI did not return a parseable result. Please try again, or paste the text instead.');
  }
  try {
    return JSON.parse(text_);
  } catch (err) {
    throw new Error('The AI\'s response could not be parsed. Please try again.');
  }
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
const GROUP_QA_SCHEMA = {
  type: 'OBJECT',
  properties: {
    shouldRespond: {
      type: 'BOOLEAN',
      description: 'true ONLY if this message is clearly a question directed at the assistant about this Provider\'s case(s) in the system — status, PAGCOR stage, required documents, submit/approval dates, rejection reasons, etc. false for greetings, small talk, messages clearly directed at another person, or anything not answerable from the case data given. When genuinely unsure, prefer false.',
    },
    answer: {
      type: 'STRING',
      description: 'A short, direct, friendly reply, in the same language the question was asked in, based ONLY on the case data provided below — never invent a stage, date, or document status not present in that data. Empty string when shouldRespond is false.',
    },
  },
  required: ['shouldRespond', 'answer'],
};

/**
 * @param {{providerName: string, question: string, cases: Array<object>}} input
 * @returns {Promise<{shouldRespond: boolean, answer: string}>}
 */
async function answerGroupQuestion({ providerName, question, cases }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');
  if (!question || !String(question).trim()) throw new Error('No message text to answer.');

  const caseLines = (Array.isArray(cases) ? cases : []).map((c) => {
    const bits = [
      `Stage=${c.pagcorStage || c.status || 'Unknown'}`,
      `Submit Date=${c.deadline || 'N/A'}`,
      c.gameId ? `Game ID=${c.gameId}` : null,
      c.withJackpot ? `With Jackpot=${c.withJackpot}` : null,
      c.pagcorStage === 'Rejected' && c.rejectionReason ? `Rejection Reason=${c.rejectionReason}` : null,
    ].filter(Boolean).join(', ');
    return `- ${c.gameTitle || c.title}${c.caseNumber ? ` (Case ${c.caseNumber})` : ''}: ${bits}`;
  });

  const requestBody = {
    systemInstruction: {
      parts: [{
        text:
          'You are a helpful assistant embedded in a Telegram group chat between a legal/regulatory team and one of ' +
          'their game Providers, for tracking PAGCOR game submissions. You are shown ONE message from the group and ' +
          'a list of this Provider\'s current cases from the internal tracking system. First decide whether the ' +
          'message is genuinely a question directed at you about these cases (status, stage, required documents, ' +
          'dates, rejection reasons) — if it looks like ordinary conversation between people, a greeting, or ' +
          'something you cannot answer from the case data given, set shouldRespond to false and leave answer empty. ' +
          'Never guess or invent information not present in the case data. Keep answers short and friendly.',
      }],
    },
    contents: [{
      parts: [{
        text:
          `Provider: ${providerName}\n\n` +
          `This Provider's cases on file:\n${caseLines.length ? caseLines.join('\n') : '(no cases on file for this Provider yet)'}\n\n` +
          `Group message: "${question}"`,
      }],
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: GROUP_QA_SCHEMA },
  };
  return callGemini(requestBody);
}

module.exports = { extractFields, extractApprovalNotice, summarizeDocument, checkDocumentConsistency, extractCaseFromDocuments, answerGroupQuestion, MODULE_SCHEMAS, toGeminiResponseSchema };
