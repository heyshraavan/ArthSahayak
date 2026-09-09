"""Deterministic Financial Diagnostic Engine for ArthSahayak.

This module provides pure, deterministic Python calculation functions for financial
diagnostics. It strictly uses arithmetic logic and does NOT utilize LLMs or probabilistic
methods.

Prototype Accounting Conventions:
--------------------------------
1. 'credit' is interpreted as transactional cash/bank inflows (sales collections, receivables collected).
2. 'debit' is interpreted as transactional cash/bank outflows (inventory purchases, wages, overheads).
3. 'net_cash_flow' = total_credit - total_debit.
4. 'turnover': In a full accounting system, gross turnover/revenue is distinct from cash receipts.
   In this prototype, turnover can either be supplied explicitly (e.g., declared or projected revenue)
   or defaults to total_credit as a transactional inflow proxy.
5. Nayak Committee Working Capital Norms (Prototype Formulations):
   - Working Capital Requirement (WCR) = 25% of turnover (0.25 * turnover)
   - Promoter Margin = 5% of turnover (0.05 * turnover)
   - Maximum Permissible Bank Finance (MPBF) = 20% of turnover (0.20 * turnover)
6. Debt Service Coverage Ratio (DSCR):
   - DSCR = Net Operating Income / Debt Service
   - If Debt Service is 0: Returns None (unencumbered/debt-free enterprise), preventing ZeroDivisionError
     and ensuring clean JSON serialization.
   - If Debt Service < 0: Raises ValueError.
"""

from typing import Optional, Sequence
from app.schemas import FinancialSummary, Transaction, WorkingCapitalAssessment


def total_credit(transactions: Sequence[Transaction]) -> float:
    """Calculate the sum of all credit (inflow) transactions."""
    return round(sum(tx.amount for tx in transactions if tx.tx_type == "credit"), 2)


def total_debit(transactions: Sequence[Transaction]) -> float:
    """Calculate the sum of all debit (outflow) transactions."""
    return round(sum(tx.amount for tx in transactions if tx.tx_type == "debit"), 2)


def net_cash_flow(transactions: Sequence[Transaction]) -> float:
    """Calculate net cash flow: total_credit - total_debit."""
    return round(total_credit(transactions) - total_debit(transactions), 2)


def turnover(
    transactions: Sequence[Transaction],
    explicit_turnover: Optional[float] = None,
) -> float:
    """Determine turnover for financial calculations.

    If explicit_turnover is provided, it is validated and used directly.
    Otherwise, total_credit is used as the transactional inflow proxy.
    """
    if explicit_turnover is not None:
        if explicit_turnover < 0:
            raise ValueError("Turnover cannot be negative")
        return round(float(explicit_turnover), 2)
    return total_credit(transactions)


def working_capital_requirement(turnover_amount: float) -> float:
    """Calculate Working Capital Requirement as 25% of turnover."""
    if turnover_amount < 0:
        raise ValueError("Turnover cannot be negative")
    return round(0.25 * turnover_amount, 2)


def promoter_margin(turnover_amount: float) -> float:
    """Calculate Promoter Margin as 5% of turnover."""
    if turnover_amount < 0:
        raise ValueError("Turnover cannot be negative")
    return round(0.05 * turnover_amount, 2)


def maximum_permissible_bank_finance(turnover_amount: float) -> float:
    """Calculate Maximum Permissible Bank Finance (MPBF) as 20% of turnover."""
    if turnover_amount < 0:
        raise ValueError("Turnover cannot be negative")
    return round(0.20 * turnover_amount, 2)


def DSCR(net_operating_income: float, debt_service: float) -> Optional[float]:
    """Calculate Debt Service Coverage Ratio (DSCR).

    Formula: Net Operating Income / Debt Service.

    Division by zero handling:
    - If debt_service is 0.0, returns None to explicitly indicate that the enterprise
      has no current debt service obligations (debt-free), avoiding ZeroDivisionError.
    - If debt_service is negative, raises ValueError.
    """
    if debt_service < 0:
        raise ValueError("Debt service obligation cannot be negative")
    if debt_service == 0.0:
        return None
    return round(net_operating_income / debt_service, 4)


def assess_working_capital(turnover_amount: float) -> WorkingCapitalAssessment:
    """Generate structured WorkingCapitalAssessment for a given turnover."""
    return WorkingCapitalAssessment(
        turnover=round(turnover_amount, 2),
        working_capital_requirement=working_capital_requirement(turnover_amount),
        promoter_margin=promoter_margin(turnover_amount),
        maximum_permissible_bank_finance=maximum_permissible_bank_finance(turnover_amount),
    )


def compute_financial_summary(
    transactions: Sequence[Transaction],
    explicit_turnover: Optional[float] = None,
    net_operating_income: Optional[float] = None,
    debt_service: Optional[float] = None,
) -> FinancialSummary:
    """Compute complete financial summary combining ledger metrics and bank finance calculations."""
    t_credit = total_credit(transactions)
    t_debit = total_debit(transactions)
    n_flow = round(t_credit - t_debit, 2)
    t_over = turnover(transactions, explicit_turnover=explicit_turnover)

    wcr = working_capital_requirement(t_over)
    pm = promoter_margin(t_over)
    mpbf = maximum_permissible_bank_finance(t_over)

    dscr_value: Optional[float] = None
    if net_operating_income is not None and debt_service is not None:
        dscr_value = DSCR(net_operating_income, debt_service)

    return FinancialSummary(
        total_credit=t_credit,
        total_debit=t_debit,
        net_cash_flow=n_flow,
        turnover=t_over,
        working_capital_requirement=wcr,
        promoter_margin=pm,
        maximum_permissible_bank_finance=mpbf,
        dscr=dscr_value,
    )
