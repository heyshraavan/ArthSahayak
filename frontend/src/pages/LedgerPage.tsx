import React from 'react';
import { QuickActions } from '../components/QuickActions';
import { RecentTransactions } from '../components/RecentTransactions';
import type { QueuedMediaItem, Transaction } from '../types';

interface LedgerPageProps {
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

export const LedgerPage: React.FC<LedgerPageProps> = ({
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
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <h1 className="text-base font-bold text-slate-900">
          {language === 'hi' ? 'डिजिटल बही-खाता (Ledger)' : 'Digital Bahi-Khata (Ledger)'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {language === 'hi'
            ? 'आपकी सभी लेन-देन प्रविष्टियाँ (आवक और खर्च) यहाँ सुरक्षित हैं।'
            : 'All recorded informal cash receipts and operational expenses in one place.'}
        </p>
      </div>

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
  );
};
