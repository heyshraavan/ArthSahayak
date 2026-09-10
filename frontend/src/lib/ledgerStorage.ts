/**
 * Native IndexedDB local-first storage module for ArthSahayak.
 *
 * GUARANTEES:
 * - Native IndexedDB only (zero external libraries or dependencies).
 * - KeyPath is 'id'.
 * - Atomic batch insertion via a single readwrite transaction.
 * - Only human-confirmed transactions are written to storage.
 * - AI suggestions (voice/OCR) and unconfirmed inputs are NEVER persisted.
 * - Offline-first: confirmed ledger transactions survive page reloads and browser restarts.
 */

import type { Transaction } from '../types';

const DB_NAME = 'arthsahayak_ledger_db';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
const SEED_FLAG_KEY = 'arthsahayak_ledger_seeded_v1';

/**
 * Open or upgrade the native IndexedDB database.
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser/environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('tx_type', 'tx_type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open ArthSahayak IndexedDB database.'));
    };
  });
}

/**
 * Generate collision-safe unique transaction ID.
 * Prefers crypto.randomUUID() with safe timestamp + random fallback.
 */
export function generateTransactionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx-${crypto.randomUUID()}`;
  }
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `tx-${timestamp}-${randomSuffix}`;
}

/**
 * Load all confirmed transactions from IndexedDB.
 * Returns transactions sorted in descending chronological order (newest first).
 */
export async function loadTransactions(): Promise<Transaction[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result || []) as Transaction[];
      // Sort newest to oldest: compare ISO date string descending defensively
      try {
        results.sort((a, b) => {
          const dateB = String(b?.date ?? '');
          const dateA = String(a?.date ?? '');
          return dateB.localeCompare(dateA);
        });
      } catch (sortErr) {
        console.warn('Non-fatal warning: Error sorting transactions in loadTransactions:', sortErr);
      }
      resolve(results);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to load transactions from IndexedDB.'));
    };
  });
}

/**
 * Add a single confirmed transaction to IndexedDB.
 * Only human-confirmed transactions may be passed here.
 */
export async function addTransaction(transaction: Transaction): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(transaction);

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to save transaction to IndexedDB.'));
    };

    tx.onabort = () => {
      reject(tx.error || new Error('Transaction write operation was aborted.'));
    };
  });
}

/**
 * Atomically add a batch of confirmed transactions to IndexedDB.
 * Uses a single readwrite transaction so the entire batch succeeds or fails as a unit.
 */
export async function addTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const item of transactions) {
      store.put(item);
    }

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to save batch transactions to IndexedDB.'));
    };

    tx.onabort = () => {
      reject(tx.error || new Error('Batch transaction write was aborted.'));
    };
  });
}

/**
 * Clear all transactions from the IndexedDB store.
 */
export async function clearTransactions(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to clear transactions from IndexedDB.'));
    };
  });
}

/**
 * Initialize ledger on application startup.
 * Seeding behavior:
 * - On first launch (no SEED_FLAG_KEY in localStorage) and if the IndexedDB store is completely empty,
 *   seeds the initial demo transactions atomically.
 * - If transactions already exist in IndexedDB, returns the persisted records directly.
 * - If the ledger was previously seeded (flag set) but is now empty (user cleared it), does NOT re-seed.
 */
export async function initializeLedger(seedData: Transaction[]): Promise<Transaction[]> {
  const existing = await loadTransactions();
  const isSeeded = typeof localStorage !== 'undefined' && localStorage.getItem(SEED_FLAG_KEY) === 'true';

  if (!isSeeded && existing.length === 0 && seedData.length > 0) {
    await addTransactions(seedData);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEED_FLAG_KEY, 'true');
    }
    return await loadTransactions();
  }

  if (existing.length > 0 && !isSeeded && typeof localStorage !== 'undefined') {
    localStorage.setItem(SEED_FLAG_KEY, 'true');
  }

  return existing;
}
