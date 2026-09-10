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
  onDeleteTransaction,
  language,
  activeReviewItem,
  onCompleteReview,
  onDiscardReview,
  onDismissReview,
}) => {
  return (
    <div className="space-y-4">
      {/* Welcome & Profile Summary Card */}
      <section
        className="bg-linear-to-r from-blue-900 to-blue-950 text-white rounded-2xl p-4 shadow-sm"
        aria-labelledby="user-welcome-heading"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-blue-200 font-medium">
              {language === 'hi' ? 'नमस्ते / स्वागत है' : 'Welcome back,'}
            </p>
            <h1 id="user-welcome-heading" className="text-xl font-bold tracking-tight mt-0.5">
              {profile.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-blue-200">
              <span className="inline-flex items-center gap-1 bg-blue-800/80 px-2 py-0.5 rounded-md">
                <Briefcase className="w-3 h-3" />
                {profile.trade}
              </span>
              <span className="inline-flex items-center gap-1 bg-blue-800/80 px-2 py-0.5 rounded-md">
                <MapPin className="w-3 h-3" />
                {profile.location}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded-full">
              {language === 'hi' ? 'सक्रिय खाता' : 'Active'}
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
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      </div>
    </div>
  );
};
