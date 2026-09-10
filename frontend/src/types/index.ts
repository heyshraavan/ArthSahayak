export type TransactionType = 'credit' | 'debit';

export type TransactionCategory =
  | 'sales'
  | 'raw_material'
  | 'operating_expense'
  | 'loan_disbursement'
  | 'capital_injection'
  | 'loan_repayment'
  | 'personal_drawings'
  | 'refund'
  | 'other';

export interface Transaction {
  id: string;
  date: string;
  party_name: string;
  item: string;
  amount: number;
  tx_type: TransactionType;
  category?: TransactionCategory | null;
}

export interface BackendTransaction {
  date: string;
  party_name: string;
  item: string;
  amount: number;
  tx_type: TransactionType;
  category?: TransactionCategory | null;
}

export interface FinanceCalculationRequest {
  transactions: BackendTransaction[];
  explicit_turnover?: number | null;
  net_operating_income: number;
  debt_service: number;
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

export interface WorkingCapitalAssessment {
  turnover: number;
  working_capital_requirement: number;
  promoter_margin: number;
  maximum_permissible_bank_finance: number;
}

export interface EntrepreneurProfile {
  name: string;
  trade: string;
  location: string;
  period: string;
}

export type NavigationTab = 'dashboard' | 'ledger' | 'appraisal' | 'schemes';

export type CalculationStatus = 'loading' | 'success' | 'error' | 'demo';
export type CalculationDataSource = 'backend' | 'local' | 'demo' | null;

export type VoiceUIState = 'idle' | 'recording' | 'processing' | 'extracted' | 'error' | 'queued_offline';

export interface TranscriptionResponse {
  transcript: string;
  confidence?: number | null;
}

export interface VoiceExtractionResponse {
  transcript: string;
  suggested_transaction: BackendTransaction;
  requires_confirmation: boolean;
}

export type OcrUIState = 'idle' | 'image_selected' | 'processing' | 'extracted' | 'error' | 'queued_offline';

export interface OcrExtractionResponse {
  suggested_transactions: BackendTransaction[];
  raw_text?: string | null;
  requires_confirmation: boolean;
}

export type QueuedMediaType = 'voice' | 'ocr';
export type QueuedMediaStatus = 'pending' | 'processing' | 'ready_for_review' | 'failed';

export interface ExtractedMediaData {
  voice?: {
    transcript: string;
    suggestedTransaction: BackendTransaction;
  };
  ocr?: {
    suggestedTransactions: BackendTransaction[];
    rawText?: string | null;
  };
}

export interface QueuedMediaItem {
  id: string;
  type: QueuedMediaType;
  createdAt: string;
  status: QueuedMediaStatus;
  dataBase64: string;
  mimeType: string;
  retryCount: number;
  errorMessage?: string;
  extractedData?: ExtractedMediaData;
}

export interface QueueStatusSummary {
  pendingCount: number;
  processingCount: number;
  readyCount: number;
  failedCount: number;
  total: number;
}

export * from './scheme';

