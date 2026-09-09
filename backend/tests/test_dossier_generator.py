import inspect
import io
from pathlib import Path
import pypdf
import pytest

from app import dossier_generator
from app.dossier_generator import (
    DossierInput,
    SchemeRecommendation,
    TransactionSnippet,
    generate_dossier_pdf,
)
from app.schemas import FinancialSummary


@pytest.fixture
def sample_financial_summary() -> FinancialSummary:
    """Standard pre-calculated financial summary from finance engine."""
    return FinancialSummary(
        total_credit=60000.0,
        total_debit=20000.0,
        net_cash_flow=40000.0,
        turnover=60000.0,
        working_capital_requirement=15000.0,
        promoter_margin=3000.0,
        maximum_permissible_bank_finance=12000.0,
        dscr=1.75,
    )


@pytest.fixture
def full_dossier_input(sample_financial_summary) -> DossierInput:
    """Complete dossier input payload including optional details."""
    schemes = [
        SchemeRecommendation(
            scheme_name="PM Vishwakarma",
            sponsoring_agency="Ministry of MSME",
            target_benefit="5% interest concession and toolkit grant",
            notes="Eligible under traditional artisan carpentry category",
        ),
        SchemeRecommendation(
            scheme_name="NBCFDC Term Loan",
            sponsoring_agency="MoSJE",
            target_benefit="Concessional credit at 6% p.a.",
            notes="State channelizing agency channel",
        ),
    ]
    transactions = [
        TransactionSnippet(
            date="2026-09-01",
            party_name="Ramesh Carpenter",
            item="Dining Table",
            amount=25000.0,
            tx_type="credit",
        ),
        TransactionSnippet(
            date="2026-09-02",
            party_name="Timber Depot",
            item="Wood logs & nails",
            amount=10000.0,
            tx_type="debit",
        ),
        TransactionSnippet(
            date="2026-09-03",
            party_name="Suresh",
            item="Window Frame",
            amount=15000.0,
            tx_type="credit",
        ),
    ]
    return DossierInput(
        applicant_name="Ramesh Sharma",
        business_name="Ramesh Woodcrafts",
        business_type="Carpentry & Furniture Workshop",
        assessment_date="2026-09-10",
        financial_period="FY 2025-2026 (Apr-Sep)",
        financial_summary=sample_financial_summary,
        proposed_finance_amount=12000.0,
        transaction_count=3,
        transaction_sample=transactions,
        scheme_recommendations=schemes,
        appraisal_notes="Applicant exhibits robust operational cash generation and consistent debtor recovery.",
    )


def test_dossier_generation_succeeds_and_creates_valid_pdf(full_dossier_input):
    """Verify PDF generation succeeds and returns valid PDF bytes starting with %PDF."""
    pdf_bytes = generate_dossier_pdf(full_dossier_input)

    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 0
    assert pdf_bytes.startswith(b"%PDF")


def test_dossier_contains_exactly_two_pages(full_dossier_input, sample_financial_summary):
    """Verify that both full and minimal inputs produce exactly 2 pages."""
    # Test with full dataset
    pdf_full = generate_dossier_pdf(full_dossier_input)
    reader_full = pypdf.PdfReader(io.BytesIO(pdf_full))
    assert len(reader_full.pages) == 2

    # Test with minimal dataset
    minimal_input = DossierInput(financial_summary=sample_financial_summary)
    pdf_minimal = generate_dossier_pdf(minimal_input)
    reader_minimal = pypdf.PdfReader(io.BytesIO(pdf_minimal))
    assert len(reader_minimal.pages) == 2


def test_expected_key_text_appears_in_pdf(full_dossier_input):
    """Verify that required banking and branding text sections appear across the 2 pages."""
    pdf_bytes = generate_dossier_pdf(full_dossier_input)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))

    p1_text = reader.pages[0].extract_text()
    p2_text = reader.pages[1].extract_text()

    # Page 1 checks
    assert "ARTHSAHAYAK" in p1_text
    assert "CREDIT APPRAISAL DOSSIER" in p1_text
    assert "Ramesh Sharma" in p1_text
    assert "Ramesh Woodcrafts" in p1_text
    assert "Carpentry & Furniture Workshop" in p1_text
    assert "FINANCIAL SUMMARY" in p1_text
    assert "Total Credit" in p1_text
    assert "Total Debit" in p1_text
    assert "Net Cash Flow" in p1_text
    assert "Turnover" in p1_text
    assert "NAYAK COMMITTEE" in p1_text
    assert "Working Capital Requirement (WCR)" in p1_text
    assert "Promoter Margin" in p1_text
    assert "Maximum Permissible Bank Finance" in p1_text
    assert "DSCR" in p1_text
    assert "1.75x" in p1_text
    assert "Page 1 of 2" in p1_text

    # Page 2 checks
    assert "PAGE 2" in p2_text
    assert "CREDIT FACILITY" in p2_text
    assert "TRANSACTION AUDIT" in p2_text
    assert "PM Vishwakarma" in p2_text
    assert "NBCFDC" in p2_text
    assert "DISCLAIMERS" in p2_text
    assert "Digital Personal Data Protection" in p2_text
    assert "Page 2 of 2" in p2_text


def test_missing_optional_information_handled_gracefully(sample_financial_summary):
    """Verify that missing optional data defaults to 'Not provided' rather than inventing data."""
    minimal_input = DossierInput(
        financial_summary=sample_financial_summary,
        applicant_name=None,
        business_name=None,
        business_type=None,
        financial_period=None,
        proposed_finance_amount=None,
        transaction_sample=None,
        scheme_recommendations=None,
    )
    pdf_bytes = generate_dossier_pdf(minimal_input)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))

    p1_text = reader.pages[0].extract_text()
    p2_text = reader.pages[1].extract_text()

    assert "Not provided" in p1_text
    assert "Not provided" in p2_text
    assert "No specific scheme recommendations supplied" in p2_text


def test_no_financial_calculations_performed_inside_dossier_generator():
    """Verify that dossier_generator does not compute formulas and faithfully renders provided numbers.

    We provide deliberately non-standard numbers (e.g. WCR=33,333.33 for turnover=100,000.00).
    If the generator recomputed 25% of turnover, it would show 25,000.00 instead of 33,333.33.
    """
    custom_summary = FinancialSummary(
        total_credit=100000.0,
        total_debit=40000.0,
        net_cash_flow=60000.0,
        turnover=100000.0,
        working_capital_requirement=33333.33,  # Deliberately non-standard
        promoter_margin=7777.77,              # Deliberately non-standard
        maximum_permissible_bank_finance=25555.55,  # Deliberately non-standard
        dscr=2.45,
    )
    input_data = DossierInput(financial_summary=custom_summary)
    pdf_bytes = generate_dossier_pdf(input_data)
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    p1_text = reader.pages[0].extract_text()

    # The custom numbers MUST appear directly without being recalculated
    assert "33,333.33" in p1_text
    assert "7,777.77" in p1_text
    assert "25,555.55" in p1_text

    # Verify no calculation functions are imported from app.finance_engine
    engine_funcs = {
        "working_capital_requirement",
        "promoter_margin",
        "maximum_permissible_bank_finance",
        "DSCR",
        "total_credit",
        "total_debit",
        "net_cash_flow",
        "turnover",
    }
    generator_symbols = set(dir(dossier_generator))
    assert not engine_funcs.intersection(generator_symbols), "Calculation functions must not be imported into dossier_generator"


def test_save_to_file(tmp_path: Path, full_dossier_input):
    """Verify that output_path parameter writes the PDF file to disk."""
    out_file = tmp_path / "test_output_dossier.pdf"
    pdf_bytes = generate_dossier_pdf(full_dossier_input, output_path=out_file)

    assert out_file.exists()
    assert out_file.stat().st_size == len(pdf_bytes)

    reader = pypdf.PdfReader(str(out_file))
    assert len(reader.pages) == 2
