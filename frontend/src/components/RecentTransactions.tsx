import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  Edit3,
  MoreVertical,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { getCategoryInfo, TRANSACTION_CATEGORIES } from '../lib/categories';
import { normalizeDateString } from '../lib/dateUtils';
import type { Transaction, TransactionCategory, TransactionType } from '../types';

interface RecentTransactionsProps {
  transactions: Transaction[];
  language: 'en' | 'hi';
  onUpdateTransaction?: (tx: Transaction) => Promise<void> | void;
  onDeleteTransaction?: (id: string) => Promise<void> | void;
}

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({
  transactions,
  language,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Deletion confirmation state
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Edit modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editParty, setEditParty] = useState('');
  const [editItem, setEditItem] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<TransactionType>('credit');
  const [editCategory, setEditCategory] = useState<TransactionCategory>('sales');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Close overflow menus on outside click or escape
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuId) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-overflow-menu]')) {
        setOpenMenuId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  const handleOpenEdit = (tx: Transaction) => {
    setOpenMenuId(null);
    setEditingTx(tx);
    setEditParty(tx.party_name);
    setEditItem(tx.item);
    setEditAmount(String(tx.amount));
    setEditType(tx.tx_type);
    setEditCategory((tx.category as TransactionCategory) || (tx.tx_type === 'credit' ? 'sales' : 'raw_material'));
    setEditDate(tx.date);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !onUpdateTransaction) return;

    const numAmount = parseFloat(editAmount);
    if (!editParty.trim()) {
      setEditError(language === 'hi' ? 'पार्टी का नाम आवश्यक है।' : 'Party name is required.');
      return;
    }
    if (!editItem.trim()) {
      setEditError(language === 'hi' ? 'सामान/कार्य का विवरण आवश्यक है।' : 'Item description is required.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditError(language === 'hi' ? 'मान्य सकारात्मक राशि दर्ज करें।' : 'Please enter a valid positive amount.');
      return;
    }
    const normalizedDate = normalizeDateString(editDate);
    if (!normalizedDate) {
      setEditError(language === 'hi' ? 'मान्य तारीख (YYYY-MM-DD) दर्ज करें।' : 'Valid date (YYYY-MM-DD) is required.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updatedTx: Transaction = {
        ...editingTx,
        party_name: editParty.trim(),
        item: editItem.trim(),
        amount: numAmount,
        tx_type: editType,
        category: editCategory,
        date: normalizedDate,
      };

      await onUpdateTransaction(updatedTx);
      setEditingTx(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update transaction';
      setEditError(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTx || !onDeleteTransaction) return;
    setIsDeleting(true);
    try {
      await onDeleteTransaction(deletingTx.id);
      setDeletingTx(null);
    } catch (err) {
      console.error('Failed to delete transaction:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    return tx.tx_type === filter;
  });

  return (
    <section className="space-y-3" aria-labelledby="recent-tx-heading" ref={menuContainerRef}>
      <div className="flex items-center justify-between">
        <h2 id="recent-tx-heading" className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          {language === 'hi' ? 'हालिया लेनदेन (बही-खाता)' : 'Recent Ledger Entries'}
        </h2>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {filtered.length} {language === 'hi' ? 'प्रविष्टियाँ' : 'entries'}
        </span>
      </div>

      {/* Filter Tabs with primary Money In / Money Out labels */}
      <div className="flex rounded-lg bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-bold transition-colors" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          onClick={() => setFilter('all')}
          className={`flex-1 py-1.5 px-1.5 sm:px-3 text-center rounded-md transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          {language === 'hi' ? 'सभी' : 'All'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'credit'}
          onClick={() => setFilter('credit')}
          className={`flex-1 py-1.5 px-1 sm:px-3 text-center rounded-md transition-all cursor-pointer truncate ${
            filter === 'credit'
              ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span>{language === 'hi' ? 'पैसा आया' : 'Money In'}</span>
          <span className="hidden sm:inline text-[10px] opacity-75"> ({language === 'hi' ? 'आवक' : 'Credit'})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'debit'}
          onClick={() => setFilter('debit')}
          className={`flex-1 py-1.5 px-1 sm:px-3 text-center rounded-md transition-all cursor-pointer truncate ${
            filter === 'debit'
              ? 'bg-white dark:bg-slate-700 text-rose-800 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <span>{language === 'hi' ? 'पैसा गया' : 'Money Out'}</span>
          <span className="hidden sm:inline text-[10px] opacity-75"> ({language === 'hi' ? 'खर्च' : 'Debit'})</span>
        </button>
      </div>

      {/* Transaction List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-slate-500 dark:text-slate-400 text-xs transition-colors">
            {language === 'hi' ? 'इस श्रेणी में कोई लेनदेन नहीं है' : 'No transactions recorded in this category'}
          </div>
        ) : (
          filtered.map((tx) => {
            const isCredit = tx.tx_type === 'credit';
            const categoryInfo = getCategoryInfo(tx.category);
            const isMenuOpen = openMenuId === tx.id;

            return (
              <article
                key={tx.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex items-start justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors relative"
              >
                {/* Left: Type Icon + Separated Party and Context */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`mt-0.5 p-2 rounded-xl shrink-0 ${
                      isCredit
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {isCredit ? (
                      <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Dedicated Party Line */}
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                        {language === 'hi' ? 'पार्टी:' : 'Party:'}
                      </span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {tx.party_name}
                      </p>
                    </div>

                    {/* Dedicated Context / Item Line */}
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 shrink-0">
                        {language === 'hi' ? 'विवरण:' : 'Item:'}
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {tx.item}
                      </p>
                    </div>

                    {/* Grouped Metadata Row: Date, Money In/Out Badge, Category */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 shrink-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {tx.date}
                      </span>

                      <span
                        className={`font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 border ${
                          isCredit
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {isCredit
                          ? (language === 'hi' ? 'पैसा आया' : 'Money In')
                          : (language === 'hi' ? 'पैसा गया' : 'Money Out')}
                      </span>

                      {categoryInfo && (
                        <span
                          className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full border shrink-0 ${categoryInfo.badgeClass}`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {language === 'hi' ? categoryInfo.labelHi : categoryInfo.labelEn}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount and Overflow Menu Button */}
                <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch">
                  <p
                    className={`text-base font-black ${
                      isCredit ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN')}
                  </p>

                  {/* Overflow Menu trigger */}
                  {(onUpdateTransaction || onDeleteTransaction) && (
                    <div className="relative mt-2" data-overflow-menu>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(isMenuOpen ? null : tx.id)}
                        className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                        aria-label={
                          language === 'hi'
                            ? `${tx.party_name} लेनदेन के लिए विकल्प`
                            : `Actions for transaction with ${tx.party_name}`
                        }
                        aria-expanded={isMenuOpen}
                        aria-haspopup="true"
                        title={language === 'hi' ? 'विकल्प' : 'More options'}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                        >
                          {onUpdateTransaction && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => handleOpenEdit(tx)}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>{language === 'hi' ? 'संपादित करें' : 'Edit'}</span>
                            </button>
                          )}

                          {onDeleteTransaction && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                setDeletingTx(tx);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{language === 'hi' ? 'हटाएं' : 'Delete'}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <div className="p-2 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {language === 'hi' ? 'लेनदेन हटाएं?' : 'Delete Transaction?'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {language === 'hi' ? (
                <>
                  क्या आप निश्चित रूप से <strong className="text-slate-900 dark:text-slate-100">{deletingTx.party_name}</strong> का{' '}
                  <strong className="text-slate-900 dark:text-slate-100">₹{deletingTx.amount.toLocaleString('en-IN')}</strong> का लेनदेन बही-खाते से हटाना चाहते हैं?
                </>
              ) : (
                <>
                  Are you sure you want to delete the transaction for{' '}
                  <strong className="text-slate-900 dark:text-slate-100">₹{deletingTx.amount.toLocaleString('en-IN')}</strong> with{' '}
                  <strong className="text-slate-900 dark:text-slate-100">{deletingTx.party_name}</strong>?
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTx(null)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer min-h-[38px]"
              >
                {language === 'hi' ? 'रद्द करें' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60 min-h-[38px] flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{language === 'hi' ? 'पुष्टि करें (हटाएं)' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? 'लेनदेन संपादित करें' : 'Edit Transaction'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                aria-label="Close edit dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-3">
              {editError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Type: Money In vs Money Out */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'प्रकार (Type)' : 'Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType('credit')}
                    className={`min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      editType === 'credit'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{language === 'hi' ? 'पैसा आया (Credit)' : 'Money In (Credit)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('debit')}
                    className={`min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      editType === 'debit'
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-600 text-rose-800 dark:text-rose-300 ring-2 ring-rose-600'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{language === 'hi' ? 'पैसा गया (Debit)' : 'Money Out (Debit)'}</span>
                  </button>
                </div>
              </div>

              {/* Party Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'पार्टी / ग्राहक / विक्रेता' : 'Party / Customer / Vendor'}
                </label>
                <input
                  type="text"
                  value={editParty}
                  onChange={(e) => setEditParty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Item / Context */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'सामान / कार्य विवरण' : 'Item / Purpose / Context'}
                </label>
                <input
                  type="text"
                  value={editItem}
                  onChange={(e) => setEditItem(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'श्रेणी (Category)' : 'Category'}
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as TransactionCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {TRANSACTION_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {language === 'hi' ? cat.labelHi : `${cat.labelEn} (${cat.value})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'hi' ? 'तारीख (Date)' : 'Date'}
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingTx(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer min-h-[38px]"
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60 min-h-[38px] flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{language === 'hi' ? 'सहेजें (Save)' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
