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
 * even before anyone sets up AI — only the one "AI 幫我填" button should
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
    },
    required: ['title'],
  },
  contracts: {
    label: 'contract',
    properties: {
      title: { type: 'string', description: 'A short contract title, e.g. "Supply Agreement — Acme Corp".' },
      counterparty: { type: 'string', description: 'The other party\'s company/entity name.' },
      type: { type: 'string', enum: ['License', 'Supply', 'Services', 'Employment', 'NDA', 'Other'] },
      effectiveDate: { type: 'string', description: 'ISO date YYYY-MM-DD the contract takes/took effect, if mentioned. Omit if not mentioned.' },
      expiryDate: { type: 'string', description: 'ISO date YYYY-MM-DD the contract expires/terminates, if mentioned. Omit if not mentioned.' },
      status: { type: 'string', enum: ['Active', 'Expired', 'Terminated', 'Draft'] },
    },
    required: ['title'],
  },
  documents: {
    label: 'document being filed into the document center',
    properties: {
      title: { type: 'string', description: 'A short, descriptive title for this document.' },
      category: { type: 'string', enum: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'] },
      provider: { type: 'string', description: 'The overseas game Provider company this document is from/about (e.g. FC, JDB, VP), if identifiable from the content. Omit if not applicable/mentioned.' },
      gameTitle: { type: 'string', description: 'The specific game title this document relates to, if identifiable. Omit if not mentioned.' },
      reportType: { type: 'string', enum: ['Math Model Report', 'RNG Test Report', 'Game Rules / Paytable', 'PAGCOR Submission Letter', 'Letter of Approval (LOA)', 'Other'], description: 'What kind of PAGCOR-related report/document this is, if identifiable from the content or file name. Omit entirely if it does not look like one of these.' },
    },
    required: ['title'],
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
    throw new Error(`AI 服務連線失敗:${err.message}`);
  }
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch (e) { /* ignore */ }
    throw new Error(`AI 服務回應錯誤 (${response.status})${detail ? `:${detail}` : ''}`);
  }
  const data = await response.json();
  const text_ = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text_) {
    throw new Error('AI 沒有回傳可解析的結果,請再試一次。');
  }
  try {
    return JSON.parse(text_);
  } catch (err) {
    throw new Error('AI 回傳的內容無法解析,請再試一次。');
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
      'AI 判讀尚未設定 —— 需要先在環境變數加入 GEMINI_API_KEY(見 README 的 AI 功能設定說明，' +
      '可以在 https://aistudio.google.com/apikey 免費申請，不需要信用卡)。'
    );
  }
  if (!fileContentBase64 || !String(fileContentBase64).trim()) {
    throw new Error('請先上傳核准通知信的檔案(PDF 或圖片)。');
  }

  const parts = [
    {
      text:
        '這是一份 PAGCOR(菲律賓博彩監理機構)寄給營運商的正式「核准通知信」(Notice of Approval)，' +
        '可能是掃描圖檔，內容可能列出一或多款已核准的電子遊戲，也可能跨越多頁。' +
        '請仔細閱讀整份文件，擷取每一款被核准遊戲的：遊戲名稱(gameTitle)、Game ID/Table ID(gameId，' +
        '如果信中有列出的話)、以及遊戲廠商/Provider 名稱(provider，如果有提到的話)。' +
        '如果信中有提到核准日期或正式文號，也請一併擷取。只根據文件裡實際寫的內容擷取，' +
        '不要憑空捏造；看不清楚或沒提到的欄位請直接省略，不要用猜的。',
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
// AI document summary ("AI 幫我抓重點") — optional (see GEMINI_API_KEY check
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
      'AI 摘要尚未設定 —— 需要先在環境變數加入 GEMINI_API_KEY(見 README 的 AI 功能設定說明，' +
      '可以在 https://aistudio.google.com/apikey 免費申請，不需要信用卡)。'
    );
  }
  const hasText = text && String(text).trim().length > 0;
  const hasFile = fileContentBase64 && String(fileContentBase64).trim().length > 0;
  if (!hasText && !hasFile) {
    throw new Error('這份文件沒有可讀取的內容，無法產生 AI 摘要。');
  }

  const parts = [{
    text:
      '請閱讀以下文件內容，用繁體中文寫一段簡短的白話摘要（2-4 句話，讓完全沒讀過原文的人也能看懂這份文件在講什麼），' +
      '再列出 3-8 個從文件裡擷取出來的重點事實（例如當事人、日期、金額、遊戲名稱、測試結果或結論、需要注意的條款，' +
      '依文件實際內容而定，不要每種都硬湊）。只根據文件裡實際寫的內容整理，不要憑空補充、推測或評論文件沒提到的資訊 —— ' +
      '這只是幫忙抓重點省閱讀時間，不是在審查或判斷這份文件有沒有問題。',
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
function toGeminiResponseSchema({ properties, required }) {
  const converted = {};
  for (const [key, def] of Object.entries(properties)) {
    const prop = { type: String(def.type || 'string').toUpperCase() };
    if (def.description) prop.description = def.description;
    if (def.enum) prop.enum = def.enum;
    converted[key] = prop;
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

// Builds the Gemini content part for an uploaded file, or throws a friendly
// error for file types Gemini can't take directly (e.g. .docx/.xlsx) —
// those users should paste the text instead.
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
  throw new Error(
    `AI 智慧填寫目前只支援 PDF、圖片(PNG/JPG/GIF/WEBP)或純文字檔 —— 這個檔案是 "${mimeType}"。` +
    ' 請改成貼上文字內容,或轉存成 PDF 後再試一次。'
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
      'AI 智慧填寫尚未設定 —— 需要先在環境變數加入 GEMINI_API_KEY(見 README 的 AI 功能設定說明，' +
      '可以在 https://aistudio.google.com/apikey 免費申請，不需要信用卡),' +
      '在那之前這個系統的其他功能完全不受影響,只有這個按鈕暫時無法使用。'
    );
  }
  const schema = schemaFor(module);

  const hasText = text && String(text).trim().length > 0;
  const hasFile = fileContentBase64 && String(fileContentBase64).trim().length > 0;
  if (!hasText && !hasFile) {
    throw new Error('請先貼上一段文字,或上傳一個檔案,再按「AI 幫我填」。');
  }

  const parts = [{
    text:
      `以下是使用者提供的、跟一筆「${schema.label}」有關的資料(可能是貼上的文字,和/或一個附加檔案)。` +
      ' 請只根據這份資料本身擷取欄位,不要憑空捏造或補充資料中沒提到的內容;' +
      ' 不確定的欄位請直接省略,不要亂猜。所有日期一律使用 YYYY-MM-DD 格式。',
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
    throw new Error(`AI 服務連線失敗:${err.message}`);
  }

  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch (e) { /* ignore */ }
    throw new Error(`AI 服務回應錯誤 (${response.status})${detail ? `:${detail}` : ''}`);
  }

  const data = await response.json();
  const text_ = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';
  if (!text_) {
    throw new Error('AI 沒有回傳可解析的結果,請再試一次,或改用貼上文字的方式。');
  }
  try {
    return JSON.parse(text_);
  } catch (err) {
    throw new Error('AI 回傳的內容無法解析,請再試一次。');
  }
}

module.exports = { extractFields, extractApprovalNotice, summarizeDocument, MODULE_SCHEMAS, toGeminiResponseSchema };
