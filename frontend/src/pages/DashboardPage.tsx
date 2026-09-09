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
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  language: 'en' | 'hi';
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
  language,
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

      {/* Primary Actions: Speak, Scan Chit, Add Manual */}
      <QuickActions onAddTransaction={onAddTransaction} language={language} />

      {/* Financial Health Metrics (API-driven / Loading / Error / Verified Engine Indicator) */}
      <FinancialMetricCards
        summary={financialSummary}
        status={calculationStatus}
        dataSource={dataSource}
        errorMessage={errorMessage}
        onRetry={onRetryCalculation}
        onUseDemoFallback={onUseDemoFallback}
        language={language}
      />

      {/* Recent Transactions List */}
      <RecentTransactions transactions={transactions} language={language} />
    </div>
  );
};
