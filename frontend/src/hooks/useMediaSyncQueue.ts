import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPendingQueue,
  getQueueStatus,
  getReadyForReviewQueue,
  removeQueueItem,
  resetFailedQueueItems,
  resetStalledProcessingItems,
  setQueueItemReadyForReview,
  updateQueueItemStatus,
} from '../lib/ledgerStorage';
import { extractOcrTransactions, extractVoiceTransaction, transcribeAudio } from '../services/api';
import type { BackendTransaction, QueuedMediaItem, QueueStatusSummary } from '../types';

export interface UseMediaSyncQueueReturn {
  readyItems: QueuedMediaItem[];
  queueCounts: QueueStatusSummary;
  isSyncing: boolean;
  activeReviewItem: QueuedMediaItem | null;
  startReview: (item: QueuedMediaItem) => void;
  dismissActiveReview: () => void;
  completeReview: (itemId: string) => Promise<void>;
  discardReview: (itemId: string) => Promise<void>;
  retryFailed: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const INITIAL_COUNTS: QueueStatusSummary = {
  pendingCount: 0,
  processingCount: 0,
  readyCount: 0,
  failedCount: 0,
  total: 0,
};

export function useMediaSyncQueue(): UseMediaSyncQueueReturn {
  const [readyItems, setReadyItems] = useState<QueuedMediaItem[]>([]);
  const [queueCounts, setQueueCounts] = useState<QueueStatusSummary>(INITIAL_COUNTS);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [activeReviewItem, setActiveReviewItem] = useState<QueuedMediaItem | null>(null);

  // In-memory mutex to prevent concurrent sync loops
  const isSyncingRef = useRef<boolean>(false);

  const refreshState = useCallback(async () => {
    try {
      const [ready, counts] = await Promise.all([
        getReadyForReviewQueue(),
        getQueueStatus(),
      ]);
      setReadyItems(ready);
      setQueueCounts(counts);
    } catch (err) {
      console.warn('Failed to refresh media sync queue state:', err);
    }
  }, []);

  /**
   * Process pending queue items FIFO.
   * Sequential execution ensures ordering and prevents overloading backend or AI endpoints.
   */
  const processQueue = useCallback(async () => {
    // Concurrency lock: Prevent duplicate online events from running concurrent sync loops
    if (isSyncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    try {
      // Step 1: Recover any stalled items from previously crashed/interrupted sessions
      await resetStalledProcessingItems();

      // Step 2: Fetch all pending items ordered FIFO (oldest createdAt first)
      const pendingItems = await getPendingQueue();

      for (const item of pendingItems) {
        // Halt processing if connectivity was lost mid-loop
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }

        // Atomically lock item to 'processing'
        try {
          await updateQueueItemStatus(item.id, 'processing');
          await refreshState();
        } catch {
          // If status update failed, continue to next
          continue;
        }

        try {
          if (item.type === 'voice') {
            // Voice Pipeline: Transcription -> Extraction
            const { transcript } = await transcribeAudio(item.dataBase64, item.mimeType);
            const extractionResult = await extractVoiceTransaction(transcript);

            // Persistent ready_for_review: Keep in IndexedDB with extracted data attached
            await setQueueItemReadyForReview(item.id, {
              voice: {
                transcript,
                suggestedTransaction: extractionResult.suggested_transaction as BackendTransaction,
              },
            });
          } else if (item.type === 'ocr') {
            // OCR Pipeline: Vision Extraction
            const ocrResult = await extractOcrTransactions(item.dataBase64, item.mimeType);

            // Persistent ready_for_review: Keep in IndexedDB with extracted suggestions attached
            await setQueueItemReadyForReview(item.id, {
              ocr: {
                suggestedTransactions: ocrResult.suggested_transactions,
                rawText: ocrResult.raw_text,
              },
            });
          }
        } catch (err: unknown) {
          console.error(`AI processing failed for queue item ${item.id}:`, err);
          const errorMessage = err instanceof Error ? err.message : 'Processing failed';
          // Mark as failed and keep in queue for future retry
          await updateQueueItemStatus(item.id, 'failed', errorMessage);
        }

        await refreshState();
      }
    } catch (err) {
      console.error('Error during media queue processing:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshState();
    }
  }, [refreshState]);

  // Initialize on mount and register online event listener
  useEffect(() => {
    let isMounted = true;

    async function init() {
      await resetStalledProcessingItems();
      if (isMounted) {
        await refreshState();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          processQueue();
        }
      }
    }

    init();

    const handleOnline = () => {
      processQueue();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [processQueue, refreshState]);

  const startReview = useCallback((item: QueuedMediaItem) => {
    setActiveReviewItem(item);
  }, []);

  const dismissActiveReview = useCallback(() => {
    setActiveReviewItem(null);
  }, []);

  /**
   * Called only after confirmed transaction(s) have been successfully written to the ledger.
   * Removes the item from IndexedDB and clears active review.
   */
  const completeReview = useCallback(async (itemId: string) => {
    try {
      await removeQueueItem(itemId);
      setActiveReviewItem((prev) => (prev?.id === itemId ? null : prev));
      await refreshState();
    } catch (err) {
      console.error(`Failed to remove confirmed queue item ${itemId}:`, err);
    }
  }, [refreshState]);

  /**
   * Called when user explicitly chooses to discard an unconfirmed AI suggestion.
   * Removes the item from IndexedDB without adding to ledger.
   */
  const discardReview = useCallback(async (itemId: string) => {
    try {
      await removeQueueItem(itemId);
      setActiveReviewItem((prev) => (prev?.id === itemId ? null : prev));
      await refreshState();
    } catch (err) {
      console.error(`Failed to discard queue item ${itemId}:`, err);
    }
  }, [refreshState]);

  /**
   * Reset all failed items back to 'pending' and re-trigger sync.
   */
  const retryFailed = useCallback(async () => {
    await resetFailedQueueItems();
    await refreshState();
    await processQueue();
  }, [processQueue, refreshState]);

  return {
    readyItems,
    queueCounts,
    isSyncing,
    activeReviewItem,
    startReview,
    dismissActiveReview,
    completeReview,
    discardReview,
    retryFailed,
    triggerSync: processQueue,
  };
}
