import test from 'node:test';
import assert from 'node:assert/strict';

import { generateDossier, ApiError } from '../src/services/api.ts';
import { buildDossierPayload } from '../src/lib/dossierPayload.ts';

const SAMPLE_FINANCIAL_SUMMARY = {
  total_credit: 42500,
  total_debit: 14200,
  net_cash_flow: 28300,
  turnover: 42500,
  working_capital_requirement: 10625,
  promoter_margin: 2125,
  maximum_permissible_bank_finance: 8500,
  dscr: 1.85,
};

const SAMPLE_PROFILE = {
  name: 'Ramesh Sharma',
  trade: 'Carpentry & Woodcraft',
  location: 'Purulia, West Bengal',
  period: 'FY 2025-26 (Last 6 Months)',
};

const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx-1',
    date: '2026-09-08',
    party_name: 'Anil Babu (School)',
    item: '2 Desks & Benches',
    amount: 14000,
    tx_type: 'credit',
    category: 'sales',
  },
  {
    id: 'tx-2',
    date: '2026-09-06',
    party_name: 'Maa Tara Timber Depot',
    item: 'Sal & Teak Planks',
    amount: 7500,
    tx_type: 'debit',
    category: 'raw_material',
  },
  {
    id: 'tx-3',
    date: '2026-09-05',
    party_name: 'Gopal Hardware',
    item: 'Fevicol, Screws',
    amount: 1700,
    tx_type: 'debit',
    category: 'raw_material',
  },
  {
    id: 'tx-4',
    date: '2026-09-03',
    party_name: 'Village Pradhan Office',
    item: 'Door Frame Fitting',
    amount: 8500,
    tx_type: 'credit',
    category: 'sales',
  },
  {
    id: 'tx-5',
    date: '2026-09-01',
    party_name: 'Assistant Wages',
    item: 'Weekly Wages',
    amount: 5000,
    tx_type: 'debit',
    category: 'operating_expense',
  },
];

// ============================================================================
// PART 1: Payload Construction & Privacy Guardrail Tests
// ============================================================================

test('buildDossierPayload: preserves exact financial values without modification', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: SAMPLE_TRANSACTIONS,
    language: 'en',
    assessmentDate: '2026-09-10',
  });

  assert.deepStrictEqual(payload.financial_summary, SAMPLE_FINANCIAL_SUMMARY);
  assert.strictEqual(payload.proposed_finance_amount, 8500);
  assert.strictEqual(payload.transaction_count, 5);
});

test('buildDossierPayload: limits transaction sample to 4 to guarantee 2-page fit', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: SAMPLE_TRANSACTIONS,
  });

  assert.ok(payload.transaction_sample);
  assert.strictEqual(payload.transaction_sample.length, 4);
  // Ensure the latest transaction comes first
  assert.strictEqual(payload.transaction_sample[0].date, '2026-09-08');
  assert.strictEqual(payload.transaction_sample[0].party_name, 'Anil Babu (School)');
});

test('buildDossierPayload: limits scheme recommendations to max 3', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: SAMPLE_TRANSACTIONS,
  });

  assert.ok(payload.scheme_recommendations);
  assert.ok(payload.scheme_recommendations.length <= 3);
  for (const sch of payload.scheme_recommendations) {
    assert.ok(sch.scheme_name, 'Scheme recommendation must have scheme_name');
    assert.ok(sch.sponsoring_agency, 'Scheme recommendation must have sponsoring_agency');
  }
});

test('buildDossierPayload: privacy invariant - zero Aadhaar, PAN, or caste numbers in payload', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: SAMPLE_TRANSACTIONS,
  });

  const serialized = JSON.stringify(payload).toLowerCase();
  assert.strictEqual(serialized.includes('aadhaar'), false, 'Payload must not contain Aadhaar references');
  assert.strictEqual(serialized.includes('pan_number'), false, 'Payload must not contain PAN references');
  assert.strictEqual(serialized.includes('caste_certificate'), false, 'Payload must not contain caste certificate numbers');
});

test('buildDossierPayload: handles empty transaction list gracefully', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: [],
  });

  assert.strictEqual(payload.transaction_count, 0);
  assert.strictEqual(payload.transaction_sample, null);
  assert.ok(payload.appraisal_notes.includes('0 confirmed digital ledger transactions'));
});

test('buildDossierPayload: handles Hindi language appraisal notes deterministically', () => {
  const payload = buildDossierPayload({
    financialSummary: SAMPLE_FINANCIAL_SUMMARY,
    profile: SAMPLE_PROFILE,
    transactions: SAMPLE_TRANSACTIONS,
    language: 'hi',
  });

  assert.ok(payload.appraisal_notes.includes('नायक समिति 20% टर्नओवर फॉर्मूले'));
  assert.ok(payload.appraisal_notes.includes('₹8,500'));
  assert.ok(payload.appraisal_notes.includes('1.85x'));
});

// ============================================================================
// PART 2: API generateDossier Network & Blob Tests
// ============================================================================

test('generateDossier: successfully returns PDF Blob when backend returns 200 with application/pdf', async () => {
  const originalFetch = globalThis.fetch;
  const mockPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4

  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/dossier/generate'));
    assert.strictEqual(options.method, 'POST');
    assert.strictEqual(options.headers['Content-Type'], 'application/json');
    assert.strictEqual(options.headers['Accept'], 'application/pdf');

    const parsedBody = JSON.parse(options.body);
    assert.strictEqual(parsedBody.financial_summary.turnover, 42500);

    return new Response(mockPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ArthSahayak_Credit_Appraisal_Dossier.pdf"',
      },
    });
  };

  try {
    const payload = buildDossierPayload({
      financialSummary: SAMPLE_FINANCIAL_SUMMARY,
      profile: SAMPLE_PROFILE,
      transactions: SAMPLE_TRANSACTIONS,
    });

    const blob = await generateDossier(payload);
    assert.ok(blob instanceof Blob, 'Result must be a Blob');
    assert.strictEqual(blob.size, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateDossier: throws ApiError on 422 unprocessable entity with validation details', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        detail: [{ loc: ['body', 'financial_summary'], msg: 'Field required', type: 'missing' }],
      }),
      {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  try {
    const invalidPayload = { financial_summary: null };
    await assert.rejects(
      async () => {
        await generateDossier(invalidPayload);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 422);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateDossier: throws ApiError on 500 server generation error', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        detail: 'Failed to generate dossier PDF: ReportLab layout overflow',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  try {
    const payload = buildDossierPayload({
      financialSummary: SAMPLE_FINANCIAL_SUMMARY,
      profile: SAMPLE_PROFILE,
    });

    await assert.rejects(
      async () => {
        await generateDossier(payload);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 500);
        assert.ok(err.message.includes('ReportLab layout overflow'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateDossier: throws ApiError when server returns unexpected content type (not PDF)', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    return new Response('<html><body>Gateway Timeout</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  };

  try {
    const payload = buildDossierPayload({
      financialSummary: SAMPLE_FINANCIAL_SUMMARY,
      profile: SAMPLE_PROFILE,
    });

    await assert.rejects(
      async () => {
        await generateDossier(payload);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.ok(err.message.includes('expected PDF document'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generateDossier: catches network disconnection / offline fetch rejection', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    const payload = buildDossierPayload({
      financialSummary: SAMPLE_FINANCIAL_SUMMARY,
      profile: SAMPLE_PROFILE,
    });

    await assert.rejects(
      async () => {
        await generateDossier(payload);
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 0);
        assert.ok(err.message.includes('Network Error: Failed to reach ArthSahayak API'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
