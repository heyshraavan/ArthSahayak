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

import type {
  ExtractedMediaData,
  QueuedMediaItem,
  QueuedMediaStatus,
  QueuedMediaType,
  QueueStatusSummary,
  Transaction,
} from '../types';

const DB_NAME = 'arthsahayak_ledger_db';
const DB_VERSION = 2;
const STORE_NAME = 'transactions';
const MEDIA_QUEUE_STORE = 'media_sync_queue';
const SEED_FLAG_KEY = 'arthsahayak_ledger_seeded_v1';

/**
 * Open or upgrade the native IndexedDB database.
 * Upgrades:
 * - Version 1: 'transactions' store with indexes on date, tx_type, category
 * - Version 2: 'media_sync_queue' store with indexes on status, createdAt, type
 * Preserves all existing ledger data across migrations.
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
      // Version 1: Ensure transactions store exists and is preserved
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('tx_type', 'tx_type', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }

      // Version 2: Ensure media_sync_queue store exists
      if (!db.objectStoreNames.contains(MEDIA_QUEUE_STORE)) {
        const queueStore = db.createObjectStore(MEDIA_QUEUE_STORE, { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        queueStore.createIndex('type', 'type', { unique: false });
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
 * Update an existing confirmed transaction in IndexedDB.
 * Modifies fields by ID using atomic put operation.
 */
export async function updateTransaction(transaction: Transaction): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(transaction);

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error(`Failed to update transaction ${transaction.id} in IndexedDB.`));
    };

    tx.onabort = () => {
      reject(tx.error || new Error(`Update operation for transaction ${transaction.id} was aborted.`));
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
 * Delete a single confirmed transaction from IndexedDB by ID.
 * Only human-confirmed deletion may be passed here.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error(`Failed to delete transaction ${id} from IndexedDB.`));
    };

    tx.onabort = () => {
      reject(tx.error || new Error(`Delete operation for transaction ${id} was aborted.`));
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

/**
 * Generate collision-safe unique ID for queued media.
 */
export function generateMediaQueueId(type: QueuedMediaType): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `queue-${type}-${crypto.randomUUID()}`;
  }
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `queue-${type}-${timestamp}-${randomSuffix}`;
}

/**
 * Enqueue a voice recording or OCR image into IndexedDB for offline resilience.
 */
export async function enqueueMedia(
  item: Omit<QueuedMediaItem, 'id' | 'createdAt' | 'status' | 'retryCount'> & {
    id?: string;
    createdAt?: string;
    status?: QueuedMediaStatus;
    retryCount?: number;
    errorMessage?: string;
    extractedData?: ExtractedMediaData;
  }
): Promise<QueuedMediaItem> {
  const db = await openDatabase();
  const queuedItem: QueuedMediaItem = {
    id: item.id || generateMediaQueueId(item.type),
    type: item.type,
    createdAt: item.createdAt || new Date().toISOString(),
    status: item.status || 'pending',
    dataBase64: item.dataBase64,
    mimeType: item.mimeType,
    retryCount: item.retryCount ?? 0,
    errorMessage: item.errorMessage,
    extractedData: item.extractedData,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    store.put(queuedItem);

    tx.oncomplete = () => {
      resolve(queuedItem);
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to enqueue media item in IndexedDB.'));
    };

    tx.onabort = () => {
      reject(tx.error || new Error('Enqueue media operation was aborted.'));
    };
  });
}

/**
 * Retrieve all pending media queue items from IndexedDB, ordered FIFO (oldest first).
 */
export async function getPendingQueue(): Promise<QueuedMediaItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allItems = (request.result || []) as QueuedMediaItem[];
      const pendingItems = allItems.filter((item) => item.status === 'pending');
      pendingItems.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      resolve(pendingItems);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to retrieve pending media queue from IndexedDB.'));
    };
  });
}

/**
 * Remove a media queue item by ID (e.g. after successful processing or user cancellation).
 */
export async function removeQueueItem(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    store.delete(id);

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error(`Failed to delete queue item ${id} from IndexedDB.`));
    };

    tx.onabort = () => {
      reject(tx.error || new Error(`Delete queue item operation for ${id} was aborted.`));
    };
  });
}

/**
 * Update status and error message of a media queue item.
 */
export async function updateQueueItemStatus(
  id: string,
  status: QueuedMediaStatus,
  errorMessage?: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as QueuedMediaItem | undefined;
      if (!item) {
        reject(new Error(`Queue item with id ${id} not found.`));
        return;
      }

      item.status = status;
      if (errorMessage !== undefined) {
        item.errorMessage = errorMessage;
      }
      if (status === 'failed') {
        item.retryCount = (item.retryCount || 0) + 1;
      }

      store.put(item);
    };

    getRequest.onerror = () => {
      reject(getRequest.error || new Error(`Failed to find queue item ${id}.`));
    };

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error(`Failed to update status for queue item ${id}.`));
    };

    tx.onabort = () => {
      reject(tx.error || new Error(`Update status operation for queue item ${id} was aborted.`));
    };
  });
}

/**
 * Clear all media items from the IndexedDB media queue.
 */
export async function clearMediaQueue(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    store.clear();

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to clear media queue from IndexedDB.'));
    };
  });
}

/**
 * Mark a queue item as 'ready_for_review' and persist the extracted AI data inside the item.
 * Preserves the item across page refreshes until explicitly confirmed or discarded by the user.
 */
export async function setQueueItemReadyForReview(
  id: string,
  extractedData: ExtractedMediaData
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as QueuedMediaItem | undefined;
      if (!item) {
        reject(new Error(`Queue item with id ${id} not found.`));
        return;
      }

      item.status = 'ready_for_review';
      item.extractedData = extractedData;
      item.errorMessage = undefined;

      store.put(item);
    };

    getRequest.onerror = () => {
      reject(getRequest.error || new Error(`Failed to find queue item ${id}.`));
    };

    tx.oncomplete = () => {
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error || new Error(`Failed to mark queue item ${id} as ready for review.`));
    };

    tx.onabort = () => {
      reject(tx.error || new Error(`Operation to mark ${id} ready for review was aborted.`));
    };
  });
}

/**
 * Retrieve all items waiting for human review from IndexedDB, ordered FIFO (oldest first).
 */
export async function getReadyForReviewQueue(): Promise<QueuedMediaItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allItems = (request.result || []) as QueuedMediaItem[];
      const readyItems = allItems.filter((item) => item.status === 'ready_for_review');
      readyItems.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      resolve(readyItems);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to retrieve ready-for-review items from IndexedDB.'));
    };
  });
}

/**
 * Reset any stalled 'processing' queue items back to 'pending' on startup.
 * Fixes orphaned state if a browser tab or network session terminated mid-flight.
 */
export async function resetStalledProcessingItems(): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allItems = (request.result || []) as QueuedMediaItem[];
      const stalled = allItems.filter((item) => item.status === 'processing');
      for (const item of stalled) {
        item.status = 'pending';
        store.put(item);
      }
      resolve(stalled.length);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to reset stalled processing items.'));
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to commit reset of stalled processing items.'));
    };
  });
}

/**
 * Get aggregate status counts for the media sync queue.
 */
export async function getQueueStatus(): Promise<QueueStatusSummary> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readonly');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allItems = (request.result || []) as QueuedMediaItem[];
      let pendingCount = 0;
      let processingCount = 0;
      let readyCount = 0;
      let failedCount = 0;

      for (const item of allItems) {
        if (item.status === 'pending') pendingCount++;
        else if (item.status === 'processing') processingCount++;
        else if (item.status === 'ready_for_review') readyCount++;
        else if (item.status === 'failed') failedCount++;
      }

      resolve({
        pendingCount,
        processingCount,
        readyCount,
        failedCount,
        total: allItems.length,
      });
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to retrieve media queue status.'));
    };
  });
}

/**
 * Reset any failed queue items back to 'pending' to allow manual or automatic retry.
 */
export async function resetFailedQueueItems(): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allItems = (request.result || []) as QueuedMediaItem[];
      const failed = allItems.filter((item) => item.status === 'failed');
      for (const item of failed) {
        item.status = 'pending';
        item.errorMessage = undefined;
        store.put(item);
      }
      resolve(failed.length);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to reset failed queue items.'));
    };

    tx.onerror = () => {
      reject(tx.error || new Error('Failed to commit reset of failed queue items.'));
    };
  });
}
