import React from 'react';
import { Briefcase, MapPin } from 'lucide-react';
import { FinancialMetricCards } from '../components/FinancialMetricCards';
import { QuickActions } from '../components/QuickActions';
import { RecentTransactions } from '../components/RecentTransactions';
import type {
  CalculationDataSource,
  CalculationStatus,
  EntrepreneurProfile,
  FinancialSummary,
  QueuedMediaItem,
  Transaction,
} from '../types';

interface DashboardPageProps {
  profile: EntrepreneurProfile;
  financialSummary: FinancialSummary | null;
  calculationStatus: CalculationStatus;
  dataSource: CalculationDataSource;
  errorMessage?: string | null;
  onRetryCalculation: () => void;
  onUseDemoFallback?: () => void;
  transactions: Transaction[];
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void> | void;
  onAddTransactions?: (txs: Omit<Transaction, 'id'>[]) => Promise<void> | void;
  onUpdateTransaction?: (tx: Transaction) => Promise<void> | void;
  onDeleteTransaction?: (id: string) => Promise<void> | void;
  language: 'en' | 'hi';
  activeReviewItem?: QueuedMediaItem | null;
  onCompleteReview?: (itemId: string) => Promise<void> | void;
  onDiscardReview?: (itemId: string) => Promise<void> | void;
  onDismissReview?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  profile,
  financialSummary,
  calculationStatus,
  dataSource,
  errorMessage,
  onRetryCalculation,
  onUseDemoFallback,
  transactions,
  onAddTransaction,
  onAddTransactions,
  onUpdateTransaction,
  onDeleteTransaction,
  language,
  activeReviewItem,
  onCompleteReview,
  onDiscardReview,
  onDismissReview,
}) => {
  return (
    <div className="space-y-4">
      {/* Welcome & Profile Summary Card (Solid UX4G-inspired structure, minimal gradient) */}
      <section
        className="bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-xs transition-colors"
        aria-labelledby="user-welcome-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-indigo-300 dark:text-indigo-400 font-semibold tracking-wide uppercase">
              {language === 'hi' ? 'नमस्ते / स्वागत है' : 'Welcome back,'}
            </p>
            <h1 id="user-welcome-heading" className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-200 border border-slate-700/60 px-2.5 py-1 rounded-md font-medium">
                <Briefcase className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                <span>{profile.trade}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 bg-slate-800/90 text-slate-200 border border-slate-700/60 px-2.5 py-1 rounded-md font-medium">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                <span>{profile.location}</span>
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{language === 'hi' ? 'सक्रिय उद्यम' : 'Active Enterprise'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Responsive 2-column layout at lg breakpoint */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* Left / Primary Column (7 cols): Financial Health & RBI Norms */}
        <div className="lg:col-span-7 space-y-4">
          <FinancialMetricCards
            summary={financialSummary}
            status={calculationStatus}
            dataSource={dataSource}
            errorMessage={errorMessage}
            onRetry={onRetryCalculation}
            onUseDemoFallback={onUseDemoFallback}
            language={language}
          />
        </div>

        {/* Right / Secondary Column (5 cols): Actions & Ledger Activity */}
        <div className="lg:col-span-5 space-y-4">
          <QuickActions
            onAddTransaction={onAddTransaction}
            onAddTransactions={onAddTransactions}
            language={language}
            activeReviewItem={activeReviewItem}
            onCompleteReview={onCompleteReview}
            onDiscardReview={onDiscardReview}
            onDismissReview={onDismissReview}
          />

          <RecentTransactions
            transactions={transactions}
            language={language}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      </div>
    </div>
  );
};
