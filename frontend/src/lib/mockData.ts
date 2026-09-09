import type { EntrepreneurProfile, FinancialSummary, Transaction } from '../types';


/**
 * Clearly marked mock/demo profile for prototype presentation.
 * Represents rural artisan Ramesh (SIH 2026 ProtoFin persona).
 */
export const DEMO_PROFILE: EntrepreneurProfile = {
  name: 'Ramesh Sharma',
  trade: 'Carpentry & Woodcraft',
  location: 'Purulia, West Bengal',
  period: 'FY 2025-26 (Last 6 Months)',
};

/**
 * Clearly marked demo financial summary.
 * NOTICE: These are local client mock values for initial UI verification.
 * Replacing this with the live response from POST /finance/calculate is straightforward.
 */
export const DEMO_FINANCIAL_SUMMARY: FinancialSummary = {
  total_credit: 42500,
  total_debit: 14200,
  net_cash_flow: 28300,
  turnover: 42500,
  working_capital_requirement: 10625, // 25% of turnover
  promoter_margin: 2125,              // 5% of turnover
  maximum_permissible_bank_finance: 8500, // 20% of turnover (MPBF)
  dscr: 1.85,                         // 1.85x coverage
};

/**
 * Clearly marked mock transactions representing informal bahi-khata ledger entries.
 */
export const DEMO_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    date: '2026-09-08',
    party_name: 'Anil Babu (School)',
    item: '2 Desks & Benches',
    amount: 14000,
    tx_type: 'credit',
    category: 'sales',
  },
  {
    id: 'tx-2',
    date: '2026-09-06',
    party_name: 'Maa Tara Timber Depot',
    item: 'Sal & Teak Planks',
    amount: 7500,
    tx_type: 'debit',
    category: 'raw_material',
  },
  {
    id: 'tx-3',
    date: '2026-09-05',
    party_name: 'Gopal Hardware',
    item: 'Fevicol, Screws, Hinges',
    amount: 1700,
    tx_type: 'debit',
    category: 'raw_material',
  },
  {
    id: 'tx-4',
    date: '2026-09-03',
    party_name: 'Village Pradhan Office',
    item: 'Door Frame Fitting',
    amount: 8500,
    tx_type: 'credit',
    category: 'sales',
  },
  {
    id: 'tx-5',
    date: '2026-09-01',
    party_name: 'Biren Da (Assistant)',
    item: 'Weekly Wages',
    amount: 5000,
    tx_type: 'debit',
    category: 'operating_expense',
  },
  {
    id: 'tx-6',
    date: '2026-08-28',
    party_name: 'Suman Roy (Kirana Store)',
    item: 'Display Counter Payment',
    amount: 20000,
    tx_type: 'credit',
    category: 'sales',
  },
];
