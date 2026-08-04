'use strict';
/**
 * "AI Assistant" — a chat entry point where a user can type a plain-language
 * request ("幫我建立一個日本客戶的 NDA", "幫我找去年所有菲律賓客戶的授權合約")
 * and have Gemini either answer directly (for read-only lookups — it calls
 * search_* tools, which THIS SERVER executes immediately against the real
 * data and feeds back to Gemini to summarize) or propose a concrete action
 * (create_case / create_contract / create_task) that the user must
 * explicitly confirm before anything is actually written to the database.
 *
 * Uses Google's Gemini API (same as server/ai.js) specifically because it
 * has a genuinely free tier — see README's "AI smart-fill" section.
 *
 * Design principle: read-only tool calls execute automatically (no side
 * effects, nothing to confirm); anything that WRITES data always comes back
 * to the frontend as a `pendingAction` first — the user sees exactly what
 * would be created and must click "確認執行" before executeAction() below
 * ever runs. This mirrors the same "propose, then human confirms" pattern
 * used for other side-effectful actions, since an internal legal system is
 * exactly the kind of place a wrong auto-created record is a real nuisance
 * to clean up.
 *
 * Every action — read or write — is still checked against the current
 * user's own role permissions (via auth.can), the same permission model the
 * rest of the app already uses. The assistant is a shortcut for using the
 * app, never a way around its permission model.
 */
const store = require('./store');
const auth = require('./auth');

// Kept in sync with server/ai.js's default — see that file's comment for
// why this specific model, and how to change it via GEMINI_MODEL.
const DEFAULT_MODEL = 'gemini-3.6-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_TOOL_ROUNDS = 4; // safety cap against runaway tool-call loops

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const READ_TOOLS = {
  search_cases: {
    module: 'cases',
    description: 'Search existing legal cases by any criteria (title, type, status, priority, owner, date range, keywords in the description). Returns matching cases.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'What to search for, in plain language.' } }, required: ['query'] },
  },
  search_contracts: {
    module: 'contracts',
    description: 'Search existing contracts by any criteria (title, counterparty, type, status, date range, keywords). Returns matching contracts.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'What to search for, in plain language.' } }, required: ['query'] },
  },
  search_documents: {
    module: 'documents',
    description: 'Search the document center by title, category, or keywords.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'What to search for, in plain language.' } }, required: ['query'] },
  },
};

const WRITE_TOOLS = {
  create_case: {
    module: 'cases',
    description: 'Create a new legal case/matter. Use this when the user asks to open/create/file a case.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string', enum: ['Regulatory', 'Commercial', 'IP', 'Litigation', 'Employment', 'Other'] },
        priority: { type: 'string', enum: ['High', 'Medium', 'Low'] },
        deadline: { type: 'string', description: 'ISO date YYYY-MM-DD, omit if not mentioned.' },
        description: { type: 'string' },
        ownerUsername: { type: 'string', description: 'Username of the person to own this case, if mentioned. Must be one of the usernames listed in the team roster below. Omit if not mentioned — defaults to the requesting user.' },
      },
      required: ['title', 'type'],
    },
  },
  create_contract: {
    module: 'contracts',
    description: 'Create a new contract record. Use this when the user asks to draft/create/set up a contract, NDA, agreement, etc. Note: this creates the CONTRACT RECORD (metadata) in the system — it does not generate an actual signed document file.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        counterparty: { type: 'string', description: 'The other party\'s name.' },
        type: { type: 'string', enum: ['License', 'Supply', 'Services', 'Employment', 'NDA', 'Other'] },
        effectiveDate: { type: 'string', description: 'ISO date YYYY-MM-DD, omit if not mentioned.' },
        expiryDate: { type: 'string', description: 'ISO date YYYY-MM-DD, omit if not mentioned.' },
        ownerUsername: { type: 'string', description: 'Username of the person to own this contract, if mentioned. Must be one of the usernames listed in the team roster below. Omit if not mentioned.' },
      },
      required: ['title', 'counterparty', 'type'],
    },
  },
  create_task: {
    module: 'tasks',
    description: 'Create a to-do task, optionally linked to an existing case.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        assigneeUsername: { type: 'string', description: 'Username to assign this to. Must be one of the usernames listed in the team roster below. Omit if not mentioned — defaults to the requesting user.' },
        dueDate: { type: 'string', description: 'ISO date YYYY-MM-DD, omit if not mentioned.' },
        relatedCaseNumber: { type: 'string', description: 'An existing case number (e.g. CASE-0004) this task relates to, if mentioned. Must be one of the case numbers listed below.' },
      },
      required: ['title'],
    },
  },
};

// Gemini's functionDeclarations.parameters uses the same lowercase
// JSON-Schema-style types as our own input_schema definitions above (unlike
// its responseSchema feature used in server/ai.js, which is uppercase — see
// that file's comment), so no case conversion is needed here.
function functionDeclarations() {
  const all = { ...READ_TOOLS, ...WRITE_TOOLS };
  return Object.entries(all).map(([name, def]) => ({
    name, description: def.description, parameters: def.input_schema,
  }));
}

// ---------------------------------------------------------------------------
// Compact data snapshots (kept small — full records would waste tokens)
// ---------------------------------------------------------------------------
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '…' : s; }

async function buildRoster() {
  const users = await store.all('users');
  return users
    .filter((u) => u.status === 'active')
    .map((u) => `${u.username} (${u.fullName})`)
    .join(', ');
}

async function buildCaseDirectory() {
  const cases = await store.all('cases');
  return cases.map((c) => `${c.caseNumber} - ${c.title}`).join(', ');
}

async function compactCases(query) {
  const [cases, users] = await Promise.all([store.all('cases'), store.all('users')]);
  const nameOf = (id) => (users.find((u) => u.id === id) || {}).fullName || null;
  return cases.map((c) => ({
    id: c.id, caseNumber: c.caseNumber, title: c.title, type: c.type,
    status: c.status, priority: c.priority, deadline: c.deadline || null,
    owner: nameOf(c.ownerId), description: truncate(c.description || '', 300),
  }));
}

async function compactContracts() {
  const [contracts, users] = await Promise.all([store.all('contracts'), store.all('users')]);
  const nameOf = (id) => (users.find((u) => u.id === id) || {}).fullName || null;
  return contracts.map((c) => ({
    id: c.id, contractNumber: c.contractNumber, title: c.title, counterparty: c.counterparty,
    type: c.type, status: c.status, effectiveDate: c.effectiveDate || null,
    expiryDate: c.expiryDate || null, owner: nameOf(c.ownerId),
  }));
}

async function compactDocuments() {
  const docs = await store.all('documents');
  return docs.map((d) => ({ id: d.id, title: d.title, category: d.category, fileName: d.fileName || null, createdAt: d.createdAt }));
}

// ---------------------------------------------------------------------------
// Name/number -> id resolution for write-tool inputs
// ---------------------------------------------------------------------------
async function resolveUserId(username, fallbackUserId) {
  if (!username) return { id: fallbackUserId, resolvedFrom: 'default' };
  const users = await store.all('users');
  const match = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  return match ? { id: match.id, resolvedFrom: 'match' } : { id: fallbackUserId, resolvedFrom: 'not-found', requested: username };
}

async function resolveCaseId(caseNumber) {
  if (!caseNumber) return null;
  const cases = await store.all('cases');
  const match = cases.find((c) => c.caseNumber.toLowerCase() === String(caseNumber).toLowerCase());
  return match ? match.id : null;
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------
async function callGemini(contents, systemText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'AI Assistant 尚未設定 —— 需要先在環境變數加入 GEMINI_API_KEY(見 README，' +
      '可以在 https://aistudio.google.com/apikey 免費申請，不需要信用卡)，' +
      '在那之前系統其他功能完全不受影響。'
    );
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      tools: [{ functionDeclarations: functionDeclarations() }],
    }),
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json())?.error?.message || ''; } catch (e) { /* ignore */ }
    throw new Error(`AI 服務回應錯誤 (${response.status})${detail ? `:${detail}` : ''}`);
  }
  return response.json();
}

function partsFrom(data) {
  return data?.candidates?.[0]?.content?.parts || [];
}
function textFrom(parts) {
  return (parts || []).map((p) => p.text).filter(Boolean).join('\n').trim();
}

// ---------------------------------------------------------------------------
// Human-readable summaries for pending (unconfirmed) write actions
// ---------------------------------------------------------------------------
function summarize(type, resolvedInput, notes) {
  const noteSuffix = notes.length ? `（${notes.join('；')}）` : '';
  if (type === 'create_case') {
    return `建立案件:「${resolvedInput.title}」— 類型 ${resolvedInput.type}，優先度 ${resolvedInput.priority || 'Medium'}` +
      `${resolvedInput.deadline ? `，期限 ${resolvedInput.deadline}` : ''}${noteSuffix}`;
  }
  if (type === 'create_contract') {
    return `建立合約:「${resolvedInput.title}」— 對象 ${resolvedInput.counterparty}，類型 ${resolvedInput.type}${noteSuffix}`;
  }
  if (type === 'create_task') {
    return `建立待辦:「${resolvedInput.title}」${resolvedInput.dueDate ? `，到期 ${resolvedInput.dueDate}` : ''}${noteSuffix}`;
  }
  return `執行 ${type}`;
}

// ---------------------------------------------------------------------------
// Main entry: one user message -> either a text reply, or a text reply +
// pending write action(s) awaiting confirmation.
// ---------------------------------------------------------------------------
// `history` is a plain array of completed turns as {role: 'user'|'assistant', text}
// — deliberately NOT Gemini's raw content parts with functionCall/functionResponse
// details. Gemini's API expects every functionCall to be immediately followed by
// a matching functionResponse, which gets awkward across turns once a write action
// is left pending (unconfirmed) — so instead, each call rebuilds a fresh internal
// tool loop from plain text history, and re-runs any needed search_* tools itself.
// That costs a little redundant searching on multi-turn follow-ups, but keeps the
// whole thing simple and always valid, and searches are cheap/read-only anyway.
async function runTurn({ history = [], text, user }) {
  const [roster, caseDirectory] = await Promise.all([buildRoster(), buildCaseDirectory()]);
  const system =
    'You are the AI Assistant embedded in "Legal Genie", an internal legal department system for a gaming machine manufacturer. ' +
    'You help the legal team look things up and create records via natural language, in whichever language the user writes in (respond in the same language they used). ' +
    'Use the search_* tools for any lookup/find/list request — never guess data, always look it up. ' +
    'Use the create_* tools when the user clearly wants to create/open/file/draft something. If a required detail is genuinely ambiguous or missing (e.g. no case type given), ask a brief clarifying question in plain text instead of guessing. ' +
    `Team roster (username (full name)): ${roster || '(none yet)'}. ` +
    `Existing case numbers: ${caseDirectory || '(none yet)'}. ` +
    `The user making this request is ${user.username} (${user.fullName}).`;

  // Gemini calls the AI's own turns role "model", not "assistant".
  const contents = [
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text }] },
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = await callGemini(contents, system);
    const parts = partsFrom(data);
    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      // Plain reply, no tool calls — conversation turn is done.
      return { reply: textFrom(parts) || '（沒有內容）', pendingActions: [] };
    }

    const writeCall = functionCalls.find((p) => WRITE_TOOLS[p.functionCall.name]);
    if (writeCall) {
      // Stop here — resolve names to IDs and hand back to the user for
      // confirmation rather than executing. Any preceding text in this same
      // reply is shown too.
      const resolved = await resolvePendingAction(
        { name: writeCall.functionCall.name, input: writeCall.functionCall.args || {} },
        user
      );
      return { reply: textFrom(parts), pendingActions: [resolved] };
    }

    // All tool calls this round are read-only search_* calls — execute them
    // now and feed results back to Gemini for the next round.
    contents.push({ role: 'model', parts });
    const functionResponseParts = [];
    for (const call of functionCalls) {
      const name = call.functionCall.name;
      const def = READ_TOOLS[name];
      const allowed = def && (await auth.can(user, def.module, 'view'));
      let resultPayload;
      if (!def) {
        resultPayload = { error: `Unknown tool ${name}` };
      } else if (!allowed) {
        resultPayload = { error: `You do not have view permission on ${def.module}.` };
      } else if (name === 'search_cases') {
        resultPayload = await compactCases();
      } else if (name === 'search_contracts') {
        resultPayload = await compactContracts();
      } else if (name === 'search_documents') {
        resultPayload = await compactDocuments();
      } else {
        resultPayload = { error: `Unknown tool ${name}` };
      }
      functionResponseParts.push({ functionResponse: { name, response: { result: resultPayload } } });
    }
    contents.push({ role: 'user', parts: functionResponseParts });
  }

  return { reply: '這個請求需要的步驟有點多，可以請你拆成比較小的問題再試一次嗎？', pendingActions: [] };
}

async function resolvePendingAction(call, user) {
  const input = call.input || {};
  const notes = [];

  if (call.name === 'create_case') {
    const owner = await resolveUserId(input.ownerUsername, user.id);
    if (owner.resolvedFrom === 'not-found') notes.push(`找不到使用者「${owner.requested}」，已預設指派給你`);
    const resolvedInput = {
      title: input.title, type: input.type, priority: input.priority || 'Medium',
      status: 'Open', deadline: input.deadline || null, description: input.description || '',
      ownerId: owner.id,
    };
    return { type: 'create_case', input: resolvedInput, summary: summarize('create_case', resolvedInput, notes) };
  }

  if (call.name === 'create_contract') {
    const owner = await resolveUserId(input.ownerUsername, user.id);
    if (owner.resolvedFrom === 'not-found') notes.push(`找不到使用者「${owner.requested}」，已預設指派給你`);
    const resolvedInput = {
      title: input.title, counterparty: input.counterparty, type: input.type,
      effectiveDate: input.effectiveDate || null, expiryDate: input.expiryDate || null,
      status: 'Draft', ownerId: owner.id,
    };
    return { type: 'create_contract', input: resolvedInput, summary: summarize('create_contract', resolvedInput, notes) };
  }

  if (call.name === 'create_task') {
    const assignee = await resolveUserId(input.assigneeUsername, user.id);
    if (assignee.resolvedFrom === 'not-found') notes.push(`找不到使用者「${assignee.requested}」，已預設指派給你`);
    let relatedCaseId = null;
    if (input.relatedCaseNumber) {
      relatedCaseId = await resolveCaseId(input.relatedCaseNumber);
      if (!relatedCaseId) notes.push(`找不到案件「${input.relatedCaseNumber}」，將不連結案件`);
    }
    const resolvedInput = {
      title: input.title, description: input.description || '', assigneeId: assignee.id,
      type: 'team', status: 'Not Started', dueDate: input.dueDate || null, relatedCaseId,
    };
    return { type: 'create_task', input: resolvedInput, summary: summarize('create_task', resolvedInput, notes) };
  }

  throw new Error(`Unknown write tool ${call.name}`);
}

// ---------------------------------------------------------------------------
// Executing a confirmed action — mirrors the onCreate logic in routes.js's
// crudRoutes() factory for each module, so assistant-created records are
// indistinguishable from ones created through the normal forms (same
// sequential numbering, same notification behavior where applicable).
// ---------------------------------------------------------------------------
async function executeAction({ type, input }, user) {
  if (type === 'create_case') {
    if (!(await auth.can(user, 'cases', 'create'))) throw new Error('You do not have create permission on cases.');
    const caseNumber = await store.nextNumber('case', 'CASE');
    return store.insert('cases', { ...input, caseNumber });
  }
  if (type === 'create_contract') {
    if (!(await auth.can(user, 'contracts', 'create'))) throw new Error('You do not have create permission on contracts.');
    const contractNumber = await store.nextNumber('contract', 'CTR');
    return store.insert('contracts', { ...input, contractNumber });
  }
  if (type === 'create_task') {
    if (!(await auth.can(user, 'tasks', 'create'))) throw new Error('You do not have create permission on tasks.');
    return store.insert('tasks', { ...input, createdBy: user.id });
  }
  throw new Error(`Unknown action type "${type}"`);
}

module.exports = { runTurn, executeAction };
