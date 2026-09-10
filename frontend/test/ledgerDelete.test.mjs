import test from 'node:test';
import assert from 'node:assert/strict';

// --- In-Memory IndexedDB Mock for Ledger Deletion Testing ---
class MockObjectStore {
  constructor(name, keyPath = 'id') {
    this.name = name;
    this.keyPath = keyPath;
    this.indexes = new Map();
    this.records = new Map();
    this.shouldFailDelete = false;
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
    const req = { result: undefined, onsuccess: null, onerror: null };
    if (this.shouldFailDelete) {
      const err = new Error('Simulated IndexedDB disk I/O error');
      req.error = err;
      queueMicrotask(() => req.onerror?.({ target: req }));
      return req;
    }
    this.records.delete(key);
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
    this.abortTransactions = false;
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
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      objectStore: (name) => {
        const s = this.stores.get(name);
        if (!s) throw new Error(`NotFoundError: The specified object store was not found: ${name}`);
        if (s.shouldFailDelete) {
          tx.error = new Error('Simulated transaction failure');
          queueMicrotask(() => {
            tx.onerror?.({ target: tx });
          });
        }
        return s;
      },
    };
    queueMicrotask(() => {
      queueMicrotask(() => {
        if (this.abortTransactions) {
          tx.error = new Error('Transaction aborted');
          tx.onabort?.({ target: tx });
        } else if (!tx.error) {
          tx.oncomplete?.({ target: tx });
        }
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

// Global harness setup
const mockFactory = new MockIDBFactory();
globalThis.indexedDB = mockFactory;

// Import modules under test
const ledgerStorage = await import('../src/lib/ledgerStorage.ts');
const financeEngine = await import('../src/lib/financeEngine.ts');

const sampleTransactions = [
  {
    id: 'tx-1',
    party_name: 'Sharma Sweets',
    amount: 15000,
    tx_type: 'credit',
    category: 'sales',
    date: '2026-09-01',
    item: 'Bulk order',
  },
  {
    id: 'tx-2',
    party_name: 'Verma Flour Mill',
    amount: 5000,
    tx_type: 'debit',
    category: 'raw_material',
    date: '2026-09-02',
    item: 'Flour purchase',
  },
  {
    id: 'tx-3',
    party_name: 'Gramin Bank',
    amount: 2000,
    tx_type: 'debit',
    category: 'loan_repayment',
    date: '2026-09-03',
    item: 'Monthly EMI',
  },
];

// Helper to reset and seed storage
async function resetStorageWith(transactions = sampleTransactions) {
  await ledgerStorage.clearTransactions();
  if (transactions.length > 0) {
    await ledgerStorage.addTransactions(transactions);
  }
}

test('deleteTransaction: removes targeted transaction from IndexedDB while preserving other transactions', async () => {
  await resetStorageWith(sampleTransactions);

  let loaded = await ledgerStorage.loadTransactions();
  assert.equal(loaded.length, 3);
  assert.ok(loaded.some((t) => t.id === 'tx-2'));

  // Delete tx-2
  await ledgerStorage.deleteTransaction('tx-2');

  // Verify only tx-2 is removed
  loaded = await ledgerStorage.loadTransactions();
  assert.equal(loaded.length, 2);
  assert.ok(!loaded.some((t) => t.id === 'tx-2'), 'tx-2 must be removed');
  assert.ok(loaded.some((t) => t.id === 'tx-1'), 'tx-1 must remain intact');
  assert.ok(loaded.some((t) => t.id === 'tx-3'), 'tx-3 must remain intact');
});

test('deleteTransaction: persistence across reloads (deleted transaction stays deleted)', async () => {
  await resetStorageWith(sampleTransactions);

  // Delete tx-1
  await ledgerStorage.deleteTransaction('tx-1');

  // Simulate reloading database / new session by reading directly through loadTransactions
  const reloaded = await ledgerStorage.loadTransactions();
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded.find((t) => t.id === 'tx-1'), undefined);

  // Verify other transaction fields are completely intact
  const tx3 = reloaded.find((t) => t.id === 'tx-3');
  assert.ok(tx3);
  assert.equal(tx3.party_name, 'Gramin Bank');
  assert.equal(tx3.amount, 2000);
});

test('deleteTransaction: does not affect media_sync_queue store', async () => {
  await resetStorageWith(sampleTransactions);

  // Enqueue a media item into media_sync_queue
  const queuedItem = await ledgerStorage.enqueueMedia({
    type: 'voice',
    dataBase64: 'dGVzdC1hdWRpby1kYXRh',
    mimeType: 'audio/webm',
  });

  // Verify media item is in the queue
  const pendingBefore = await ledgerStorage.getPendingQueue();
  assert.equal(pendingBefore.length, 1);
  assert.equal(pendingBefore[0].id, queuedItem.id);

  // Delete a transaction from transactions store
  await ledgerStorage.deleteTransaction('tx-1');

  // Verify media item is completely untouched
  const pendingAfter = await ledgerStorage.getPendingQueue();
  assert.equal(pendingAfter.length, 1);
  assert.equal(pendingAfter[0].id, queuedItem.id);
  assert.equal(pendingAfter[0].status, 'pending');

  // Clean up media queue
  await ledgerStorage.removeQueueItem(queuedItem.id);
});

test('financial recalculation: metrics update deterministically after deleting a transaction', async () => {
  let currentTransactions = [...sampleTransactions];

  // Initial financial summary with all 3 transactions
  // tx-1: credit 15000 (sales)
  // tx-2: debit 5000 (raw_materials)
  // tx-3: debit 2000 (loan_repayment)
  // turnover = 15000, credit = 15000, debit = 7000, netCashFlow = 8000
  // NOI = 15000 - 5000 = 10000
  // debtService = 2000
  // DSCR = 10000 / 2000 = 5.0
  const initialNOI = financeEngine.calculatedOperatingSurplus(currentTransactions);
  const initialDebtService = financeEngine.totalDebtService(currentTransactions);
  const initialSummary = financeEngine.computeFinancialSummary(
    currentTransactions,
    null,
    initialNOI,
    initialDebtService
  );

  assert.equal(initialSummary.turnover, 15000);
  assert.equal(initialSummary.total_credit, 15000);
  assert.equal(initialSummary.total_debit, 7000);
  assert.equal(initialSummary.net_cash_flow, 8000);
  assert.equal(initialDebtService, 2000);
  assert.equal(initialSummary.dscr, 5.0);

  // 1. Delete tx-2 (raw_materials debit 5000)
  await ledgerStorage.deleteTransaction('tx-2');
  currentTransactions = currentTransactions.filter((tx) => tx.id !== 'tx-2');

  const afterDeleteDebitNOI = financeEngine.calculatedOperatingSurplus(currentTransactions);
  const afterDeleteDebitDS = financeEngine.totalDebtService(currentTransactions);
  const summaryAfterDebit = financeEngine.computeFinancialSummary(
    currentTransactions,
    null,
    afterDeleteDebitNOI,
    afterDeleteDebitDS
  );

  // Now: credit = 15000, debit = 2000 (loan_repayment), netCashFlow = 13000
  // NOI = 15000 - 0 = 15000
  // debtService = 2000, DSCR = 15000 / 2000 = 7.5
  assert.equal(summaryAfterDebit.turnover, 15000);
  assert.equal(summaryAfterDebit.total_credit, 15000);
  assert.equal(summaryAfterDebit.total_debit, 2000);
  assert.equal(summaryAfterDebit.net_cash_flow, 13000);
  assert.equal(summaryAfterDebit.dscr, 7.5);

  // 2. Delete tx-3 (loan_repayment debit 2000)
  await ledgerStorage.deleteTransaction('tx-3');
  currentTransactions = currentTransactions.filter((tx) => tx.id !== 'tx-3');

  const afterDeleteDebtNOI = financeEngine.calculatedOperatingSurplus(currentTransactions);
  const afterDeleteDebtDS = financeEngine.totalDebtService(currentTransactions);
  const summaryAfterDebt = financeEngine.computeFinancialSummary(
    currentTransactions,
    null,
    afterDeleteDebtNOI,
    afterDeleteDebtDS
  );

  // Now: credit = 15000, debit = 0, debtService = 0 -> DSCR must be null (debt-free)
  assert.equal(summaryAfterDebt.total_credit, 15000);
  assert.equal(summaryAfterDebt.total_debit, 0);
  assert.equal(summaryAfterDebt.net_cash_flow, 15000);
  assert.equal(afterDeleteDebtDS, 0);
  assert.equal(summaryAfterDebt.dscr, null, 'DSCR must be null when debt service is 0');
});

test('offline deletion: operates successfully without network access', async () => {
  await resetStorageWith(sampleTransactions);

  // Verify that deletion and local calculation run without any network request or window.fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('Network offline: fetch is unavailable');
  };

  try {
    // Perform delete while strictly offline
    await ledgerStorage.deleteTransaction('tx-1');
    const remaining = await ledgerStorage.loadTransactions();
    assert.equal(remaining.length, 2);

    // Recalculate financial summary on-device
    const noi = financeEngine.calculatedOperatingSurplus(remaining);
    const ds = financeEngine.totalDebtService(remaining);
    const localSummary = financeEngine.computeFinancialSummary(remaining, null, noi, ds);

    // Turnover should be 0 because remaining transactions have no sales category
    assert.equal(localSummary.turnover, 0);
    assert.equal(localSummary.total_credit, 0);
    assert.equal(localSummary.total_debit, 7000);
    assert.equal(localSummary.net_cash_flow, -7000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failure safety: error in IndexedDB delete propagates and rejects', async () => {
  const db = await ledgerStorage.openDatabase();
  const txStore = db.stores.get('transactions');

  // Force delete failure on the store
  txStore.shouldFailDelete = true;

  try {
    await assert.rejects(
      async () => {
        await ledgerStorage.deleteTransaction('tx-1');
      },
      (err) => {
        assert.ok(err);
        return true;
      },
      'deleteTransaction must reject if IndexedDB operation fails'
    );
  } finally {
    txStore.shouldFailDelete = false;
  }
});
