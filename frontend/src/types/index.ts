export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id: string;
  date: string;
  party_name: string;
  item: string;
  amount: number;
  tx_type: TransactionType;
}

export interface FinancialSummary {
  total_credit: number;
  total_debit: number;
  net_cash_flow: number;
  turnover: number;
  working_capital_requirement: number;
  promoter_margin: number;
  maximum_permissible_bank_finance: number;
  dscr: number | null;
}

export interface EntrepreneurProfile {
  name: string;
  trade: string;
  location: string;
  period: string;
}

export type NavigationTab = 'dashboard' | 'ledger' | 'appraisal' | 'schemes';
