import type { TransactionCategory, TransactionType } from '../types';

export interface CategoryInfo {
  value: TransactionCategory;
  labelEn: string;
  labelHi: string;
  defaultType: TransactionType;
  badgeClass: string;
  helperEn?: string;
  helperHi?: string;
}

export const TRANSACTION_CATEGORIES: CategoryInfo[] = [
  {
    value: 'sales',
    labelEn: 'Sales / Revenue',
    labelHi: 'बिक्री / आमदनी (Sales)',
    defaultType: 'credit',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    helperEn: 'Customer payments for products or services',
    helperHi: 'उत्पाद या सेवाओं के लिए ग्राहकों से प्राप्त भुगतान',
  },
  {
    value: 'raw_material',
    labelEn: 'Raw Material Purchase',
    labelHi: 'कच्चा माल खरीद (Raw Material)',
    defaultType: 'debit',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    helperEn: 'Supplies, inventory, stock & production materials',
    helperHi: 'कच्चा माल, स्टॉक व उत्पादन सामग्री',
  },
  {
    value: 'operating_expense',
    labelEn: 'Operating Expense',
    labelHi: 'दैनिक / संचालन खर्च (OpEx)',
    defaultType: 'debit',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/60',
    helperEn: 'Wages, food, travel, utilities & other business expenses',
    helperHi: 'मजदूरी, भोजन, यात्रा, बिजली-पानी व अन्य व्यावसायिक खर्च',
  },
  {
    value: 'loan_disbursement',
    labelEn: 'Loan Received',
    labelHi: 'ऋण राशि प्राप्त (Loan Inflow)',
    defaultType: 'credit',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
  },
  {
    value: 'capital_injection',
    labelEn: 'Capital Injection',
    labelHi: 'पूंजी निवेश (Capital)',
    defaultType: 'credit',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
  },
  {
    value: 'loan_repayment',
    labelEn: 'Loan Repayment / EMI',
    labelHi: 'ऋण / EMI भुगतान (Loan Repay)',
    defaultType: 'debit',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
  },
  {
    value: 'personal_drawings',
    labelEn: 'Personal / Household Drawings',
    labelHi: 'घर / निजी खर्च (Drawings)',
    defaultType: 'debit',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
  },
  {
    value: 'refund',
    labelEn: 'Refund / Return',
    labelHi: 'रिफंड / माल वापसी (Refund)',
    defaultType: 'credit',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60',
  },
  {
    value: 'other',
    labelEn: 'Other',
    labelHi: 'अन्य लेनदेन (Other)',
    defaultType: 'debit',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
];

export function getCategoryInfo(category?: TransactionCategory | null): CategoryInfo | undefined {
  if (!category) return undefined;
  return TRANSACTION_CATEGORIES.find((c) => c.value === category);
}
