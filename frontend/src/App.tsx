import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './components/Navbar';
import { useMediaSyncQueue } from './hooks/useMediaSyncQueue';
import {
  addTransaction,
  addTransactions,
  deleteTransaction,
  generateTransactionId,
  initializeLedger,
} from './lib/ledgerStorage';
import { DEMO_FINANCIAL_SUMMARY, DEMO_PROFILE, DEMO_TRANSACTIONS } from './lib/mockData';
import { AppraisalPage } from './pages/AppraisalPage';
import { DashboardPage } from './pages/DashboardPage';
import { LedgerPage } from './pages/LedgerPage';
import { SchemesPage } from './pages/SchemesPage';
import {
  calculatedOperatingSurplus,
  computeFinancialSummary,
  totalDebtService,
} from './lib/financeEngine';
import { calculateFinance } from './services/api';
import type {
  CalculationDataSource,
  CalculationStatus,
  FinanceCalculationRequest,
  FinancialSummary,
  NavigationTab,
  Transaction,
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  // Persistent Media Queue Sync Manager
  const {
    readyItems,
    queueCounts,
    isSyncing,
    activeReviewItem,
    startReview,
    dismissActiveReview,
    completeReview,
    discardReview,
    retryFailed,
  } = useMediaSyncQueue();

  // Ledger state - persisted via native IndexedDB as single source of truth
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState<boolean>(true);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [profile] = useState(DEMO_PROFILE);

  // Financial calculation state - manages API lifecycle
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [calculationStatus, setCalculationStatus] = useState<CalculationStatus>('loading');
  const [dataSource, setDataSource] = useState<CalculationDataSource>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'));
  };

  /**
   * Request real deterministic calculation from FastAPI backend when online,
   * falling back to on-device deterministic calculation (100% mathematical parity)
   * when offline or backend is unreachable.
   */
  const fetchBackendCalculation = useCallback(async (txList: Transaction[]) => {
    setCalculationStatus('loading');
    setErrorMessage(null);

    // Derive operating surplus from confirmed categorized ledger (preserves negative surplus for deficits):
    const derivedNOI = calculatedOperatingSurplus(txList);
    // Recorded loan-repayment proxy from confirmed ledger (0 if none recorded):
    const derivedDebtService = totalDebtService(txList);

    const payload: FinanceCalculationRequest = {
      transactions: txList.map((tx) => ({
        date: tx.date,
        party_name: tx.party_name,
        item: tx.item,
        amount: tx.amount,
        tx_type: tx.tx_type,
        category: tx.category ?? null,
      })),
      explicit_turnover: null,
      net_operating_income: derivedNOI,
      debt_service: derivedDebtService,
    };

    try {
      const result = await calculateFinance(payload);
      setFinancialSummary(result);
      setCalculationStatus('success');
      setDataSource('backend');
      setErrorMessage(null);
    } catch (err: unknown) {
      // Offline fallback: calculate deterministically on-device from the exact same confirmed ledger
      try {
        const localResult = computeFinancialSummary(
          payload.transactions,
          null,
          derivedNOI,
          derivedDebtService,
        );
        setFinancialSummary(localResult);
        setCalculationStatus('success');
        setDataSource('local');
        setErrorMessage(null);
      } catch (localErr: unknown) {
        setFinancialSummary(null);
        setCalculationStatus('error');
        setDataSource(null);
        const message =
          localErr instanceof Error
            ? localErr.message
            : err instanceof Error
            ? err.message
            : 'Calculation error';
        setErrorMessage(message);
      }
    }
  }, []);

  // Initial ledger load & first-launch demo seeding via native IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function loadLedger() {
      try {
        setIsLedgerLoading(true);
        setPersistenceError(null);
        const loadedTxs = await initializeLedger(DEMO_TRANSACTIONS);
        if (isMounted) {
          setTransactions(loadedTxs);
          fetchBackendCalculation(loadedTxs);
        }
      } catch (err: unknown) {
        console.error('Failed to initialize ledger from IndexedDB:', err);
        const msg = err instanceof Error ? err.message : 'Local storage access failed';
        if (isMounted) {
          setPersistenceError(msg);
          // Do NOT overwrite user ledger with demo transactions on error
          setTransactions([]);
        }
      } finally {
        if (isMounted) {
          setIsLedgerLoading(false);
        }
      }
    }

    loadLedger();

    return () => {
      isMounted = false;
    };
  }, [fetchBackendCalculation]);

  // Re-sync calculation with backend when network connectivity is restored
  useEffect(() => {
    const handleOnline = () => {
      if (transactions.length > 0) {
        fetchBackendCalculation(transactions);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchBackendCalculation, transactions]);

  // Handle manual / voice addition of a single confirmed transaction
  const handleAddTransaction = async (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: generateTransactionId(),
    };

    try {
      // 1. Write to IndexedDB first
      await addTransaction(newTx);
      setPersistenceError(null);
    } catch (err: unknown) {
      console.error('Failed to persist transaction:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save transaction locally';
      setPersistenceError(msg);
      throw err;
    }

    // 2. Update React state cleanly using functional updater & trigger exactly one calculation
    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      fetchBackendCalculation(updated);
      return updated;
    });
  };

  // Handle atomic batch addition of confirmed transactions (e.g. multi-row OCR scan)
  const handleAddTransactions = async (newTxDataList: Omit<Transaction, 'id'>[]) => {
    if (newTxDataList.length === 0) return;

    // 1. Generate unique collision-safe IDs for all transactions in the batch first
    const newTxs: Transaction[] = newTxDataList.map((data) => ({
      ...data,
      id: generateTransactionId(),
    }));

    try {
      // 2. Write entire batch atomically in a single IndexedDB transaction
      await addTransactions(newTxs);
      setPersistenceError(null);
    } catch (err: unknown) {
      console.error('Failed to persist batch transactions:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save batch transactions locally';
      setPersistenceError(msg);
      throw err;
    }

    // 3. Update React state ONCE & trigger exactly ONE backend calculation with the full list
    setTransactions((prev) => {
      const updated = [...newTxs, ...prev];
      fetchBackendCalculation(updated);
      return updated;
    });
  };

  // Handle manual deletion of a single confirmed ledger transaction
  const handleDeleteTransaction = async (id: string) => {
    try {
      // 1. Delete from IndexedDB first
      await deleteTransaction(id);
      setPersistenceError(null);
    } catch (err: unknown) {
      console.error('Failed to delete transaction:', err);
      const msg = err instanceof Error ? err.message : 'Failed to delete transaction locally';
      setPersistenceError(msg);
      throw err;
    }

    // 2. Update React state ONLY after IndexedDB deletion succeeds & trigger recalculation
    setTransactions((prev) => {
      const updated = prev.filter((tx) => tx.id !== id);
      fetchBackendCalculation(updated);
      return updated;
    });
  };

  // Explicit user action to view offline demo numbers when backend is unreachable
  const handleUseDemoFallback = () => {
    setFinancialSummary(DEMO_FINANCIAL_SUMMARY);
    setCalculationStatus('demo');
    setDataSource('demo');
    setErrorMessage(null);
  };

  // App startup loading screen
  if (isLedgerLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar currentLanguage={language} onLanguageToggle={toggleLanguage} />
        <main className="flex-1 max-w-lg w-full mx-auto px-3.5 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-800">
            {language === 'hi' ? 'बही-खाता लोड हो रहा है...' : 'Loading ledger...'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'hi' ? 'स्थानीय सुरक्षित स्टोरेज से डेटा पढ़ा जा रहा है' : 'Reading data from local storage'}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Application Bar */}
      <Navbar currentLanguage={language} onLanguageToggle={toggleLanguage} />

      {/* Main Mobile-First Content Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-3.5 py-3.5 pb-24">
        {/* Persistence Error Alert (if IndexedDB write failed) */}
        {persistenceError && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">{language === 'hi' ? 'स्थानीय स्टोरेज सूचना' : 'Storage Notice'}</p>
              <p className="mt-0.5">{persistenceError}</p>
            </div>
            <button
              onClick={() => setPersistenceError(null)}
              className="text-amber-700 hover:text-amber-900 font-bold px-1 cursor-pointer"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Offline Queue Processing / Sync Indicator */}
        {isSyncing && (
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span className="font-medium">
              {language === 'hi'
                ? 'ऑफ़लाइन प्रविष्टियों का AI विश्लेषण जारी है...'
                : 'Processing queued offline media with AI...'}
            </span>
          </div>
        )}

        {/* Failed items notice with retry */}
        {queueCounts.failedCount > 0 && !isSyncing && (
          <div className="mb-3 px-3 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {language === 'hi'
                  ? `${queueCounts.failedCount} ऑफ़लाइन प्रविष्टि प्रोसेस नहीं हो सकी।`
                  : `${queueCounts.failedCount} offline ${queueCounts.failedCount === 1 ? 'item' : 'items'} failed to process.`}
              </span>
            </div>
            <button
              type="button"
              onClick={retryFailed}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] cursor-pointer"
            >
              {language === 'hi' ? 'पुनः प्रयास' : 'Retry'}
            </button>
          </div>
        )}

        {/* Persistent Ready For Review Banner */}
        {readyItems.length > 0 && !activeReviewItem && (
          <div className="mb-3.5 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-amber-950 truncate">
                    {language === 'hi'
                      ? `${readyItems.length} ऑफ़लाइन प्रविष्टि समीक्षा के लिए तैयार`
                      : `${readyItems.length} Offline ${readyItems.length === 1 ? 'Entry' : 'Entries'} Ready for Review`}
                  </h4>
                  <p className="text-[11px] text-amber-900/80 leading-tight mt-0.5">
                    {language === 'hi'
                      ? 'AI द्वारा तैयार — बही-खाता में जोड़ने हेतु पुष्टि आवश्यक है'
                      : 'AI extraction ready — Human verification mandatory'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'appraisal' || activeTab === 'schemes') {
                    setActiveTab('dashboard');
                  }
                  startReview(readyItems[0]);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                {language === 'hi' ? 'समीक्षा करें →' : 'Review →'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardPage
            profile={profile}
            financialSummary={financialSummary}
            calculationStatus={calculationStatus}
            dataSource={dataSource}
            errorMessage={errorMessage}
            onRetryCalculation={() => fetchBackendCalculation(transactions)}
            onUseDemoFallback={handleUseDemoFallback}
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onAddTransactions={handleAddTransactions}
            onDeleteTransaction={handleDeleteTransaction}
            language={language}
            activeReviewItem={activeReviewItem}
            onCompleteReview={completeReview}
            onDiscardReview={discardReview}
            onDismissReview={dismissActiveReview}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerPage
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onAddTransactions={handleAddTransactions}
            onDeleteTransaction={handleDeleteTransaction}
            language={language}
            activeReviewItem={activeReviewItem}
            onCompleteReview={completeReview}
            onDiscardReview={discardReview}
            onDismissReview={dismissActiveReview}
          />
        )}

        {activeTab === 'appraisal' && (
          <AppraisalPage financialSummary={financialSummary} language={language} />
        )}

        {activeTab === 'schemes' && (
          <SchemesPage
            language={language}
            initialProfile={{ trade: profile.trade, locationType: 'rural' }}
          />
        )}
      </main>

      {/* Mobile-First Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} language={language} />
    </div>
  );
}

export default App;
