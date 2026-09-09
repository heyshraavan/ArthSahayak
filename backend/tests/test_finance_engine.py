from datetime import date
import pytest
from pydantic import ValidationError

from app.finance_engine import (
    DSCR,
    assess_working_capital,
    calculated_operating_surplus,
    compute_financial_summary,
    maximum_permissible_bank_finance,
    net_cash_flow,
    operating_costs,
    operating_revenue,
    promoter_margin,
    total_credit,
    total_debit,
    turnover,
    working_capital_requirement,
)
from app.schemas import Transaction, TransactionCategory



def test_normal_transactions():
    """Verify standard sequence of credit and debit transactions."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="Wooden Chair", amount=1500.0, tx_type="credit"),
        Transaction(date=date(2026, 9, 2), party_name="Timber Mill", item="Teak Wood", amount=600.0, tx_type="debit"),
        Transaction(date=date(2026, 9, 3), party_name="Suresh", item="Door Fitting", amount=2500.0, tx_type="credit"),
        Transaction(date=date(2026, 9, 4), party_name="Hardware Store", item="Nails & Glue", amount=200.0, tx_type="debit"),
    ]

    assert total_credit(txs) == 4000.0
    assert total_debit(txs) == 800.0
    assert net_cash_flow(txs) == 3200.0
    assert turnover(txs) == 4000.0


def test_empty_transaction_list():
    """Verify that an empty transaction list returns zero for totals."""
    txs = []
    assert total_credit(txs) == 0.0
    assert total_debit(txs) == 0.0
    assert net_cash_flow(txs) == 0.0
    assert turnover(txs) == 0.0


def test_zero_amounts():
    """Verify handling of zero amount transactions."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Kishore", item="Sample Consultation", amount=0.0, tx_type="credit"),
        Transaction(date=date(2026, 9, 2), party_name="Supplier", item="Free Catalog", amount=0.0, tx_type="debit"),
    ]
    assert total_credit(txs) == 0.0
    assert total_debit(txs) == 0.0
    assert net_cash_flow(txs) == 0.0


def test_negative_amount_rejection():
    """Verify that negative amounts are rejected by Pydantic validation."""
    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="Timber", amount=-500.0, tx_type="debit")


def test_mixed_credit_debit_transactions():
    """Verify mixed transactions with floating point cents/paise."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Customer A", item="Item 1", amount=123.45, tx_type="credit"),
        Transaction(date=date(2026, 9, 2), party_name="Vendor B", item="Raw Material", amount=50.25, tx_type="debit"),
        Transaction(date=date(2026, 9, 3), party_name="Customer C", item="Item 2", amount=76.55, tx_type="credit"),
    ]
    assert total_credit(txs) == 200.0
    assert total_debit(txs) == 50.25
    assert net_cash_flow(txs) == 149.75


def test_known_financial_calculation_examples():
    """Verify known reference calculations for Nayak Working Capital norms.

    Reference: Turnover = 1,000,000
    - Working Capital Requirement (25%) = 250,000
    - Promoter Margin (5%) = 50,000
    - Maximum Permissible Bank Finance (20%) = 200,000
    """
    annual_turnover = 1_000_000.0
    assert working_capital_requirement(annual_turnover) == 250_000.0
    assert promoter_margin(annual_turnover) == 50_000.0
    assert maximum_permissible_bank_finance(annual_turnover) == 200_000.0

    # Test explicit turnover override
    txs = [Transaction(date=date(2026, 9, 1), party_name="Client", item="Project", amount=100.0, tx_type="credit")]
    assert turnover(txs, explicit_turnover=500_000.0) == 500_000.0

    # Test WorkingCapitalAssessment schema generation
    assessment = assess_working_capital(annual_turnover)
    assert assessment.turnover == 1_000_000.0
    assert assessment.working_capital_requirement == 250_000.0
    assert assessment.promoter_margin == 50_000.0
    assert assessment.maximum_permissible_bank_finance == 200_000.0


def test_dscr_calculation_and_zero_debt_service():
    """Verify DSCR computation, positive debt service, and zero division guardrail."""
    # Standard DSCR calculation: NOI = 150,000, Debt Service = 100,000 -> DSCR = 1.5
    assert DSCR(net_operating_income=150_000.0, debt_service=100_000.0) == 1.5

    # Low coverage scenario: NOI = 80,000, Debt Service = 100,000 -> DSCR = 0.8
    assert DSCR(net_operating_income=80_000.0, debt_service=100_000.0) == 0.8

    # Zero debt service: returns None to signal unencumbered/debt-free business safely
    assert DSCR(net_operating_income=100_000.0, debt_service=0.0) is None

    # Negative debt service: invalid and raises ValueError
    with pytest.raises(ValueError, match="cannot be negative"):
        DSCR(net_operating_income=100_000.0, debt_service=-10_000.0)


def test_invalid_transaction_type():
    """Verify that tx_type must strictly be 'credit' or 'debit'."""
    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="Service", amount=100.0, tx_type="expense")  # type: ignore

    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="Service", amount=100.0, tx_type="income")  # type: ignore


def test_invalid_date():
    """Verify that invalid dates fail Pydantic validation."""
    with pytest.raises(ValidationError):
        Transaction(date="not-a-date", party_name="Ramesh", item="Service", amount=100.0, tx_type="credit")  # type: ignore

    with pytest.raises(ValidationError):
        Transaction(date="2026-02-31", party_name="Ramesh", item="Service", amount=100.0, tx_type="credit")  # type: ignore


def test_empty_party_name_or_item():
    """Verify that empty strings or whitespace-only names/items are rejected."""
    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="", item="Chair", amount=100.0, tx_type="credit")

    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="   ", item="Chair", amount=100.0, tx_type="credit")

    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="", amount=100.0, tx_type="credit")

    with pytest.raises(ValidationError):
        Transaction(date=date(2026, 9, 1), party_name="Ramesh", item="   ", amount=100.0, tx_type="credit")


def test_negative_turnover_rejection():
    """Verify negative turnover inputs are rejected across banking calculations."""
    with pytest.raises(ValueError, match="Turnover cannot be negative"):
        working_capital_requirement(-1000.0)

    with pytest.raises(ValueError, match="Turnover cannot be negative"):
        promoter_margin(-1000.0)

    with pytest.raises(ValueError, match="Turnover cannot be negative"):
        maximum_permissible_bank_finance(-1000.0)

    with pytest.raises(ValueError, match="Turnover cannot be negative"):
        turnover([], explicit_turnover=-500.0)


def test_compute_financial_summary():
    """Verify comprehensive financial summary compilation."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Client A", item="Job A", amount=60_000.0, tx_type="credit"),
        Transaction(date=date(2026, 9, 2), party_name="Supplier B", item="Goods B", amount=20_000.0, tx_type="debit"),
    ]

    # Without explicit DSCR inputs
    summary = compute_financial_summary(txs)
    assert summary.total_credit == 60_000.0
    assert summary.total_debit == 20_000.0
    assert summary.net_cash_flow == 40_000.0
    assert summary.turnover == 60_000.0
    assert summary.working_capital_requirement == 15_000.0
    assert summary.promoter_margin == 3_000.0
    assert summary.maximum_permissible_bank_finance == 12_000.0
    assert summary.dscr is None

    # With explicit turnover and DSCR inputs
    summary_with_dscr = compute_financial_summary(
        txs,
        explicit_turnover=100_000.0,
        net_operating_income=25_000.0,
        debt_service=12_500.0,
    )
    assert summary_with_dscr.turnover == 100_000.0
    assert summary_with_dscr.working_capital_requirement == 25_000.0
    assert summary_with_dscr.promoter_margin == 5_000.0
    assert summary_with_dscr.maximum_permissible_bank_finance == 20_000.0
    assert summary_with_dscr.dscr == 2.0


def test_categorized_turnover_excludes_loans_and_capital_injections():
    """Verify that categorized turnover includes only sales, excluding loans and equity."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Customer A", item="Chair", amount=40_000.0, tx_type="credit", category="sales"),
        Transaction(date=date(2026, 9, 2), party_name="Rural Bank", item="Loan Disbursement", amount=50_000.0, tx_type="credit", category="loan_disbursement"),
        Transaction(date=date(2026, 9, 3), party_name="Owner", item="Personal Savings", amount=10_000.0, tx_type="credit", category="capital_injection"),
    ]
    # Total credit should be the full cash inflow (100k)
    assert total_credit(txs) == 100_000.0
    # Turnover must strictly isolate sales (40k)
    assert turnover(txs) == 40_000.0
    assert operating_revenue(txs) == 40_000.0


def test_legacy_uncategorized_turnover_fallback():
    """Verify that when all transactions have category=None, turnover falls back to total_credit."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Customer A", item="Table", amount=15_000.0, tx_type="credit", category=None),
        Transaction(date=date(2026, 9, 2), party_name="Customer B", item="Desk", amount=10_000.0, tx_type="credit", category=None),
    ]
    assert total_credit(txs) == 25_000.0
    assert turnover(txs) == 25_000.0


def test_distinction_between_zero_categorized_sales_and_legacy_uncategorized():
    """Verify zero categorized sales evaluates to 0 turnover, unlike legacy fallback."""
    # Case A: Categorized dataset with NO sales (e.g. only loan received)
    categorized_no_sales = [
        Transaction(date=date(2026, 9, 1), party_name="Bank", item="MFI Loan", amount=50_000.0, tx_type="credit", category="loan_disbursement"),
    ]
    assert total_credit(categorized_no_sales) == 50_000.0
    # Must evaluate to 0.0, NOT falling back to total_credit
    assert turnover(categorized_no_sales) == 0.0

    # Case B: Legacy uncategorized dataset with identical amount
    legacy_txs = [
        Transaction(date=date(2026, 9, 1), party_name="Bank", item="MFI Loan", amount=50_000.0, tx_type="credit", category=None),
    ]
    assert total_credit(legacy_txs) == 50_000.0
    # Falls back to total_credit in legacy mode
    assert turnover(legacy_txs) == 50_000.0


def test_operating_surplus_calculation():
    """Verify operating_revenue, operating_costs, and calculated_operating_surplus."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Client", item="Furniture Sale", amount=80_000.0, tx_type="credit", category="sales"),
        Transaction(date=date(2026, 9, 2), party_name="Timber Depot", item="Teak Planks", amount=30_000.0, tx_type="debit", category="raw_material"),
        Transaction(date=date(2026, 9, 3), party_name="Workshop Landlord", item="Monthly Rent", amount=15_000.0, tx_type="debit", category="operating_expense"),
    ]
    assert operating_revenue(txs) == 80_000.0
    assert operating_costs(txs) == 45_000.0
    assert calculated_operating_surplus(txs) == 35_000.0


def test_loan_repayment_and_personal_drawings_excluded_from_operating_costs():
    """Verify financing debt service and equity drawings do not enter operating costs."""
    txs = [
        Transaction(date=date(2026, 9, 1), party_name="Timber Mill", item="Wood", amount=20_000.0, tx_type="debit", category="raw_material"),
        Transaction(date=date(2026, 9, 2), party_name="Electricity Board", item="Power", amount=5_000.0, tx_type="debit", category="operating_expense"),
        Transaction(date=date(2026, 9, 3), party_name="Bank", item="Loan EMI", amount=10_000.0, tx_type="debit", category="loan_repayment"),
        Transaction(date=date(2026, 9, 4), party_name="Owner Household", item="Household Expenses", amount=8_000.0, tx_type="debit", category="personal_drawings"),
    ]
    # Total debit is 43,000
    assert total_debit(txs) == 43_000.0
    # Operating costs must strictly include ONLY raw_material (20k) + operating_expense (5k) = 25,000
    assert operating_costs(txs) == 25_000.0


def test_invalid_category_rejected():
    """Verify that invalid category strings are rejected by Pydantic."""
    with pytest.raises(ValidationError):
        Transaction(
            date=date(2026, 9, 1),
            party_name="Party",
            item="Item",
            amount=100.0,
            tx_type="credit",
            category="invalid_category",  # type: ignore
        )


def test_all_valid_categories_accepted():
    """Verify that all 9 valid TransactionCategory literals are accepted."""
    valid_categories = [
        "sales",
        "raw_material",
        "operating_expense",
        "loan_disbursement",
        "capital_injection",
        "loan_repayment",
        "personal_drawings",
        "refund",
        "other",
    ]
    for cat in valid_categories:
        tx = Transaction(
            date=date(2026, 9, 1),
            party_name="Test Party",
            item="Test Item",
            amount=100.0,
            tx_type="credit",
            category=cat,  # type: ignore
        )
        assert tx.category == cat

