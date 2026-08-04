'use strict';
/**
 * Optional "AI smart-fill" helper — lets a user paste free text (an email,
 * a case summary, a contract excerpt, a regulation notice...) or upload a
 * file (PDF or image), and have Gemini extract the relevant fields for a
 * given module (cases / contracts / compliance / documents) so the form
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
  compliance: {
    label: 'regulatory compliance requirement',
    properties: {
      country: { type: 'string', description: 'Country or jurisdiction the requirement applies to.' },
      regulation: { type: 'string', description: 'Name/citation of the regulation, law, or licensing body requirement.' },
      requirement: { type: 'string', description: 'A clear description of what must be done to comply.' },
      dueDate: { type: 'string', description: 'ISO date YYYY-MM-DD if a compliance deadline is mentioned. Omit if not mentioned.' },
      status: { type: 'string', enum: ['Compliant', 'Due Soon', 'Overdue'] },
    },
    required: ['requirement'],
  },
  documents: {
    label: 'document being filed into the document center',
    properties: {
      title: { type: 'string', description: 'A short, descriptive title for this document.' },
      category: { type: 'string', enum: ['Templates', 'Policies', 'Agreements', 'Certificates', 'Other'] },
    },
    required: ['title'],
  },
};

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

module.exports = { extractFields, MODULE_SCHEMAS, toGeminiResponseSchema };
