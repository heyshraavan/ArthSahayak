import test from 'node:test';
import assert from 'node:assert/strict';

// --- In-Memory IndexedDB Mock for Ledger Update Testing ---
class MockObjectStore {
  constructor(name, keyPath = 'id') {
    this.name = name;
    this.keyPath = keyPath;
    this.indexes = new Map();
    this.records = new Map();
    this.shouldFail = false;
  }

  createIndex(name, keyPath, options) {
    this.indexes.set(name, { keyPath, options });
  }

  put(item) {
    const req = { result: undefined, onsuccess: null, onerror: null };
    if (this.shouldFail) {
      req.error = new Error('Simulated IndexedDB put write failure');
      queueMicrotask(() => req.onerror?.({ target: req }));
      return req;
    }
    const key = item[this.keyPath];
    this.records.set(key, JSON.parse(JSON.stringify(item)));
    req.result = key;
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

class MockTransaction {
  constructor(store, mode) {
    this.store = store;
    this.mode = mode;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
    this.error = null;

    queueMicrotask(() => {
      if (this.store.shouldFail) {
        this.error = new Error('Simulated IndexedDB transaction abort');
        this.onerror?.({ target: this });
      } else {
        this.oncomplete?.({ target: this });
      }
    });
  }

  objectStore() {
    return this.store;
  }
}

class MockDatabase {
  constructor() {
    this.stores = new Map([
      ['transactions', new MockObjectStore('transactions', 'id')],
      ['media_sync_queue', new MockObjectStore('media_sync_queue', 'id')],
    ]);
  }

  transaction(storeNames, mode) {
    const store = this.stores.get(typeof storeNames === 'string' ? storeNames : storeNames[0]);
    return new MockTransaction(store, mode);
  }

  close() {}
}

const mockDb = new MockDatabase();
globalThis.indexedDB = {
  open: () => {
    const req = {
      result: mockDb,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => req.onsuccess?.({ target: req }));
    return req;
  },
};

// Import storage module under test
const { updateTransaction, loadTransactions, addTransactions, clearTransactions } = await import(
  '../src/lib/ledgerStorage.ts'
);

test('updateTransaction: modifies targeted transaction by ID in IndexedDB', async () => {
  await clearTransactions();

  const initialTxs = [
    {
      id: 'tx-101',
      date: '2026-09-01',
      party_name: 'Original Party',
      item: 'Original Item',
      amount: 5000,
      tx_type: 'credit',
      category: 'sales',
    },
    {
      id: 'tx-102',
      date: '2026-09-02',
      party_name: 'Untouched Party',
      item: 'Untouched Item',
      amount: 2000,
      tx_type: 'debit',
      category: 'raw_material',
    },
  ];
  await addTransactions(initialTxs);

  const updatedTx = {
    id: 'tx-101',
    date: '2026-09-05',
    party_name: 'Modified Party Name',
    item: 'Modified Item Description',
    amount: 7500,
    tx_type: 'credit',
    category: 'services',
  };

  await updateTransaction(updatedTx);

  const all = await loadTransactions();
  assert.equal(all.length, 2, 'Total transaction count should remain 2');

  const modified = all.find((t) => t.id === 'tx-101');
  assert.ok(modified, 'Updated transaction should be present');
  assert.equal(modified.party_name, 'Modified Party Name');
  assert.equal(modified.amount, 7500);
  assert.equal(modified.category, 'services');
  assert.equal(modified.date, '2026-09-05');

  const untouched = all.find((t) => t.id === 'tx-102');
  assert.ok(untouched, 'Untouched transaction should be preserved unchanged');
  assert.equal(untouched.party_name, 'Untouched Party');
  assert.equal(untouched.amount, 2000);
});

test('updateTransaction: propagates rejection on storage failure safely', async () => {
  const txStore = mockDb.stores.get('transactions');
  txStore.shouldFail = true;

  try {
    await assert.rejects(
      async () => {
        await updateTransaction({
          id: 'tx-fail',
          date: '2026-09-01',
          party_name: 'Test',
          item: 'Test',
          amount: 100,
          tx_type: 'credit',
        });
      },
      /Simulated IndexedDB/
    );
  } finally {
    txStore.shouldFail = false;
  }
});
