'use strict';
/**
 * Automated tests — AI Submission Validation compliance logic
 * (server/ai.js). Covers the two rule types Tiffany asked about specifically:
 *   1. parseRtpPercent / valuesMatch — the low-level parsing/comparison
 *      helpers every parameter check is built on.
 *   2. checkDocumentConsistency's RTP band check AND the newer Jackpot
 *      combined-RTP rule (base + jackpot must stay under 97%) — tested
 *      end-to-end with global.fetch mocked to stand in for the real Gemini
 *      API call, so no network access or GEMINI_API_KEY is needed to run
 *      these tests.
 *
 * Run with: node --test test/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseRtpPercent, valuesMatch, checkDocumentConsistency,
  RTP_MIN_PERCENT, RTP_MAX_PERCENT, JACKPOT_TOTAL_RTP_MAX_PERCENT,
} = require('../server/ai.js');

// ---------------------------------------------------------------------------
// parseRtpPercent
// ---------------------------------------------------------------------------
test('parseRtpPercent: bare percentage text passes through unchanged', () => {
  assert.equal(parseRtpPercent('94.45%'), 94.45);
});

test('parseRtpPercent: extracts the number from surrounding text', () => {
  assert.equal(parseRtpPercent('94.45% (Compliant)'), 94.45);
  assert.equal(parseRtpPercent('Total RTP: 94.45'), 94.45);
});

test('parseRtpPercent: a raw Excel-style fraction (<=1, no "%" in the text) is scaled to a percentage', () => {
  assert.equal(parseRtpPercent('0.9445'), 94.45);
});

test('parseRtpPercent: a literal "0%" still registers as a real (zero) value, not "no value"', () => {
  assert.equal(parseRtpPercent('0%'), 0);
});

test('parseRtpPercent: returns null when there is no number at all', () => {
  assert.equal(parseRtpPercent('Not stated'), null);
  assert.equal(parseRtpPercent(null), null);
  assert.equal(parseRtpPercent(undefined), null);
});

// ---------------------------------------------------------------------------
// valuesMatch
// ---------------------------------------------------------------------------
test('valuesMatch: numeric Minimum/Maximum Bet compares numerically, ignoring trailing zeros', () => {
  assert.equal(valuesMatch(0.5, '0.50', true), true);
});

test('valuesMatch: currency-labeled bet amounts still compare correctly', () => {
  assert.equal(valuesMatch(1000, '₱1,000.00', true), true);
});

test('valuesMatch: Game ID / Game Version compares case-insensitively as text', () => {
  assert.equal(valuesMatch('VP_230039_1', 'vp_230039_1', false), true);
  assert.equal(valuesMatch('v1.10', 'v1.1', false), false);
});

test('valuesMatch: returns false when either side is null/undefined', () => {
  assert.equal(valuesMatch(null, '0.5', true), false);
  assert.equal(valuesMatch(0.5, undefined, true), false);
});

// ---------------------------------------------------------------------------
// checkDocumentConsistency — RTP band check + Jackpot combined-RTP rule
// ---------------------------------------------------------------------------
// Stubs out the network call to Gemini so these run offline. Shape mirrors
// what callGemini() would normally hand back — see SUBMISSION_VALIDATION_SCHEMA
// in server/ai.js for the real schema this is standing in for.
function mockGeminiResponse(rtpValues) {
  return {
    documentCompleteness: [],
    parameterValidation: [],
    documentConsistency: [
      { parameter: 'RTP', status: 'in_range', values: rtpValues, detail: '' },
      { parameter: 'Game ID', status: 'missing', values: [], detail: '' },
      { parameter: 'Game Version', status: 'missing', values: [], detail: '' },
      { parameter: 'Minimum Bet', status: 'missing', values: [], detail: '' },
      { parameter: 'Maximum Bet', status: 'missing', values: [], detail: '' },
    ],
    summary: 'test',
  };
}

function withMockedFetch(responseBody, fn) {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(responseBody) }] } }],
    }),
  });
  return Promise.resolve(fn()).finally(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
}

const TWO_DUMMY_DOCS = [
  { fileName: 'doc1.pdf', fileContentBase64: 'data:application/pdf;base64,AAAA' },
  { fileName: 'doc2.pdf', fileContentBase64: 'data:application/pdf;base64,BBBB' },
];

test('checkDocumentConsistency: non-jackpot game — RTP within 90-96.99% band is in_range', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '94.45%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: {},
        withJackpot: 'No',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      assert.equal(rtp.status, 'in_range');
      assert.equal(rtp.expectedValue, `${RTP_MIN_PERCENT}%–${RTP_MAX_PERCENT}%`);
    }
  );
});

test('checkDocumentConsistency: non-jackpot game — RTP of 97% is out_of_range (band tops out at 96.99%)', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '97%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: {},
        withJackpot: 'No',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      assert.equal(rtp.status, 'out_of_range');
    }
  );
});

test('checkDocumentConsistency: jackpot game — base 95% + jackpot 1.5% = 96.5%, under 97%, in_range', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '95%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: { jackpotRtp: 1.5 },
        withJackpot: 'Yes',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      assert.equal(rtp.status, 'in_range');
      assert.match(rtp.values[0].value, /96\.5% total/);
    }
  );
});

test('checkDocumentConsistency: jackpot game — base 95% + jackpot 2.5% = 97.5%, over the 97% cap, out_of_range', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '95%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: { jackpotRtp: 2.5 },
        withJackpot: 'Yes',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      assert.equal(rtp.status, 'out_of_range');
    }
  );
});

test('checkDocumentConsistency: jackpot game — combined RTP of EXACTLY 97% is out_of_range (strict "<", not "<=")', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '95%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: { jackpotRtp: 2 }, // 95 + 2 = exactly 97
        withJackpot: 'Yes',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      assert.equal(rtp.status, 'out_of_range');
      assert.equal(JACKPOT_TOTAL_RTP_MAX_PERCENT, 97);
    }
  );
});

test('checkDocumentConsistency: jackpot game with NO jackpotRtp on file falls back to the ordinary base-only band check', async () => {
  await withMockedFetch(
    mockGeminiResponse([{ source: 'doc1.pdf', value: '95%' }]),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: {}, // no jackpotRtp submitted
        withJackpot: 'Yes',
      });
      const rtp = result.documentConsistency.find((c) => c.parameter === 'RTP');
      // Falls back to the plain 90-96.99% band — 95% passes that on its own.
      assert.equal(rtp.status, 'in_range');
      assert.equal(rtp.expectedValue, `${RTP_MIN_PERCENT}%–${RTP_MAX_PERCENT}%`);
    }
  );
});

test('checkDocumentConsistency: throws a clear error when GEMINI_API_KEY is not set', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () => checkDocumentConsistency({ documents: TWO_DUMMY_DOCS, expectedValues: {} }),
      /GEMINI_API_KEY/
    );
  } finally {
    if (originalKey !== undefined) process.env.GEMINI_API_KEY = originalKey;
  }
});

test('checkDocumentConsistency: throws when fewer than 2 documents are provided', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    await assert.rejects(
      () => checkDocumentConsistency({ documents: [TWO_DUMMY_DOCS[0]], expectedValues: {} }),
      /at least 2 related documents/
    );
  } finally {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

// ---------------------------------------------------------------------------
// Supplementary document types (2026-08-25, at Tiffany's request) —
// "Content Provider Certification" was demoted from required to
// supplementary: still checked/shown, but a missing one must NOT block
// "Ready for Submission" the way a missing required document does.
// ---------------------------------------------------------------------------
function fullReadyMockResponse({ contentProviderCertPresent }) {
  return {
    documentCompleteness: [
      { documentType: 'Game Parameters', present: true, detail: '' },
      { documentType: 'Game Manual', present: true, detail: '' },
      { documentType: 'RNG Certification', present: true, detail: '' },
      { documentType: 'RTP Verification', present: true, detail: '' },
      { documentType: 'Content Provider Certification', present: contentProviderCertPresent, detail: '' },
    ],
    parameterValidation: [
      { parameter: 'Game ID', present: true, detail: '' },
      { parameter: 'Game Version', present: true, detail: '' },
      { parameter: 'Minimum Bet', present: true, detail: '' },
      { parameter: 'Maximum Bet', present: true, detail: '' },
      { parameter: 'RTP', present: true, detail: '' },
    ],
    documentConsistency: [
      { parameter: 'Game ID', status: 'match', values: [{ source: 'doc1.pdf', value: 'ABC-1' }], detail: '' },
      { parameter: 'Game Version', status: 'match', values: [{ source: 'doc1.pdf', value: '1.0' }], detail: '' },
      { parameter: 'Minimum Bet', status: 'match', values: [{ source: 'doc1.pdf', value: '0.5' }], detail: '' },
      { parameter: 'Maximum Bet', status: 'match', values: [{ source: 'doc1.pdf', value: '100' }], detail: '' },
      { parameter: 'RTP', status: 'in_range', values: [{ source: 'doc1.pdf', value: '94.45%' }], detail: '' },
    ],
    summary: 'test',
  };
}

test('checkDocumentConsistency: missing supplementary doc (Content Provider Certification) does NOT block Ready for Submission', async () => {
  await withMockedFetch(
    fullReadyMockResponse({ contentProviderCertPresent: false }),
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: { gameId: 'ABC-1', gameVersion: '1.0', minBet: 0.5, maxBet: 100 },
        withJackpot: 'No',
      });
      assert.equal(result.overallStatus, 'ready');
      const cpc = result.documentCompleteness.find((d) => d.documentType === 'Content Provider Certification');
      assert.equal(cpc.present, false);
      assert.deepEqual(result.supplementaryDocumentTypes, ['Content Provider Certification']);
    }
  );
});

test('checkDocumentConsistency: missing a genuinely REQUIRED doc (e.g. Game Manual) still blocks Ready for Submission', async () => {
  const response = fullReadyMockResponse({ contentProviderCertPresent: true });
  response.documentCompleteness.find((d) => d.documentType === 'Game Manual').present = false;
  await withMockedFetch(
    response,
    async () => {
      const result = await checkDocumentConsistency({
        documents: TWO_DUMMY_DOCS,
        expectedValues: { gameId: 'ABC-1', gameVersion: '1.0', minBet: 0.5, maxBet: 100 },
        withJackpot: 'No',
      });
      assert.equal(result.overallStatus, 'not_ready');
    }
  );
});
