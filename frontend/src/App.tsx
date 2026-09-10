import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './components/Navbar';
import {
  addTransaction,
  addTransactions,
  generateTransactionId,
  initializeLedger,
} from './lib/ledgerStorage';
import { DEMO_FINANCIAL_SUMMARY, DEMO_PROFILE, DEMO_TRANSACTIONS } from './lib/mockData';
import { AppraisalPage } from './pages/AppraisalPage';
import { DashboardPage } from './pages/DashboardPage';
import { LedgerPage } from './pages/LedgerPage';
import { SchemesPage } from './pages/SchemesPage';
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
   * Request real deterministic calculation from FastAPI backend.
   * Does NOT duplicate financial math in frontend code.
   */
  const fetchBackendCalculation = useCallback(async (txList: Transaction[]) => {
    setCalculationStatus('loading');
    setErrorMessage(null);

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
      net_operating_income: 20000.0,
      debt_service: 10000.0,
    };

    try {
      const result = await calculateFinance(payload);
      setFinancialSummary(result);
      setCalculationStatus('success');
      setDataSource('backend');
      setErrorMessage(null);
    } catch (err: unknown) {
      // Guardrail: Never silently replace failed backend request with fake numbers
      setFinancialSummary(null);
      setCalculationStatus('error');
      setDataSource(null);
      const message = err instanceof Error ? err.message : 'Unknown connection error';
      setErrorMessage(message);
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
            language={language}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerPage
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onAddTransactions={handleAddTransactions}
            language={language}
          />
        )}

        {activeTab === 'appraisal' && (
          <AppraisalPage financialSummary={financialSummary} language={language} />
        )}

        {activeTab === 'schemes' && <SchemesPage language={language} />}
      </main>

      {/* Mobile-First Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} language={language} />
    </div>
  );
}

export default App;
