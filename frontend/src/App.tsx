import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import { Navbar } from './components/Navbar';
import { DEMO_FINANCIAL_SUMMARY, DEMO_PROFILE, DEMO_TRANSACTIONS } from './lib/mockData';
import { AppraisalPage } from './pages/AppraisalPage';
import { DashboardPage } from './pages/DashboardPage';
import { LedgerPage } from './pages/LedgerPage';
import { SchemesPage } from './pages/SchemesPage';
import type { NavigationTab, Transaction } from './types';


export function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');

  // Client state - initialized with clearly marked demo data
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [profile] = useState(DEMO_PROFILE);
  const [financialSummary, setFinancialSummary] = useState(DEMO_FINANCIAL_SUMMARY);

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'hi' : 'en'));
  };

  const handleAddTransaction = (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}`,
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Update the local summary state so the UI reflects the entry immediately
    setFinancialSummary((prev) => {
      const isCredit = newTx.tx_type === 'credit';
      const updatedCredit = isCredit ? prev.total_credit + newTx.amount : prev.total_credit;
      const updatedDebit = !isCredit ? prev.total_debit + newTx.amount : prev.total_debit;
      const updatedNet = updatedCredit - updatedDebit;
      const updatedTurnover = updatedCredit;

      return {
        ...prev,
        total_credit: updatedCredit,
        total_debit: updatedDebit,
        net_cash_flow: updatedNet,
        turnover: updatedTurnover,
        working_capital_requirement: Math.round(0.25 * updatedTurnover),
        promoter_margin: Math.round(0.05 * updatedTurnover),
        maximum_permissible_bank_finance: Math.round(0.20 * updatedTurnover),
      };
    });
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
