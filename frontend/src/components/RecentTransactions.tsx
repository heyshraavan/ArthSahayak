import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar, Check, Tag, Trash2, X } from 'lucide-react';
import { getCategoryInfo } from '../lib/categories';
import type { Transaction } from '../types';

interface RecentTransactionsProps {
  transactions: Transaction[];
  language: 'en' | 'hi';
  onDeleteTransaction?: (id: string) => Promise<void> | void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  language,
  onDeleteTransaction,
}) => {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDeleteTransaction) return;
    setIsDeletingId(id);
    try {
      await onDeleteTransaction(id);
      setConfirmingId(null);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      setConfirmingId(null);
    } finally {
      setIsDeletingId(null);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.tx_type === filter;
  });

  return (
    <section className="space-y-3" aria-labelledby="recent-tx-heading">
      <div className="flex items-center justify-between">
        <h2 id="recent-tx-heading" className="text-sm font-bold text-slate-900 uppercase tracking-wider">
          {language === 'hi' ? 'हालिया लेनदेन (बही-खाता)' : 'Recent Ledger Entries'}
        </h2>
        <span className="text-xs font-semibold text-slate-500">
          {filtered.length} {language === 'hi' ? 'प्रविष्टियाँ' : 'entries'}
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex rounded-lg bg-slate-200/80 p-1 text-xs font-bold" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer ${
            filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {language === 'hi' ? 'सभी (All)' : 'All'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'credit'}
          onClick={() => setFilter('credit')}
          className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer ${
            filter === 'credit' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {language === 'hi' ? 'आवक (Inflows)' : 'Inflows (Credit)'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'debit'}
          onClick={() => setFilter('debit')}
          className={`flex-1 py-1.5 px-3 rounded-md transition-all cursor-pointer ${
            filter === 'debit' ? 'bg-white text-rose-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {language === 'hi' ? 'खर्च (Outflows)' : 'Outflows (Debit)'}
        </button>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 text-xs">
            {language === 'hi' ? 'इस श्रेणी में कोई लेनदेन नहीं है' : 'No transactions recorded in this category'}
          </div>
        ) : (
          filtered.map((tx) => {
            const isCredit = tx.tx_type === 'credit';
            const categoryInfo = getCategoryInfo(tx.category);

            return (
              <article
                key={tx.id}
                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                      isCredit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {isCredit ? (
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                      {tx.party_name}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5 truncate">{tx.item}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {tx.date}
                      </span>
                      <span
                        className={`font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isCredit ? (language === 'hi' ? 'आवक' : 'Credit') : (language === 'hi' ? 'खर्च' : 'Debit')}
                      </span>
                      {categoryInfo && (
                        <span
                          className={`flex items-center gap-1 font-medium text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${categoryInfo.badgeClass}`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {language === 'hi' ? categoryInfo.labelHi : categoryInfo.labelEn}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                  <p
                    className={`text-base font-black ${
                      isCredit ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </p>

                  {onDeleteTransaction && (
                    <div className="mt-1">
                      {confirmingId === tx.id ? (
                        <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-0.5 shadow-xs">
                          <span className="text-[10px] font-bold text-rose-700 px-1">
                            {language === 'hi' ? 'हटाएं?' : 'Delete?'}
                          </span>
                          <button
                            type="button"
                            disabled={isDeletingId === tx.id}
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 rounded bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                            aria-label={language === 'hi' ? 'हटाने की पुष्टि करें' : 'Confirm delete'}
                            title={language === 'hi' ? 'पुष्टि करें' : 'Confirm'}
                          >
                            {isDeletingId === tx.id ? (
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingId === tx.id}
                            onClick={() => setConfirmingId(null)}
                            className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                            aria-label={language === 'hi' ? 'रद्द करें' : 'Cancel'}
                            title={language === 'hi' ? 'रद्द करें' : 'Cancel'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(tx.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          aria-label={`${language === 'hi' ? 'प्रविष्टि हटाएं' : 'Delete entry'}: ${tx.party_name} ₹${tx.amount}`}
                          title={language === 'hi' ? 'प्रविष्टि हटाएं' : 'Delete entry'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};
