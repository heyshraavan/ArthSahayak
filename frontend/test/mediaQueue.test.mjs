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

class MockIDBFactory {
  constructor() {
    this.databases = new Map();
  }

  open(name, requestedVersion) {
    const req = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    queueMicrotask(() => {
      let db = this.databases.get(name);
      const oldVersion = db ? db.version : 0;

      if (!db) {
        db = new MockIDBDatabase(name, requestedVersion || 1);
        this.databases.set(name, db);
      }

      if (requestedVersion && requestedVersion > oldVersion) {
        db.version = requestedVersion;
        const upgradeEvent = {
          target: { result: db },
          oldVersion,
          newVersion: requestedVersion,
        };
        req.result = db;
        req.onupgradeneeded?.(upgradeEvent);
      }

      req.result = db;
      req.onsuccess?.({ target: req });
    });

    return req;
  }
}

// Setup global mock for IndexedDB
globalThis.indexedDB = new MockIDBFactory();
globalThis.localStorage = {
  store: new Map(),
  getItem: (k) => globalThis.localStorage.store.get(k) ?? null,
  setItem: (k, v) => globalThis.localStorage.store.set(k, String(v)),
  removeItem: (k) => globalThis.localStorage.store.delete(k),
  clear: () => globalThis.localStorage.store.clear(),
};

// Dynamic import of ledgerStorage module under test
const {
  openDatabase,
  addTransaction: _addTransaction,
  loadTransactions,
  enqueueMedia,
  getPendingQueue,
  updateQueueItemStatus,
  removeQueueItem,
  clearMediaQueue,
} = await import('../src/lib/dateUtils.ts').then(async () => {
  return await import('../src/lib/ledgerStorage.ts');
});

test('IndexedDB version migration from v1 to v2 preserves ledger data and creates media_sync_queue', async () => {
  // 1. Simulate existing v1 database with a confirmed transaction
  const v1Factory = new MockIDBFactory();
  globalThis.indexedDB = v1Factory;

  // Open as v1 directly
  const v1Req = v1Factory.open('arthsahayak_ledger_db', 1);
  await new Promise((resolve) => {
    v1Req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const store = db.createObjectStore('transactions', { keyPath: 'id' });
      store.createIndex('date', 'date', { unique: false });
    };
    v1Req.onsuccess = resolve;
  });

  const dbV1 = v1Req.result;
  assert.strictEqual(dbV1.objectStoreNames.contains('transactions'), true);
  assert.strictEqual(dbV1.objectStoreNames.contains('media_sync_queue'), false);

  // Add existing transaction to v1
  const existingTx = {
    id: 'tx-v1-existing',
    date: '2026-09-08',
    party_name: 'Gupta Timber',
    item: 'Sal Planks',
    amount: 5000,
    tx_type: 'debit',
    category: 'raw_material',
  };
  await new Promise((resolve) => {
    const tx = dbV1.transaction('transactions', 'readwrite');
    tx.objectStore('transactions').put(existingTx);
    tx.oncomplete = resolve;
  });

  // 2. Open via production openDatabase() which requests v2
  const dbV2 = await openDatabase();
  assert.strictEqual(dbV2.version, 2);
  assert.strictEqual(dbV2.objectStoreNames.contains('transactions'), true);
  assert.strictEqual(dbV2.objectStoreNames.contains('media_sync_queue'), true);

  // 3. Verify existing ledger data was preserved 100%
  const loaded = await loadTransactions();
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'tx-v1-existing');
  assert.strictEqual(loaded[0].party_name, 'Gupta Timber');
});

test('enqueue voice item: creates typed queue item in IndexedDB', async () => {
  await clearMediaQueue();

  const fakeAudioBase64 = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=';
  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: fakeAudioBase64,
    mimeType: 'audio/webm',
  });

  assert.ok(item.id.startsWith('queue-voice-'));
  assert.strictEqual(item.type, 'voice');
  assert.strictEqual(item.status, 'pending');
  assert.strictEqual(item.dataBase64, fakeAudioBase64);
  assert.strictEqual(item.mimeType, 'audio/webm');
  assert.strictEqual(item.retryCount, 0);
  assert.ok(item.createdAt);
});

test('enqueue OCR item: creates typed queue item in IndexedDB', async () => {
  await clearMediaQueue();

  const fakeImageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
  const item = await enqueueMedia({
    type: 'ocr',
    dataBase64: fakeImageBase64,
    mimeType: 'image/jpeg',
  });

  assert.ok(item.id.startsWith('queue-ocr-'));
  assert.strictEqual(item.type, 'ocr');
  assert.strictEqual(item.status, 'pending');
  assert.strictEqual(item.dataBase64, fakeImageBase64);
  assert.strictEqual(item.mimeType, 'image/jpeg');
  assert.strictEqual(item.retryCount, 0);
});

test('retrieve pending items: returns only pending items sorted FIFO by createdAt', async () => {
  await clearMediaQueue();

  const item1 = await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-data-1',
    mimeType: 'audio/webm',
    createdAt: '2026-09-10T07:00:00.000Z',
  });

  const item2 = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'ocr-data-2',
    mimeType: 'image/jpeg',
    createdAt: '2026-09-10T07:05:00.000Z',
  });

  const _item3 = await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-data-3',
    mimeType: 'audio/webm',
    status: 'failed',
    createdAt: '2026-09-10T07:02:00.000Z',
  });

  const pending = await getPendingQueue();
  // Only item1 and item2 are pending (item3 is failed)
  assert.strictEqual(pending.length, 2);
  assert.strictEqual(pending[0].id, item1.id);
  assert.strictEqual(pending[1].id, item2.id);
});

test('update status: updates status, increments retryCount on failure, and stores error message', async () => {
  await clearMediaQueue();

  const item = await enqueueMedia({
    type: 'ocr',
    dataBase64: 'image-data',
    mimeType: 'image/png',
  });

  // Update to processing
  await updateQueueItemStatus(item.id, 'processing');
  let pending = await getPendingQueue();
  assert.strictEqual(pending.length, 0); // No longer pending

  // Update to failed with error message
  await updateQueueItemStatus(item.id, 'failed', 'Upstream OCR server timed out');

  const db = await openDatabase();
  const failedItem = await new Promise((resolve) => {
    const tx = db.transaction('media_sync_queue', 'readonly');
    const req = tx.objectStore('media_sync_queue').get(item.id);
    req.onsuccess = () => resolve(req.result);
  });

  assert.strictEqual(failedItem.status, 'failed');
  assert.strictEqual(failedItem.retryCount, 1);
  assert.strictEqual(failedItem.errorMessage, 'Upstream OCR server timed out');
});

test('remove item: deletes item from media_sync_queue', async () => {
  await clearMediaQueue();

  const item = await enqueueMedia({
    type: 'voice',
    dataBase64: 'audio-to-delete',
    mimeType: 'audio/webm',
  });

  let pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);

  await removeQueueItem(item.id);

  pending = await getPendingQueue();
  assert.strictEqual(pending.length, 0);
});

test('offline voice capture is queued: when navigator.onLine is false, audio is preserved in IndexedDB', async () => {
  await clearMediaQueue();

  // Simulate navigator.onLine = false
  const originalOnLine = globalThis.navigator?.onLine;
  Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });

  // Component logic simulation:
  const audioBlobBase64 = 'fake-offline-audio-recording-base64';
  const mimeType = 'audio/webm';

  let voiceState = 'idle';
  if (!globalThis.navigator.onLine) {
    await enqueueMedia({
      type: 'voice',
      dataBase64: audioBlobBase64,
      mimeType,
    });
    voiceState = 'queued_offline';
  }

  assert.strictEqual(voiceState, 'queued_offline');

  const pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].type, 'voice');
  assert.strictEqual(pending[0].dataBase64, audioBlobBase64);

  Object.defineProperty(globalThis.navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
});

test('offline OCR capture is queued: when navigator.onLine is false, chit photo is preserved in IndexedDB', async () => {
  await clearMediaQueue();

  // Simulate navigator.onLine = false
  const originalOnLine = globalThis.navigator?.onLine;
  Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true, writable: true });

  const imageBase64 = 'fake-offline-chit-image-base64';
  const mimeType = 'image/jpeg';

  let ocrState = 'idle';
  if (!globalThis.navigator.onLine) {
    await enqueueMedia({
      type: 'ocr',
      dataBase64: imageBase64,
      mimeType,
    });
    ocrState = 'queued_offline';
  }

  assert.strictEqual(ocrState, 'queued_offline');

  const pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].type, 'ocr');
  assert.strictEqual(pending[0].dataBase64, imageBase64);

  Object.defineProperty(globalThis.navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
});

test('failed network request preserves the captured media in IndexedDB', async () => {
  await clearMediaQueue();

  // Simulate online when action started, but fetch threw network failure
  const originalOnLine = globalThis.navigator?.onLine;
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });

  const imageBase64 = 'fake-chit-attempted-online';
  const mimeType = 'image/jpeg';

  let ocrState = 'processing';
  try {
    // Simulated fetch failure
    throw new TypeError('Failed to fetch');
  } catch (err) {
    const isNetworkError =
      !globalThis.navigator.onLine ||
      (err instanceof Error && err.message.toLowerCase().includes('failed to fetch'));

    if (isNetworkError) {
      await enqueueMedia({
        type: 'ocr',
        dataBase64: imageBase64,
        mimeType,
        errorMessage: err.message,
      });
      ocrState = 'queued_offline';
    }
  }

  assert.strictEqual(ocrState, 'queued_offline');

  const pending = await getPendingQueue();
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].type, 'ocr');
  assert.strictEqual(pending[0].errorMessage, 'Failed to fetch');

  Object.defineProperty(globalThis.navigator, 'onLine', { value: originalOnLine, configurable: true, writable: true });
});
