import { useCallback, useEffect, useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './components/Navbar';
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

  // Ledger state initialized with known demo dataset
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
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

  // Initial calculation on application mount
  useEffect(() => {
    fetchBackendCalculation(transactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchBackendCalculation]);

  // Handle manual / voice / scan addition of a new transaction
  const handleAddTransaction = (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}`,
    };

    const updatedTransactions = [newTx, ...transactions];
    setTransactions(updatedTransactions);

    // Call backend API with updated transaction list
    fetchBackendCalculation(updatedTransactions);
  };

  // Explicit user action to view offline demo numbers when backend is unreachable
  const handleUseDemoFallback = () => {
    setFinancialSummary(DEMO_FINANCIAL_SUMMARY);
    setCalculationStatus('demo');
    setDataSource('demo');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Application Bar */}
      <Navbar currentLanguage={language} onLanguageToggle={toggleLanguage} />

      {/* Main Mobile-First Content Container */}
      <main className="flex-1 max-w-lg w-full mx-auto px-3.5 py-3.5 pb-24">
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
            language={language}
          />
        )}

        {activeTab === 'ledger' && (
          <LedgerPage
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
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
