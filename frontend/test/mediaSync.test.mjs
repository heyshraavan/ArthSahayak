import test from 'node:test';
import assert from 'node:assert/strict';

// --- Lightweight In-Memory IndexedDB Mock for Node Testing ---
class MockObjectStore {
  constructor(name, keyPath = 'id') {
    this.name = name;
    this.keyPath = keyPath;
    this.indexes = new Map();
    this.records = new Map();
  }

  createIndex(name, keyPath, options) {
    this.indexes.set(name, { keyPath, options });
  }

  put(item) {
    const key = item[this.keyPath];
    this.records.set(key, JSON.parse(JSON.stringify(item)));
    const req = { result: key, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  get(key) {
    const item = this.records.get(key);
    const req = {
      result: item ? JSON.parse(JSON.stringify(item)) : undefined,
      onsuccess: null,
      onerror: null,
    };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  getAll() {
    const items = Array.from(this.records.values()).map((r) => JSON.parse(JSON.stringify(r)));
    const req = { result: items, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  delete(key) {
    this.records.delete(key);
    const req = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }

  clear() {
    this.records.clear();
    const req = { result: undefined, onsuccess: null, onerror: null };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  }
}

class MockIDBDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.stores = new Map();
  }

  get objectStoreNames() {
    const names = Array.from(this.stores.keys());
    return {
      contains: (n) => names.includes(n),
      length: names.length,
      item: (i) => names[i],
    };
  }

  createObjectStore(name, options) {
    const store = new MockObjectStore(name, options?.keyPath);
    this.stores.set(name, store);
    return store;
  }

  transaction(_storeNames, mode) {
    const tx = {
      mode,
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: (name) => {
        const s = this.stores.get(name);
        if (!s) throw new Error(`NotFoundError: The specified object store was not found: ${name}`);
        return s;
      },
    };
    // Auto-complete transaction after microtasks
    queueMicrotask(() => {
      queueMicrotask(() => {
        tx.oncomplete?.({ target: tx });
      });
    });
    return tx;
  }

  close() {}
}

let activeMockDb = new MockIDBDatabase('arthsahayak_ledger_db', 2);

// Setup global IndexedDB mock environment
globalThis.indexedDB = {
  open: (name, version) => {
    const req = {
      result: activeMockDb,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    queueMicrotask(() => {
      if (activeMockDb.version < version || activeMockDb.stores.size === 0) {
        req.onupgradeneeded?.({ target: req });
        activeMockDb.version = version;
      }
      req.onsuccess?.({ target: req });
    });

    return req;
  },
};

// Setup global navigator & localStorage
if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { onLine: true };
} else {
  Object.defineProperty(globalThis.navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
}

const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) ?? null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

// Dynamic import of ledgerStorage module
const {
  openDatabase,
  addTransaction,
  loadTransactions,
  enqueueMedia,
  getPendingQueue,
  updateQueueItemStatus,
  removeQueueItem,
  clearMediaQueue: _clearMediaQueue,
  setQueueItemReadyForReview,
  getReadyForReviewQueue,
  resetStalledProcessingItems,
  getQueueStatus,
  resetFailedQueueItems,
} = await import('../src/lib/ledgerStorage.ts');

function resetDatabase() {
  activeMockDb = new MockIDBDatabase('arthsahayak_ledger_db', 2);
  mockStorage.clear();
}

// ============================================================================
// TEST SUITE: Phase C Media Sync Queue Lifecycle & Invariants
// ============================================================================

test('Phase C Lifecycle: pending -> processing -> ready_for_review', async () => {
  resetDatabase();
  await openDatabase();

  // 1. Enqueue item in 'pending' status
  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-sample-base64',
    mimeType: 'audio/webm',
  });
  assert.strictEqual(item.status, 'pending');

  let pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].id, item.id);

  // 2. Transition to 'processing'
  await updateQueueItemStatus(item.id, 'processing');
  pending = await getPendingQueue();
  assert.strictEqual(pending.length, 0, 'Item in processing is excluded from pending queue');

  // 3. Transition to 'ready_for_review' with extracted AI data
  await setQueueItemReadyForReview(item.id, {
    voice: {
      transcript: 'Received Rs 5000 from Ramesh for tables',
      suggestedTransaction: {
        date: '2026-09-10',
        party_name: 'Ramesh',
        item: 'tables',
        amount: 5000,
        tx_type: 'credit',
        category: 'sales',
      },
    },
  });

  const ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 1);
  assert.strictEqual(ready[0].status, 'ready_for_review');
  assert.strictEqual(ready[0].extractedData.voice.transcript, 'Received Rs 5000 from Ramesh for tables');
  assert.strictEqual(ready[0].extractedData.voice.suggestedTransaction.amount, 5000);
});

test('ready_for_review survives reload', async () => {
  resetDatabase();
  await openDatabase();

  // Save an item ready for review
  const item = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'ocr-chit-image',
    mimeType: 'image/jpeg',
  });

  await setQueueItemReadyForReview(item.id, {
    ocr: {
      suggestedTransactions: [
        {
          date: '2026-09-10',
          party_name: 'Sharma Traders',
          item: 'Plywood boards',
          amount: 8200,
          tx_type: 'debit',
          category: 'raw_material',
        },
      ],
      rawText: 'Sharma Traders 8200 Plywood',
    },
  });

  // Simulate a page reload: re-querying ready queue from database
  const readyAfterReload = await getReadyForReviewQueue();
  assert.strictEqual(readyAfterReload.length, 1);
  assert.strictEqual(readyAfterReload[0].id, item.id);
  assert.strictEqual(readyAfterReload[0].status, 'ready_for_review');
  assert.strictEqual(readyAfterReload[0].extractedData.ocr.suggestedTransactions[0].amount, 8200);
});

test('voice queue processing: transcription -> extraction pipeline', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'voice-payload-base64',
    mimeType: 'audio/webm',
  });

  // Mock Voice Pipeline
  async function mockProcessVoice(queueItem) {
    await updateQueueItemStatus(queueItem.id, 'processing');
    // Simulated transcription
    const transcript = 'Paid Rs 1200 for tea and snacks';
    // Simulated extraction
    const extraction = {
      suggested_transaction: {
        date: '2026-09-10',
        party_name: 'Tea Stall',
        item: 'Tea and snacks',
        amount: 1200,
        tx_type: 'debit',
        category: 'operating_expense',
      },
    };

    await setQueueItemReadyForReview(queueItem.id, {
      voice: {
        transcript,
        suggestedTransaction: extraction.suggested_transaction,
      },
    });
  }

  await mockProcessVoice(item);

  const ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 1);
  assert.strictEqual(ready[0].extractedData.voice.transcript, 'Paid Rs 1200 for tea and snacks');
  assert.strictEqual(ready[0].extractedData.voice.suggestedTransaction.category, 'operating_expense');
});

test('OCR queue processing: vision extraction with raw text and items', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'receipt-image-base64',
    mimeType: 'image/jpeg',
  });

  // Mock OCR Pipeline
  async function mockProcessOcr(queueItem) {
    await updateQueueItemStatus(queueItem.id, 'processing');
    const ocrResult = {
      suggested_transactions: [
        {
          date: '2026-09-10',
          party_name: 'Gupta Hardware',
          item: 'Screws & Nails',
          amount: 450,
          tx_type: 'debit',
          category: 'raw_material',
        },
      ],
      raw_text: 'Gupta Hardware 450 screws nails',
    };

    await setQueueItemReadyForReview(queueItem.id, {
      ocr: {
        suggestedTransactions: ocrResult.suggested_transactions,
        rawText: ocrResult.raw_text,
      },
    });
  }

  await mockProcessOcr(item);

  const ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 1);
  assert.strictEqual(ready[0].extractedData.ocr.suggestedTransactions[0].party_name, 'Gupta Hardware');
  assert.strictEqual(ready[0].extractedData.ocr.rawText, 'Gupta Hardware 450 screws nails');
});

test('failed processing remains queued with error message and retry count increments', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'bad-audio',
    mimeType: 'audio/webm',
  });

  assert.strictEqual(item.retryCount, 0);

  // Simulate failed processing
  await updateQueueItemStatus(item.id, 'processing');
  await updateQueueItemStatus(item.id, 'failed', 'Upstream 502: Transcription timeout');

  const status = await getQueueStatus();
  assert.strictEqual(status.failedCount, 1);
  assert.strictEqual(status.pendingCount, 0);

  // Verify item is still persisted in the store
  const store = activeMockDb.stores.get('media_sync_queue');
  const storedItem = store.records.get(item.id);
  assert.ok(storedItem, 'Item is preserved in IndexedDB despite failure');
  assert.strictEqual(storedItem.status, 'failed');
  assert.strictEqual(storedItem.retryCount, 1);
  assert.strictEqual(storedItem.errorMessage, 'Upstream 502: Transcription timeout');

  // Second failure increments retry count again
  await updateQueueItemStatus(item.id, 'failed', 'Second failure');
  const updatedItem = store.records.get(item.id);
  assert.strictEqual(updatedItem.retryCount, 2);
  assert.strictEqual(updatedItem.errorMessage, 'Second failure');

  // Test resetFailedQueueItems
  const resetCount = await resetFailedQueueItems();
  assert.strictEqual(resetCount, 1);
  const resetItem = store.records.get(item.id);
  assert.strictEqual(resetItem.status, 'pending');
  assert.strictEqual(resetItem.errorMessage, undefined);
});

test('duplicate online events do not duplicate API calls (mutex lock)', async () => {
  resetDatabase();
  await openDatabase();

  await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-1',
    mimeType: 'audio/webm',
    createdAt: '2026-09-10T07:00:00.000Z',
  });

  let apiCallCount = 0;
  let isSyncing = false;

  async function syncHandler() {
    if (isSyncing) return; // Mutex protection
    isSyncing = true;
    try {
      const pending = await getPendingQueue();
      for (const p of pending) {
        apiCallCount++;
        await updateQueueItemStatus(p.id, 'processing');
        // Simulated API call latency
        await new Promise((r) => setTimeout(r, 10));
        await setQueueItemReadyForReview(p.id, {
          voice: {
            transcript: 'Done',
            suggestedTransaction: {
              date: '2026-09-10',
              party_name: 'P',
              item: 'I',
              amount: 100,
              tx_type: 'credit',
              category: 'sales',
            },
          },
        });
      }
    } finally {
      isSyncing = false;
    }
  }

  // Fire two simultaneous online events
  await Promise.all([syncHandler(), syncHandler(), syncHandler()]);

  assert.strictEqual(apiCallCount, 1, 'API was called exactly once despite 3 concurrent triggers');
});

test('FIFO ordering: items processed strictly in order of oldest createdAt first', async () => {
  resetDatabase();
  await openDatabase();

  await enqueueMedia({
    id: 'item-newest',
    type: 'ocr',
    dataBase64: 'ocr-3',
    mimeType: 'image/jpeg',
    createdAt: '2026-09-10T07:10:00.000Z',
  });

  await enqueueMedia({
    id: 'item-oldest',
    type: 'voice',
    dataBase64: 'voice-1',
    mimeType: 'audio/webm',
    createdAt: '2026-09-10T07:00:00.000Z',
  });

  await enqueueMedia({
    id: 'item-middle',
    type: 'voice',
    dataBase64: 'voice-2',
    mimeType: 'audio/webm',
    createdAt: '2026-09-10T07:05:00.000Z',
  });

  const pending = await getPendingQueue();
  assert.strictEqual(pending.length, 3);
  assert.strictEqual(pending[0].id, 'item-oldest', 'Oldest item must be first in FIFO queue');
  assert.strictEqual(pending[1].id, 'item-middle', 'Middle item must be second in FIFO queue');
  assert.strictEqual(pending[2].id, 'item-newest', 'Newest item must be last in FIFO queue');
});

test('confirming a review removes queue item ONLY AFTER ledger transaction is persisted', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'voice-data',
    mimeType: 'audio/webm',
  });

  await setQueueItemReadyForReview(item.id, {
    voice: {
      transcript: 'Customer paid Rs 3000 cash',
      suggestedTransaction: {
        date: '2026-09-10',
        party_name: 'Customer',
        item: 'Cash Sale',
        amount: 3000,
        tx_type: 'credit',
        category: 'sales',
      },
    },
  });

  // Scenario 1: Ledger persistence fails -> Queue item MUST NOT be removed
  let ledgerSaveFailed = true;
  async function attemptConfirmWithError() {
    if (ledgerSaveFailed) {
      throw new Error('IndexedDB disk full error');
    }
    // Would remove only if succeeded:
    await removeQueueItem(item.id);
  }

  await assert.rejects(attemptConfirmWithError, /IndexedDB disk full error/);

  // Verify item is still in ready queue
  let ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 1, 'Queue item remained intact when ledger persistence failed');

  // Scenario 2: Ledger persistence succeeds -> Queue item is removed
  ledgerSaveFailed = false;
  await addTransaction({
    id: 'tx-confirmed-1',
    date: '2026-09-10',
    party_name: 'Customer',
    item: 'Cash Sale',
    amount: 3000,
    tx_type: 'credit',
    category: 'sales',
  });
  await removeQueueItem(item.id);

  ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 0, 'Queue item is removed only after ledger save succeeded');

  const ledgerTxs = await loadTransactions();
  assert.strictEqual(ledgerTxs.length, 1);
  assert.strictEqual(ledgerTxs[0].id, 'tx-confirmed-1');
});

test('discarding a review removes the queue item without adding to the ledger', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'irrelevant-chit',
    mimeType: 'image/jpeg',
  });

  await setQueueItemReadyForReview(item.id, {
    ocr: {
      suggestedTransactions: [
        {
          date: '2026-09-10',
          party_name: 'Random Store',
          item: 'Personal expense',
          amount: 250,
          tx_type: 'debit',
          category: 'other',
        },
      ],
    },
  });

  // User explicitly discards the AI suggestion
  await removeQueueItem(item.id);

  // Queue item is deleted
  const ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 0);

  // Ledger contains ZERO transactions
  const ledgerTxs = await loadTransactions();
  assert.strictEqual(ledgerTxs.length, 0, 'No transaction was committed to the ledger on discard');
});

test('Invariant: AI results are never automatically added to the ledger', async () => {
  resetDatabase();
  await openDatabase();

  // Enqueue multiple voice and OCR captures
  const vItem = await enqueueMedia({
    type: 'voice',
    dataBase64: 'v1',
    mimeType: 'audio/webm',
  });

  const oItem = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'o1',
    mimeType: 'image/jpeg',
  });

  // Simulate automatic sync processing (background AI job)
  await setQueueItemReadyForReview(vItem.id, {
    voice: {
      transcript: 'Received 10000',
      suggestedTransaction: {
        date: '2026-09-10',
        party_name: 'A',
        item: 'I',
        amount: 10000,
        tx_type: 'credit',
        category: 'sales',
      },
    },
  });

  await setQueueItemReadyForReview(oItem.id, {
    ocr: {
      suggestedTransactions: [
        {
          date: '2026-09-10',
          party_name: 'B',
          item: 'J',
          amount: 5000,
          tx_type: 'debit',
          category: 'raw_material',
        },
      ],
    },
  });

  // After processing finishes, check the ledger
  const ledgerTxs = await loadTransactions();
  assert.strictEqual(
    ledgerTxs.length,
    0,
    'Ledger must remain strictly empty until explicit human confirmation occurs'
  );

  const ready = await getReadyForReviewQueue();
  assert.strictEqual(ready.length, 2, 'Both processed items are waiting in ready_for_review');
});

test('resetStalledProcessingItems restores orphaned processing items back to pending', async () => {
  resetDatabase();
  await openDatabase();

  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-stalled',
    mimeType: 'audio/webm',
  });

  await updateQueueItemStatus(item.id, 'processing');

  let pending = await getPendingQueue();
  assert.strictEqual(pending.length, 0);

  // App boots or re-sync runs
  const count = await resetStalledProcessingItems();
  assert.strictEqual(count, 1);

  pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].id, item.id);
  assert.strictEqual(pending[0].status, 'pending');
});
