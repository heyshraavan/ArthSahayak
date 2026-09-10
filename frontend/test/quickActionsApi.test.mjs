import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ApiError,
  transcribeAudio,
  extractVoiceTransaction,
  extractOcrTransactions,
} from '../src/services/api.ts';

// Helper to create mock Response object
function mockJsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Map([['content-type', 'application/json']]),
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

test('transcribeAudio: returns transcript on 200 success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockJsonResponse({ transcript: 'Received Rs 5000 from Ramesh', confidence: 0.95 });

  try {
    const res = await transcribeAudio('fake-audio-base64');
    assert.strictEqual(res.transcript, 'Received Rs 5000 from Ramesh');
    assert.strictEqual(res.confidence, 0.95);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('transcribeAudio: throws ApiError on 500 server error without offline classification', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockJsonResponse({ detail: 'Whisper service unavailable' }, 500);

  try {
    await assert.rejects(
      async () => transcribeAudio('fake-audio-base64'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 500);
        assert.strictEqual(err.message, 'Whisper service unavailable');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('transcribeAudio: throws ApiError on fetch network rejection', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    await assert.rejects(
      async () => transcribeAudio('fake-audio-base64'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.message, 'Failed to transcribe audio: Failed to fetch');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractVoiceTransaction: returns transaction structure on 200 success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockJsonResponse({
      transcript: 'Paid Rs 1200 for wood',
      suggested_transaction: {
        date: '2026-09-10',
        party_name: 'Timber Depot',
        item: 'Wood',
        amount: 1200,
        tx_type: 'debit',
        category: 'raw_material',
      },
      requires_confirmation: true,
    });

  try {
    const res = await extractVoiceTransaction('Paid Rs 1200 for wood');
    assert.strictEqual(res.suggested_transaction.amount, 1200);
    assert.strictEqual(res.suggested_transaction.party_name, 'Timber Depot');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractVoiceTransaction: throws ApiError on 422 error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockJsonResponse({ detail: 'Invalid transcript payload' }, 422);

  try {
    await assert.rejects(
      async () => extractVoiceTransaction(''),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 422);
        assert.strictEqual(err.message, 'Invalid transcript payload');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractOcrTransactions: returns extracted items on 200 success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockJsonResponse({
      raw_text: 'Anil 500\nSunil 300',
      suggested_transactions: [
        { date: '2026-09-10', party_name: 'Anil', item: 'Goods', amount: 500, tx_type: 'credit', category: 'sales' },
        { date: '2026-09-10', party_name: 'Sunil', item: 'Goods', amount: 300, tx_type: 'credit', category: 'sales' },
      ],
      requires_confirmation: true,
    });

  try {
    const res = await extractOcrTransactions('fake-image-base64');
    assert.strictEqual(res.suggested_transactions.length, 2);
    assert.strictEqual(res.suggested_transactions[0].party_name, 'Anil');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractOcrTransactions: throws ApiError on 422 unreadable image', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    mockJsonResponse({ detail: 'The image could not be reliably read.' }, 422);

  try {
    await assert.rejects(
      async () => extractOcrTransactions('fake-image-base64'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 422);
        assert.strictEqual(err.message, 'The image could not be reliably read.');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractOcrTransactions: throws ApiError on 502 upstream AI failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockJsonResponse({ detail: 'Gemini service unreachable' }, 502);

  try {
    await assert.rejects(
      async () => extractOcrTransactions('fake-image-base64'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 502);
        assert.strictEqual(err.message, 'AI service is temporarily unavailable. Please try again.');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('extractOcrTransactions: throws ApiError with status 0 on network fetch failure', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };

  try {
    await assert.rejects(
      async () => extractOcrTransactions('fake-image-base64'),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.strictEqual(err.status, 0);
        assert.ok(err.message.includes('Failed to reach ArthSahayak OCR service'));
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
