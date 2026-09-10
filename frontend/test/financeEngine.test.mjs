import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DSCR,
  VALID_CATEGORIES,
  assessWorkingCapital,
  calculatedOperatingSurplus,
  computeFinancialSummary,
  maximumPermissibleBankFinance,
  netCashFlow,
  operatingCosts,
  operatingRevenue,
  promoterMargin,
  pyRound,
  totalCredit,
  totalDebit,
  totalDebtService,
  turnover,
  validateTransaction,
  workingCapitalRequirement,
} from '../src/lib/financeEngine.ts';

// ============================================================================
// PART 1: Python 3 Banker's Rounding (Round-Half-to-Even) Parity Tests
// ============================================================================

test('pyRound: Banker\'s rounding on exact half ties (decimals = 0)', () => {
  // Ties round to the nearest EVEN integer
  assert.strictEqual(pyRound(0.5, 0), 0);
  assert.strictEqual(pyRound(1.5, 0), 2);
  assert.strictEqual(pyRound(2.5, 0), 2);
  assert.strictEqual(pyRound(3.5, 0), 4);
  assert.strictEqual(pyRound(4.5, 0), 4);
  assert.strictEqual(pyRound(-0.5, 0), 0);
  assert.strictEqual(pyRound(-1.5, 0), -2);
  assert.strictEqual(pyRound(-2.5, 0), -2);
  assert.strictEqual(pyRound(-3.5, 0), -4);
});

test('pyRound: Banker\'s rounding on decimal places (decimals = 2 and 4)', () => {
  // 1.125 -> exact half, 112 is even -> 1.12 (Math.round gives 1.13)
  assert.strictEqual(pyRound(1.125, 2), 1.12);
  // 1.135 -> binary float > 1.135 -> 1.14
  assert.strictEqual(pyRound(1.135, 2), 1.14);
  // 1.145 -> binary float > 1.145 -> 1.15
  assert.strictEqual(pyRound(1.145, 2), 1.15);
  // 1.155 -> binary float > 1.155 -> 1.16
  assert.strictEqual(pyRound(1.155, 2), 1.16);

  // Nayak norms rounding edge cases
  // 25% of 15000.5 = 3750.125 -> exact half, 375012 is even -> 3750.12
  assert.strictEqual(pyRound(0.25 * 15000.5, 2), 3750.12);
  // 5% of 15000.5 = 750.025... -> 750.03
  assert.strictEqual(pyRound(0.05 * 15000.5, 2), 750.03);

  // Decimal 4 DSCR precision
  assert.strictEqual(pyRound(150000.0 / 100000.0, 4), 1.5);
  assert.strictEqual(pyRound(80000.0 / 100000.0, 4), 0.8);
  assert.strictEqual(pyRound(25000.0 / 12500.0, 4), 2.0);
  assert.strictEqual(pyRound(1.23455, 4), 1.2346);
  assert.strictEqual(pyRound(1.23465, 4), 1.2347);
  assert.strictEqual(pyRound(1.23475, 4), 1.2348);
});

test('pyRound: handles zero, non-finite, and negative numbers safely', () => {
  assert.strictEqual(pyRound(0.0, 2), 0.0);
  assert.strictEqual(pyRound(-0.0, 2), 0.0);
  assert.strictEqual(pyRound(NaN, 2), NaN);
  assert.strictEqual(pyRound(Infinity, 2), Infinity);
  assert.strictEqual(pyRound(-Infinity, 2), -Infinity);
  assert.strictEqual(pyRound(-149.755, 2), -149.75);
});

// ============================================================================
// PART 2: All 19 Backend Test Cases Ported with 100% Mathematical Parity
// ============================================================================

// 1. test_normal_transactions
test('Backend Parity 1: test_normal_transactions', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Ramesh', item: 'Wooden Chair', amount: 1500.0, tx_type: 'credit' },
    { date: '2026-09-02', party_name: 'Timber Mill', item: 'Teak Wood', amount: 600.0, tx_type: 'debit' },
    { date: '2026-09-03', party_name: 'Suresh', item: 'Door Fitting', amount: 2500.0, tx_type: 'credit' },
    { date: '2026-09-04', party_name: 'Hardware Store', item: 'Nails & Glue', amount: 200.0, tx_type: 'debit' },
  ];

  assert.strictEqual(totalCredit(txs), 4000.0);
  assert.strictEqual(totalDebit(txs), 800.0);
  assert.strictEqual(netCashFlow(txs), 3200.0);
  assert.strictEqual(turnover(txs), 4000.0);
});

// 2. test_empty_transaction_list
test('Backend Parity 2: test_empty_transaction_list', () => {
  const txs = [];
  assert.strictEqual(totalCredit(txs), 0.0);
  assert.strictEqual(totalDebit(txs), 0.0);
  assert.strictEqual(netCashFlow(txs), 0.0);
  assert.strictEqual(turnover(txs), 0.0);
});

// 3. test_zero_amounts
test('Backend Parity 3: test_zero_amounts', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Kishore', item: 'Sample Consultation', amount: 0.0, tx_type: 'credit' },
    { date: '2026-09-02', party_name: 'Supplier', item: 'Free Catalog', amount: 0.0, tx_type: 'debit' },
  ];
  assert.strictEqual(totalCredit(txs), 0.0);
  assert.strictEqual(totalDebit(txs), 0.0);
  assert.strictEqual(netCashFlow(txs), 0.0);
});

// 4. test_negative_amount_rejection
test('Backend Parity 4: test_negative_amount_rejection', () => {
  assert.throws(() => {
    validateTransaction({
      date: '2026-09-01',
      party_name: 'Ramesh',
      item: 'Timber',
      amount: -500.0,
      tx_type: 'debit',
    });
  }, /non-negative/);
});

// 5. test_mixed_credit_debit_transactions
test('Backend Parity 5: test_mixed_credit_debit_transactions', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Customer A', item: 'Item 1', amount: 123.45, tx_type: 'credit' },
    { date: '2026-09-02', party_name: 'Vendor B', item: 'Raw Material', amount: 50.25, tx_type: 'debit' },
    { date: '2026-09-03', party_name: 'Customer C', item: 'Item 2', amount: 76.55, tx_type: 'credit' },
  ];
  assert.strictEqual(totalCredit(txs), 200.0);
  assert.strictEqual(totalDebit(txs), 50.25);
  assert.strictEqual(netCashFlow(txs), 149.75);
});

// 6. test_known_financial_calculation_examples
test('Backend Parity 6: test_known_financial_calculation_examples', () => {
  const annualTurnover = 1_000_000.0;
  assert.strictEqual(workingCapitalRequirement(annualTurnover), 250_000.0);
  assert.strictEqual(promoterMargin(annualTurnover), 50_000.0);
  assert.strictEqual(maximumPermissibleBankFinance(annualTurnover), 200_000.0);

  // Test explicit turnover override
  const txs = [{ date: '2026-09-01', party_name: 'Client', item: 'Project', amount: 100.0, tx_type: 'credit' }];
  assert.strictEqual(turnover(txs, 500_000.0), 500_000.0);

  // Test assessWorkingCapital structure
  const assessment = assessWorkingCapital(annualTurnover);
  assert.strictEqual(assessment.turnover, 1_000_000.0);
  assert.strictEqual(assessment.working_capital_requirement, 250_000.0);
  assert.strictEqual(assessment.promoter_margin, 50_000.0);
  assert.strictEqual(assessment.maximum_permissible_bank_finance, 200_000.0);
});

// 7. test_dscr_calculation_and_zero_debt_service
test('Backend Parity 7: test_dscr_calculation_and_zero_debt_service', () => {
  // Standard DSCR calculation: NOI = 150,000, Debt Service = 100,000 -> DSCR = 1.5
  assert.strictEqual(DSCR(150_000.0, 100_000.0), 1.5);

  // Low coverage scenario: NOI = 80,000, Debt Service = 100,000 -> DSCR = 0.8
  assert.strictEqual(DSCR(80_000.0, 100_000.0), 0.8);

  // Zero debt service: returns null (debt-free business safely, preventing division by zero)
  assert.strictEqual(DSCR(100_000.0, 0.0), null);

  // Negative debt service: invalid and throws Error
  assert.throws(() => {
    DSCR(100_000.0, -10_000.0);
  }, /cannot be negative/);
});

// 8. test_invalid_transaction_type
test('Backend Parity 8: test_invalid_transaction_type', () => {
  assert.throws(() => {
    validateTransaction({
      date: '2026-09-01',
      party_name: 'Ramesh',
      item: 'Service',
      amount: 100.0,
      tx_type: 'expense',
    });
  }, /Invalid transaction type/);

  assert.throws(() => {
    validateTransaction({
      date: '2026-09-01',
      party_name: 'Ramesh',
      item: 'Service',
      amount: 100.0,
      tx_type: 'income',
    });
  }, /Invalid transaction type/);
});

// 9. test_invalid_date
test('Backend Parity 9: test_invalid_date', () => {
  assert.throws(() => {
    validateTransaction({
      date: 'not-a-date',
      party_name: 'Ramesh',
      item: 'Service',
      amount: 100.0,
      tx_type: 'credit',
    });
  }, /Invalid transaction date format/);

  assert.throws(() => {
    validateTransaction({
      date: '2026-02-31',
      party_name: 'Ramesh',
      item: 'Service',
      amount: 100.0,
      tx_type: 'credit',
    });
  }, /Invalid calendar date/);
});

// 10. test_empty_party_name_or_item
test('Backend Parity 10: test_empty_party_name_or_item', () => {
  assert.throws(() => {
    validateTransaction({ date: '2026-09-01', party_name: '', item: 'Chair', amount: 100.0, tx_type: 'credit' });
  }, /Party name must be a non-empty string/);

  assert.throws(() => {
    validateTransaction({ date: '2026-09-01', party_name: '   ', item: 'Chair', amount: 100.0, tx_type: 'credit' });
  }, /Party name must be a non-empty string/);

  assert.throws(() => {
    validateTransaction({ date: '2026-09-01', party_name: 'Ramesh', item: '', amount: 100.0, tx_type: 'credit' });
  }, /Item must be a non-empty string/);

  assert.throws(() => {
    validateTransaction({ date: '2026-09-01', party_name: 'Ramesh', item: '   ', amount: 100.0, tx_type: 'credit' });
  }, /Item must be a non-empty string/);
});

// 11. test_negative_turnover_rejection
test('Backend Parity 11: test_negative_turnover_rejection', () => {
  assert.throws(() => workingCapitalRequirement(-1000.0), /Turnover cannot be negative/);
  assert.throws(() => promoterMargin(-1000.0), /Turnover cannot be negative/);
  assert.throws(() => maximumPermissibleBankFinance(-1000.0), /Turnover cannot be negative/);
  assert.throws(() => turnover([], -500.0), /Turnover cannot be negative/);
});

// 12. test_compute_financial_summary
test('Backend Parity 12: test_compute_financial_summary', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Client A', item: 'Job A', amount: 60_000.0, tx_type: 'credit' },
    { date: '2026-09-02', party_name: 'Supplier B', item: 'Goods B', amount: 20_000.0, tx_type: 'debit' },
  ];

  // Without explicit DSCR inputs
  const summary = computeFinancialSummary(txs);
  assert.strictEqual(summary.total_credit, 60_000.0);
  assert.strictEqual(summary.total_debit, 20_000.0);
  assert.strictEqual(summary.net_cash_flow, 40_000.0);
  assert.strictEqual(summary.turnover, 60_000.0);
  assert.strictEqual(summary.working_capital_requirement, 15_000.0);
  assert.strictEqual(summary.promoter_margin, 3_000.0);
  assert.strictEqual(summary.maximum_permissible_bank_finance, 12_000.0);
  assert.strictEqual(summary.dscr, null);

  // With explicit turnover and DSCR inputs
  const summaryWithDscr = computeFinancialSummary(
    txs,
    100_000.0,
    25_000.0,
    12_500.0,
  );
  assert.strictEqual(summaryWithDscr.turnover, 100_000.0);
  assert.strictEqual(summaryWithDscr.working_capital_requirement, 25_000.0);
  assert.strictEqual(summaryWithDscr.promoter_margin, 5_000.0);
  assert.strictEqual(summaryWithDscr.maximum_permissible_bank_finance, 20_000.0);
  assert.strictEqual(summaryWithDscr.dscr, 2.0);
});

// 13. test_categorized_turnover_excludes_loans_and_capital_injections
test('Backend Parity 13: test_categorized_turnover_excludes_loans_and_capital_injections', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Customer A', item: 'Chair', amount: 40_000.0, tx_type: 'credit', category: 'sales' },
    { date: '2026-09-02', party_name: 'Rural Bank', item: 'Loan Disbursement', amount: 50_000.0, tx_type: 'credit', category: 'loan_disbursement' },
    { date: '2026-09-03', party_name: 'Owner', item: 'Personal Savings', amount: 10_000.0, tx_type: 'credit', category: 'capital_injection' },
  ];
  assert.strictEqual(totalCredit(txs), 100_000.0);
  assert.strictEqual(turnover(txs), 40_000.0);
  assert.strictEqual(operatingRevenue(txs), 40_000.0);
});

// 14. test_legacy_uncategorized_turnover_fallback
test('Backend Parity 14: test_legacy_uncategorized_turnover_fallback', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Customer A', item: 'Table', amount: 15_000.0, tx_type: 'credit', category: null },
    { date: '2026-09-02', party_name: 'Customer B', item: 'Desk', amount: 10_000.0, tx_type: 'credit', category: null },
  ];
  assert.strictEqual(totalCredit(txs), 25_000.0);
  assert.strictEqual(turnover(txs), 25_000.0);
});

// 15. test_distinction_between_zero_categorized_sales_and_legacy_uncategorized
test('Backend Parity 15: test_distinction_between_zero_categorized_sales_and_legacy_uncategorized', () => {
  // Case A: Categorized dataset with NO sales (only loan received)
  const categorizedNoSales = [
    { date: '2026-09-01', party_name: 'Bank', item: 'MFI Loan', amount: 50_000.0, tx_type: 'credit', category: 'loan_disbursement' },
  ];
  assert.strictEqual(totalCredit(categorizedNoSales), 50_000.0);
  // Must evaluate to 0.0, NOT falling back to total_credit
  assert.strictEqual(turnover(categorizedNoSales), 0.0);

  // Case B: Legacy uncategorized dataset with identical amount
  const legacyTxs = [
    { date: '2026-09-01', party_name: 'Bank', item: 'MFI Loan', amount: 50_000.0, tx_type: 'credit', category: null },
  ];
  assert.strictEqual(totalCredit(legacyTxs), 50_000.0);
  assert.strictEqual(turnover(legacyTxs), 50_000.0);
});

// 16. test_operating_surplus_calculation
test('Backend Parity 16: test_operating_surplus_calculation', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Client', item: 'Furniture Sale', amount: 80_000.0, tx_type: 'credit', category: 'sales' },
    { date: '2026-09-02', party_name: 'Timber Depot', item: 'Teak Planks', amount: 30_000.0, tx_type: 'debit', category: 'raw_material' },
    { date: '2026-09-03', party_name: 'Workshop Landlord', item: 'Monthly Rent', amount: 15_000.0, tx_type: 'debit', category: 'operating_expense' },
  ];
  assert.strictEqual(operatingRevenue(txs), 80_000.0);
  assert.strictEqual(operatingCosts(txs), 45_000.0);
  assert.strictEqual(calculatedOperatingSurplus(txs), 35_000.0);
});

// 17. test_loan_repayment_and_personal_drawings_excluded_from_operating_costs
test('Backend Parity 17: test_loan_repayment_and_personal_drawings_excluded_from_operating_costs', () => {
  const txs = [
    { date: '2026-09-01', party_name: 'Timber Mill', item: 'Wood', amount: 20_000.0, tx_type: 'debit', category: 'raw_material' },
    { date: '2026-09-02', party_name: 'Electricity Board', item: 'Power', amount: 5_000.0, tx_type: 'debit', category: 'operating_expense' },
    { date: '2026-09-03', party_name: 'Bank', item: 'Loan EMI', amount: 10_000.0, tx_type: 'debit', category: 'loan_repayment' },
    { date: '2026-09-04', party_name: 'Owner Household', item: 'Household Expenses', amount: 8_000.0, tx_type: 'debit', category: 'personal_drawings' },
  ];
  assert.strictEqual(totalDebit(txs), 43_000.0);
  assert.strictEqual(operatingCosts(txs), 25_000.0);
  assert.strictEqual(totalDebtService(txs), 10_000.0);
});

// 18. test_invalid_category_rejected
test('Backend Parity 18: test_invalid_category_rejected', () => {
  assert.throws(() => {
    validateTransaction({
      date: '2026-09-01',
      party_name: 'Party',
      item: 'Item',
      amount: 100.0,
      tx_type: 'credit',
      category: 'invalid_category',
    });
  }, /Invalid transaction category/);
});

// 19. test_all_valid_categories_accepted
test('Backend Parity 19: test_all_valid_categories_accepted', () => {
  const validCategories = [
    'sales',
    'raw_material',
    'operating_expense',
    'loan_disbursement',
    'capital_injection',
    'loan_repayment',
    'personal_drawings',
    'refund',
    'other',
  ];
  for (const cat of validCategories) {
    assert.strictEqual(VALID_CATEGORIES.has(cat), true);
    validateTransaction({
      date: '2026-09-01',
      party_name: 'Test Party',
      item: 'Test Item',
      amount: 100.0,
      tx_type: 'credit',
      category: cat,
    });
  }
});

// ============================================================================
// PART 3: Debt-Service Provenance & Guardrail Verification
// ============================================================================

test('DSCR Provenance: Zero sales with large loan repayment ensures DSCR is 0.0, NOT fabricated positive', () => {
  // A ledger with zero sales and a large loan repayment
  const distressedLedger = [
    { date: '2026-09-01', party_name: 'Supplier', item: 'Old Stock', amount: 5000.0, tx_type: 'debit', category: 'raw_material' },
    { date: '2026-09-02', party_name: 'Rural Bank', item: 'Monthly EMI', amount: 15000.0, tx_type: 'debit', category: 'loan_repayment' },
  ];

  const debtService = totalDebtService(distressedLedger);
  assert.strictEqual(debtService, 15000.0);

  const opSurplus = calculatedOperatingSurplus(distressedLedger);
  assert.strictEqual(opSurplus, -5000.0);

  // Preserved negative operating surplus (operational deficit without Math.max clamping):
  const derivedNOI = opSurplus;
  assert.strictEqual(derivedNOI, -5000.0);

  // DSCR calculation: -5000.0 / 15000.0 = -0.3333 (truthful negative coverage, NOT fabricated 2.0!)
  const dscr = DSCR(derivedNOI, debtService);
  assert.strictEqual(dscr, -0.3333);
  assert.ok(dscr < 0, 'DSCR must evaluate to negative ratio during operational deficit');

  // Full summary compilation with negative NOI
  const summary = computeFinancialSummary(distressedLedger, null, derivedNOI, debtService);
  assert.strictEqual(summary.turnover, 0.0);
  assert.strictEqual(summary.working_capital_requirement, 0.0);
  assert.strictEqual(summary.promoter_margin, 0.0);
  assert.strictEqual(summary.maximum_permissible_bank_finance, 0.0);
  assert.strictEqual(summary.dscr, -0.3333);

  // Case B: Zero sales and zero operating expenses (only debt repayment recorded)
  const zeroExpenseLedger = [
    { date: '2026-09-02', party_name: 'Rural Bank', item: 'Monthly EMI', amount: 15000.0, tx_type: 'debit', category: 'loan_repayment' },
  ];
  const zeroNOI = calculatedOperatingSurplus(zeroExpenseLedger);
  assert.strictEqual(zeroNOI, 0.0);
  const zeroDSCR = DSCR(zeroNOI, 15000.0);
  assert.strictEqual(zeroDSCR, 0.0);
});

test('DSCR Provenance: Debt-free enterprise returns null DSCR', () => {
  const debtFreeLedger = [
    { date: '2026-09-01', party_name: 'Customer', item: 'Product Sale', amount: 20000.0, tx_type: 'credit', category: 'sales' },
    { date: '2026-09-02', party_name: 'Supplier', item: 'Materials', amount: 5000.0, tx_type: 'debit', category: 'raw_material' },
  ];

  const debtService = totalDebtService(debtFreeLedger);
  assert.strictEqual(debtService, 0.0);

  const derivedNOI = calculatedOperatingSurplus(debtFreeLedger);
  assert.strictEqual(derivedNOI, 15000.0);

  // Debt service = 0.0 -> DSCR is null (debt-free)
  const dscr = DSCR(derivedNOI, debtService);
  assert.strictEqual(dscr, null);

  const summary = computeFinancialSummary(debtFreeLedger, null, derivedNOI, debtService);
  assert.strictEqual(summary.dscr, null);
});
