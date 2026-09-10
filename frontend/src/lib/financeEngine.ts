/**
 * Deterministic Financial Diagnostic Engine for ArthSahayak (Frontend Mirror).
 *
 * This module provides pure, deterministic TypeScript calculation functions for financial
 * diagnostics with 100% mathematical parity to backend/app/finance_engine.py.
 * Strictly uses arithmetic logic and does NOT utilize LLMs or probabilistic methods.
 *
 * Accounting Conventions:
 * -----------------------
 * 1. 'credit' is interpreted as transactional cash/bank inflows (sales collections, receivables).
 * 2. 'debit' is interpreted as transactional cash/bank outflows (inventory, wages, overheads).
 * 3. 'net_cash_flow' = total_credit - total_debit.
 * 4. 'turnover':
 *    - Priority 1: explicit_turnover (if provided and >= 0).
 *    - Priority 2: If at least one transaction is categorized, evaluates strictly to operating_revenue
 *      (sum of 'sales'). If no sales exist, turnover evaluates strictly to 0.0.
 *    - Priority 3: Legacy fallback: if all transactions have category=null (or empty list),
 *      evaluates to total_credit.
 * 5. Nayak Committee Working Capital Norms:
 *    - Working Capital Requirement (WCR) = 25% of turnover (0.25 * turnover)
 *    - Promoter Margin = 5% of turnover (0.05 * turnover)
 *    - Maximum Permissible Bank Finance (MPBF) = 20% of turnover (0.20 * turnover)
 * 6. Debt Service Coverage Ratio (DSCR):
 *    - DSCR = Net Operating Income / Debt Service
 *    - If Debt Service is 0: Returns null (unencumbered/debt-free enterprise).
 *    - If Debt Service < 0: Throws Error.
 * 7. Python Banker's Rounding (Round-Half-to-Even):
 *    - Python 3's built-in round() implements IEEE 754 half-even rounding.
 *    - Math.round() in JS rounds half toward +infinity, which violates parity.
 *    - pyRound() faithfully matches Python 3's round(val, n).
 */

import type {
  FinancialSummary,
  TransactionCategory,
  TransactionType,
  WorkingCapitalAssessment,
} from '../types';

export interface TransactionLike {
  amount: number;
  tx_type: TransactionType;
  category?: TransactionCategory | null;
  date?: string;
  party_name?: string;
  item?: string;
}

export const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'sales',
  'raw_material',
  'operating_expense',
  'loan_disbursement',
  'capital_injection',
  'loan_repayment',
  'personal_drawings',
  'refund',
  'other',
]);

/**
 * Validates a transaction object against schema requirements matching backend Pydantic models.
 */
export function validateTransaction(tx: TransactionLike): void {
  if (typeof tx.amount !== 'number' || !Number.isFinite(tx.amount) || tx.amount < 0) {
    throw new Error('Transaction amount must be a non-negative number');
  }

  if (tx.tx_type !== 'credit' && tx.tx_type !== 'debit') {
    throw new Error(`Invalid transaction type: ${tx.tx_type}. Must be 'credit' or 'debit'`);
  }

  if (tx.category !== undefined && tx.category !== null) {
    if (!VALID_CATEGORIES.has(tx.category)) {
      throw new Error(`Invalid transaction category: ${tx.category}`);
    }
  }

  if (tx.party_name !== undefined) {
    if (typeof tx.party_name !== 'string' || tx.party_name.trim().length === 0) {
      throw new Error('Party name must be a non-empty string');
    }
  }

  if (tx.item !== undefined) {
    if (typeof tx.item !== 'string' || tx.item.trim().length === 0) {
      throw new Error('Item must be a non-empty string');
    }
  }

  if (tx.date !== undefined) {
    if (typeof tx.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
      throw new Error(`Invalid transaction date format: ${tx.date}. Expected YYYY-MM-DD`);
    }
    const [year, month, day] = tx.date.split('-').map((n) => parseInt(n, 10));
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (
      parsedDate.getUTCFullYear() !== year ||
      parsedDate.getUTCMonth() !== month - 1 ||
      parsedDate.getUTCDate() !== day
    ) {
      throw new Error(`Invalid calendar date: ${tx.date}`);
    }
  }
}

/**
 * Python 3 Banker's Rounding (Round-Half-to-Even) implementation.
 *
 * Guarantees exact parity with Python's built-in round(val, decimals).
 * Uses exact decimal expansion to prevent JS binary-float multiplication drift.
 */
export function pyRound(val: number, decimals: number = 0): number {
  if (!Number.isFinite(val)) return val;
  if (val === 0) return 0;

  const isNeg = val < 0;
  const absVal = Math.abs(val);

  // Exact IEEE 754 decimal expansion via toFixed(20)
  const s = absVal.toFixed(20);
  const dotIndex = s.indexOf('.');

  if (decimals === 0) {
    const intPartStr = dotIndex === -1 ? s : s.slice(0, dotIndex);
    let intPart = BigInt(intPartStr);
    const fracPart = dotIndex === -1 ? '' : s.slice(dotIndex + 1);

    if (fracPart.length > 0) {
      const firstFrac = parseInt(fracPart[0], 10);
      if (firstFrac > 5) {
        intPart += 1n;
      } else if (firstFrac === 5) {
        const restNonZero = fracPart.slice(1).split('').some((c) => c !== '0');
        if (restNonZero) {
          intPart += 1n;
        } else {
          // Exactly half: round to nearest even integer
          if (intPart % 2n !== 0n) {
            intPart += 1n;
          }
        }
      }
    }
    const num = Number(intPart);
    if (num === 0) return 0;
    return isNeg ? -num : num;
  }

  const [intPart, fracPart = ''] = s.split('.');
  const paddedFrac = fracPart.padEnd(decimals + 20, '0');

  const keptDigits = intPart + paddedFrac.slice(0, decimals);
  let keptBig = BigInt(keptDigits);

  const checkDigit = parseInt(paddedFrac[decimals], 10);
  const restStr = paddedFrac.slice(decimals + 1);
  const restNonZero = restStr.split('').some((c) => c !== '0');

  if (checkDigit > 5) {
    keptBig += 1n;
  } else if (checkDigit === 5) {
    if (restNonZero) {
      keptBig += 1n;
    } else {
      // Exactly half: round to nearest even integer
      if (keptBig % 2n !== 0n) {
        keptBig += 1n;
      }
    }
  }

  const factor = Math.pow(10, decimals);
  const res = Number(keptBig) / factor;
  if (res === 0) return 0;
  return isNeg ? -res : res;
}

/**
 * Calculate the sum of all credit (inflow) transactions.
 */
export function totalCredit(transactions: readonly TransactionLike[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.tx_type === 'credit') {
      sum += tx.amount;
    }
  }
  return pyRound(sum, 2);
}

/**
 * Calculate the sum of all debit (outflow) transactions.
 */
export function totalDebit(transactions: readonly TransactionLike[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.tx_type === 'debit') {
      sum += tx.amount;
    }
  }
  return pyRound(sum, 2);
}

/**
 * Calculate net cash flow: total_credit - total_debit.
 */
export function netCashFlow(transactions: readonly TransactionLike[]): number {
  return pyRound(totalCredit(transactions) - totalDebit(transactions), 2);
}

/**
 * Calculate operating revenue as the sum of transactions categorized as 'sales'.
 */
export function operatingRevenue(transactions: readonly TransactionLike[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.category === 'sales') {
      sum += tx.amount;
    }
  }
  return pyRound(sum, 2);
}

/**
 * Calculate operating costs as direct raw materials plus operating expenses.
 * Loan repayments (debt service) and personal drawings are strictly excluded.
 */
export function operatingCosts(transactions: readonly TransactionLike[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.category === 'raw_material' || tx.category === 'operating_expense') {
      sum += tx.amount;
    }
  }
  return pyRound(sum, 2);
}

/**
 * Calculate prototype operating surplus: operating_revenue - operating_costs.
 */
export function calculatedOperatingSurplus(transactions: readonly TransactionLike[]): number {
  return pyRound(operatingRevenue(transactions) - operatingCosts(transactions), 2);
}

/**
 * Calculate total recorded debt service: sum of transactions categorized as 'loan_repayment'.
 */
export function totalDebtService(transactions: readonly TransactionLike[]): number {
  let sum = 0;
  for (const tx of transactions) {
    if (tx.category === 'loan_repayment') {
      sum += tx.amount;
    }
  }
  return pyRound(sum, 2);
}

/**
 * Determine turnover for financial calculations.
 *
 * Hierarchy of evaluation:
 * 1. Explicit turnover takes highest priority: validated (>= 0) and used directly.
 * 2. Categorized transactions: if at least one transaction has a category specified,
 *    evaluates strictly to operating_revenue (sum of 'sales'). If no sales, evaluates to 0.0.
 * 3. Legacy uncategorized fallback: if ALL transactions have category=null (or list is empty),
 *    evaluates to totalCredit(transactions).
 */
export function turnover(
  transactions: readonly TransactionLike[],
  explicitTurnover?: number | null,
): number {
  if (explicitTurnover !== null && explicitTurnover !== undefined) {
    if (explicitTurnover < 0) {
      throw new Error('Turnover cannot be negative');
    }
    return pyRound(explicitTurnover, 2);
  }

  const hasCategorized = transactions.some(
    (tx) => tx.category !== null && tx.category !== undefined,
  );
  if (hasCategorized) {
    return operatingRevenue(transactions);
  }

  return totalCredit(transactions);
}

/**
 * Calculate Working Capital Requirement as 25% of turnover.
 */
export function workingCapitalRequirement(turnoverAmount: number): number {
  if (turnoverAmount < 0) {
    throw new Error('Turnover cannot be negative');
  }
  return pyRound(0.25 * turnoverAmount, 2);
}

/**
 * Calculate Promoter Margin as 5% of turnover.
 */
export function promoterMargin(turnoverAmount: number): number {
  if (turnoverAmount < 0) {
    throw new Error('Turnover cannot be negative');
  }
  return pyRound(0.05 * turnoverAmount, 2);
}

/**
 * Calculate Maximum Permissible Bank Finance (MPBF) as 20% of turnover.
 */
export function maximumPermissibleBankFinance(turnoverAmount: number): number {
  if (turnoverAmount < 0) {
    throw new Error('Turnover cannot be negative');
  }
  return pyRound(0.20 * turnoverAmount, 2);
}

/**
 * Calculate Debt Service Coverage Ratio (DSCR).
 *
 * Formula: Net Operating Income / Debt Service.
 *
 * Division by zero handling:
 * - If debtService is 0.0, returns null (debt-free business).
 * - If debtService is negative, throws Error.
 */
export function DSCR(netOperatingIncome: number, debtService: number): number | null {
  if (debtService < 0) {
    throw new Error('Debt service obligation cannot be negative');
  }
  if (debtService === 0.0) {
    return null;
  }
  return pyRound(netOperatingIncome / debtService, 4);
}

/**
 * Generate structured WorkingCapitalAssessment for a given turnover.
 */
export function assessWorkingCapital(turnoverAmount: number): WorkingCapitalAssessment {
  return {
    turnover: pyRound(turnoverAmount, 2),
    working_capital_requirement: workingCapitalRequirement(turnoverAmount),
    promoter_margin: promoterMargin(turnoverAmount),
    maximum_permissible_bank_finance: maximumPermissibleBankFinance(turnoverAmount),
  };
}

/**
 * Compute complete financial summary combining ledger metrics and bank finance calculations.
 */
export function computeFinancialSummary(
  transactions: readonly TransactionLike[],
  explicitTurnover?: number | null,
  netOperatingIncome?: number | null,
  debtService?: number | null,
): FinancialSummary {
  const tCredit = totalCredit(transactions);
  const tDebit = totalDebit(transactions);
  const nFlow = pyRound(tCredit - tDebit, 2);
  const tOver = turnover(transactions, explicitTurnover);

  const wcr = workingCapitalRequirement(tOver);
  const pm = promoterMargin(tOver);
  const mpbf = maximumPermissibleBankFinance(tOver);

  let dscrValue: number | null = null;
  if (
    netOperatingIncome !== null &&
    netOperatingIncome !== undefined &&
    debtService !== null &&
    debtService !== undefined
  ) {
    dscrValue = DSCR(netOperatingIncome, debtService);
  }

  return {
    total_credit: tCredit,
    total_debit: tDebit,
    net_cash_flow: nFlow,
    turnover: tOver,
    working_capital_requirement: wcr,
    promoter_margin: pm,
    maximum_permissible_bank_finance: mpbf,
    dscr: dscrValue,
  };
}
