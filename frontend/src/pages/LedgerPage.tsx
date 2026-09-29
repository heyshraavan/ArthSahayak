import React from 'react';
import { QuickActions } from '../components/QuickActions';
import { RecentTransactions } from '../components/RecentTransactions';
import type { QueuedMediaItem, Transaction } from '../types';

interface LedgerPageProps {
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

export const LedgerPage: React.FC<LedgerPageProps> = ({
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
          {language === 'hi' ? 'डिजिटल बही-खाता (Ledger)' : 'Digital Bahi-Khata (Ledger)'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {language === 'hi'
            ? 'आपकी सभी लेन-देन प्रविष्टियाँ (आवक और खर्च) यहाँ सुरक्षित हैं।'
            : 'All recorded informal cash receipts and operational expenses in one place.'}
        </p>
      </div>

      {/* Responsive 2-column layout on desktop, preserved order on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
        {/* Recent Transactions: Left / Primary pane on desktop (7 cols), below actions on mobile */}
        <div className="order-2 lg:order-1 lg:col-span-7">
          <RecentTransactions
            transactions={transactions}
            language={language}
            onUpdateTransaction={onUpdateTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>

        {/* Quick Actions: Right pane on desktop (5 cols), top on mobile */}
        <div className="order-1 lg:order-2 lg:col-span-5">
          <QuickActions
            onAddTransaction={onAddTransaction}
            onAddTransactions={onAddTransactions}
            language={language}
            activeReviewItem={activeReviewItem}
            onCompleteReview={onCompleteReview}
            onDiscardReview={onDiscardReview}
            onDismissReview={onDismissReview}
          />
        </div>
      </div>
    </div>
  );
};
