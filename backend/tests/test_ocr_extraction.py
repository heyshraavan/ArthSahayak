"""Tests for Multi-Transaction Handwritten Ledger & Document OCR Extraction pipeline.

Verifies:
- Provider selection with and without GEMINI_API_KEY
- Missing API key handling (OcrConfigurationError)
- Mocked Gemini Vision multi-transaction extraction (gemini-3.6-flash, temp=0, Part.from_bytes, structured schema)
- Single-transaction image extraction
- Multi-transaction bahi-khata ledger rows extraction (multiple distinct debit/credit rows)
- Receipt with line items + single stated total (prevention of double-counting)
- Empty transaction list handling (e.g. blank page)
- Malformed transaction inside list rejected via Pydantic (HTTP 422)
- Invalid category inside list rejected via Pydantic (HTTP 422)
- Negative amount inside list rejected via Pydantic (HTTP 422)
- Identity document rejection guardrail (Aadhaar, PAN, caste certificates) -> HTTP 422
- Supported image MIME types (JPEG, PNG, WebP, HEIC)
- Unsupported MIME type rejection (HTTP 422, ImageValidationError)
- Malformed base64 rejection (HTTP 422)
- Empty image payload rejection (HTTP 422)
- Image over 10 MB payload rejection (HTTP 422)
- Upstream Gemini OCR failure handling (HTTP 502, OcrError, no silent fake fallback)
- requires_confirmation: true invariant
- Server-side isolation: no ledger mutation and no finance_engine invocation

ZERO external network calls are made in these automated tests.
"""

import base64
from datetime import date
import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import Transaction
from app.services.ocr import (
    DEFAULT_GEMINI_MODEL,
    GeminiOcrBatchExtraction,
    GeminiOcrProvider,
    GeminiOcrTransactionItem,
    ImageValidationError,
    OcrConfigurationError,
    OcrError,
    OcrValidationError,
    StubOcrProvider,
    get_ocr_provider,
    normalize_ocr_date,
    validate_image_payload,
)

client = TestClient(app)


# --- 1. Provider Resolution & Configuration Tests ---

def test_ocr_provider_selection_without_gemini_api_key(monkeypatch):
    """When GEMINI_API_KEY is absent, StubOcrProvider is selected.

    Application startup never crashes due to an absent key.
    """
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = get_ocr_provider()
    assert isinstance(provider, StubOcrProvider)


def test_ocr_provider_selection_with_gemini_api_key(monkeypatch):
    """When GEMINI_API_KEY is present, GeminiOcrProvider is selected with default model."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_vision_key_123")
    provider = get_ocr_provider()
    assert isinstance(provider, GeminiOcrProvider)
    assert provider.api_key == "mock_gemini_vision_key_123"
    assert provider.model == DEFAULT_GEMINI_MODEL
    assert provider.model == "gemini-3.1-flash-lite"


def test_ocr_model_configurable_via_env(monkeypatch):
    """Verify GEMINI_MODEL environment variable overrides default OCR model."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_vision_key_123")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    provider = get_ocr_provider()
    assert isinstance(provider, GeminiOcrProvider)
    assert provider.model == "gemini-3.5-flash"


def test_gemini_ocr_provider_missing_key_raises_configuration_error(monkeypatch):
    """Explicitly initializing GeminiOcrProvider without a key raises OcrConfigurationError."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(OcrConfigurationError) as exc_info:
        GeminiOcrProvider(api_key="")
    assert "GEMINI_API_KEY is not configured" in str(exc_info.value)


# --- 2. Image Payload Validation Tests ---

def test_image_payload_supported_mime_types():
    """Verify JPEG, PNG, WebP, and HEIC MIME types are accepted."""
    sample_bytes = b"\xff\xd8\xff\xe0"  # minimal fake image bytes
    for mime in ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"]:
        validate_image_payload(sample_bytes, mime)
        validate_image_payload(sample_bytes, f"{mime}; charset=utf-8")


def test_image_payload_unsupported_mime_type():
    """Verify unsupported MIME types raise ImageValidationError."""
    sample_bytes = b"fake_content"
    for mime in ["application/pdf", "image/gif", "image/bmp", "text/plain"]:
        with pytest.raises(ImageValidationError) as exc_info:
            validate_image_payload(sample_bytes, mime)
        assert "Unsupported image MIME type" in str(exc_info.value)


def test_image_payload_empty_bytes_raises():
    """Verify empty image payload raises ImageValidationError."""
    with pytest.raises(ImageValidationError) as exc_info:
        validate_image_payload(b"", "image/jpeg")
    assert "Image payload is empty" in str(exc_info.value)


def test_image_payload_over_10mb_limit_raises():
    """Verify payload exceeding 10 MB limit raises ImageValidationError."""
    ten_mb_plus_one = b"x" * (10 * 1024 * 1024 + 1)
    with pytest.raises(ImageValidationError) as exc_info:
        validate_image_payload(ten_mb_plus_one, "image/png")
    assert "exceeds the 10 MB application limit" in str(exc_info.value)


# --- 3. Mocked Gemini Vision Multi-Transaction Tests ---

def test_gemini_vision_ocr_single_transaction_mocked():
    """Verify GeminiOcrProvider handles single transaction image."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        rejection_reason=None,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Gupta Timber Depot",
                item="Shisham Wood Planks",
                amount=16500.0,
                tx_type="debit",
                category="raw_material",
            )
        ],
        raw_text="गुप्ता टिम्बर डिपो - शीशम की लकड़ी - ₹16500 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert "transactions" in result
    assert len(result["transactions"]) == 1
    tx = result["transactions"][0]
    assert tx["party_name"] == "Gupta Timber Depot"
    assert tx["item"] == "Shisham Wood Planks"
    assert tx["amount"] == 16500.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "raw_material"

    # Verify generate_content parameters
    mock_genai_client.models.generate_content.assert_called_once()
    _, kwargs = mock_genai_client.models.generate_content.call_args
    assert kwargs["model"] == "gemini-3.1-flash-lite"
    assert len(kwargs["contents"]) == 2
    assert kwargs["config"].temperature == 0.0
    assert kwargs["config"].response_schema == GeminiOcrBatchExtraction
    assert kwargs["config"].automatic_function_calling.disable is True


def test_gemini_vision_ocr_multi_transaction_bahi_khata_rows():
    """Verify GeminiOcrProvider extracts multiple distinct ledger rows from a bahi-khata page."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-07",
                party_name="Anil Babu",
                item="2 School Desks",
                amount=14000.0,
                tx_type="credit",
                category="sales",
            ),
            GeminiOcrTransactionItem(
                date="2026-09-07",
                party_name="Maa Tara Timber",
                item="Wood Planks",
                amount=7500.0,
                tx_type="debit",
                category="raw_material",
            ),
            GeminiOcrTransactionItem(
                date="2026-09-07",
                party_name="Biren Da",
                item="Workshop Wages",
                amount=5000.0,
                tx_type="debit",
                category="operating_expense",
            ),
        ],
        raw_text="खाता बही 7 सितम्बर: अनिल बाबू 14000 जमा, माँ तारा 7500 नामे, बीरेन दा 5000 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_bahi_khata_image", mime_type="image/png")

    assert len(result["transactions"]) == 3
    assert result["transactions"][0]["tx_type"] == "credit"
    assert result["transactions"][0]["category"] == "sales"
    assert result["transactions"][1]["tx_type"] == "debit"
    assert result["transactions"][1]["category"] == "raw_material"
    assert result["transactions"][2]["tx_type"] == "debit"
    assert result["transactions"][2]["category"] == "operating_expense"


def test_gemini_vision_ocr_receipt_with_line_items_and_total_avoids_double_counting():
    """Verify receipt with line items and total represents ONE transaction for the total amount.

    Prevents double-counting component items alongside the bill total.
    """
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    # Restaurant bill: Thali 300 + Lassi 100 + Roti 50 = Total 450
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Shree Annapurna Dhaba",
                item="Meal Bill (Thali + Lassi + Roti)",
                amount=450.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
        raw_text="श्री अन्नपूर्णा ढाबा: थाली ₹300, लस्सी ₹100, रोटी ₹50, कुल योग: ₹450",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_receipt_image", mime_type="image/jpeg")

    # MUST be exactly 1 transaction for the total 450, NOT 4 transactions (300 + 100 + 50 + 450)
    assert len(result["transactions"]) == 1
    assert result["transactions"][0]["amount"] == 450.0
    assert result["transactions"][0]["party_name"] == "Shree Annapurna Dhaba"


def test_gemini_vision_ocr_date_fallback_when_unspecified():
    """Verify date defaults to date.today() when document does not contain an explicit date."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date=None,
                party_name="Kisan Fertilisers",
                item="Bio Fertilisers",
                amount=3200.0,
                tx_type="debit",
                category="raw_material",
            )
        ],
        raw_text="किसान खाद भण्डार",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_image_bytes", mime_type="image/webp")

    assert len(result["transactions"]) == 1
    assert result["transactions"][0]["date"] == date.today()


def test_gemini_vision_identity_document_rejected():
    """Verify GeminiOcrProvider detects and rejects identity documents (Aadhaar/PAN/caste)."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=True,
        rejection_reason="Government of India Aadhaar Card detected",
        transactions=[],
        raw_text=None,
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)

    with pytest.raises(OcrValidationError) as exc_info:
        provider.extract_from_image(b"fake_aadhaar_image", mime_type="image/jpeg")

    assert "Identity document rejected" in str(exc_info.value)
    assert "Aadhaar Card detected" in str(exc_info.value)


def test_gemini_vision_upstream_failure_raises_ocr_error():
    """Upstream Gemini failures must raise OcrError and NEVER silently substitute fake text."""
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini API connection reset")

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)

    with pytest.raises(OcrError) as exc_info:
        provider.extract_from_image(b"fake_image", mime_type="image/webp")
    assert "Gemini OCR extraction failed" in str(exc_info.value)


def test_gemini_vision_empty_output_raises_ocr_error():
    """Empty or unparseable Gemini response raises OcrError."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = ""
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)

    with pytest.raises(OcrError) as exc_info:
        provider.extract_from_image(b"fake_image", mime_type="image/jpeg")
    assert "empty structured OCR output" in str(exc_info.value)


# --- 3b. Accounting Perspective & Semantic Classification Tests ---

def test_gemini_vision_ocr_prompt_enforces_ledger_perspective_and_semantic_rules():
    """Verify Gemini OCR prompt explicitly establishes micro-entrepreneur perspective and semantic examples."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Dhaba",
                item="Food",
                amount=146.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    # Inspect generated prompt contents
    call_args = mock_genai_client.models.generate_content.call_args
    prompt_text = call_args.kwargs["contents"][1]

    # 1. Ledger perspective
    assert "The ledger represents the micro-entrepreneur's business." in prompt_text
    assert "Money entering the entrepreneur's business (credit / जमा)" in prompt_text
    assert "Money leaving the entrepreneur's business (debit / नामे / खर्च)" in prompt_text

    # 2. Do not classify merely by labels
    assert "Do NOT classify a document simply based on the presence of words like: 'bill', 'receipt', 'total', 'cash'" in prompt_text

    # 3. Mandatory semantic examples
    assert "Business receives money from customer for its product/service:\n     credit + sales" in prompt_text
    assert "Business pays supplier for raw materials:\n     debit + raw_material" in prompt_text
    assert "Business pays wages/labour:\n     debit + operating_expense" in prompt_text
    assert "Business pays restaurant/food/travel/utilities/other business expenses:\n     debit + operating_expense" in prompt_text
    assert "Business receives a loan:\n     credit + loan_disbursement" in prompt_text
    assert "Business repays loan principal:\n     debit + loan_repayment" in prompt_text
    assert "Business owner puts own money into business:\n     credit + capital_injection" in prompt_text
    assert "Business owner takes money out for personal use:\n     debit + personal_drawings" in prompt_text


def test_ocr_restaurant_expense_receipt_debit_operating_expense():
    """Verify handwritten restaurant bill is classified as debit + operating_expense, NEVER credit + sales."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Hotel Swad",
                item="Handwritten Food Bill (Thali + Tea)",
                amount=146.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
        raw_text="होटल स्वाद - थाली ₹120, चाय ₹26 - कुल ₹146",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_restaurant_bill", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 146.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "operating_expense"
    assert tx["tx_type"] != "credit"
    assert tx["category"] != "sales"

    # Strict Pydantic ledger model validation
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "debit"
    assert validated_tx.category == "operating_expense"


def test_ocr_customer_sales_receipt_credit_sales():
    """Verify customer sales receipt is classified as credit + sales."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Ramesh Kumar (Customer)",
                item="Handmade Wooden Chair",
                amount=1200.0,
                tx_type="credit",
                category="sales",
            )
        ],
        raw_text="बिक्री पर्चा: रमेश कुमार को कुर्सी बेची - ₹1200 नकद प्राप्त",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_sales_receipt", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 1200.0
    assert tx["tx_type"] == "credit"
    assert tx["category"] == "sales"
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "credit"
    assert validated_tx.category == "sales"


def test_ocr_raw_material_purchase_receipt_debit_raw_material():
    """Verify raw material purchase slip is classified as debit + raw_material."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Kisan Timber Depot",
                item="Pine Wood Logs",
                amount=4500.0,
                tx_type="debit",
                category="raw_material",
            )
        ],
        raw_text="किसान टिम्बर डिपो - चीड़ की लकड़ी - ₹4500 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_timber_slip", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 4500.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "raw_material"
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "debit"
    assert validated_tx.category == "raw_material"


def test_ocr_wage_payment_debit_operating_expense():
    """Verify labour wage payment is classified as debit + operating_expense."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Sunil Majhi (Labour)",
                item="Weekly Workshop Labour Wages",
                amount=2000.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
        raw_text="सुनील मांझी - साप्ताहिक मजदूरी भुगतान - ₹2000 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_wage_slip", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 2000.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "operating_expense"
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "debit"
    assert validated_tx.category == "operating_expense"


def test_ocr_loan_receipt_credit_loan_disbursement():
    """Verify loan receipt/disbursement is classified as credit + loan_disbursement."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Bandhan Microfinance",
                item="Business Microloan Disbursement",
                amount=25000.0,
                tx_type="credit",
                category="loan_disbursement",
            )
        ],
        raw_text="बंधन बैंक - व्यवसाय ऋण संवितरण - ₹25000 जमा",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_loan_disbursement", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 25000.0
    assert tx["tx_type"] == "credit"
    assert tx["category"] == "loan_disbursement"
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "credit"
    assert validated_tx.category == "loan_disbursement"


def test_ocr_loan_repayment_debit_loan_repayment():
    """Verify loan installment repayment is classified as debit + loan_repayment."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Bandhan Microfinance",
                item="Weekly Microloan Installment",
                amount=1250.0,
                tx_type="debit",
                category="loan_repayment",
            )
        ],
        raw_text="बंधन बैंक - ऋण किस्त भुगतान - ₹1250 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    res = provider.extract_from_image(b"fake_loan_repayment", mime_type="image/jpeg")

    assert len(res["transactions"]) == 1
    tx = res["transactions"][0]
    assert tx["amount"] == 1250.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "loan_repayment"
    validated_tx = Transaction.model_validate(tx)
    assert validated_tx.tx_type == "debit"
    assert validated_tx.category == "loan_repayment"


# --- 4. API Endpoint Integration Tests (POST /ocr/extract) ---

def test_api_endpoint_ocr_multi_transaction_success(monkeypatch):
    """POST /ocr/extract returns 200 with suggested_transactions list and requires_confirmation=True."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Anil Babu Furniture",
                item="3 School Desks",
                amount=21000.0,
                tx_type="credit",
                category="sales",
            ),
            GeminiOcrTransactionItem(
                date="2026-09-08",
                party_name="Ramesh Hardware",
                item="Nails and Screws",
                amount=1200.0,
                tx_type="debit",
                category="raw_material",
            ),
        ],
        raw_text="अनिल बाबू फर्नीचर - 3 स्कूल डेस्क - ₹21000 जमा, रमेश हार्डवेयर ₹1200 नामे",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    mock_provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)

    fake_b64 = base64.b64encode(b"valid_image_payload").decode("utf-8")
    payload = {
        "image_base64": fake_b64,
        "mime_type": "image/jpeg",
    }

    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json=payload)

    assert resp.status_code == 200
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert "suggested_transactions" in data
    assert len(data["suggested_transactions"]) == 2

    tx1 = data["suggested_transactions"][0]
    assert tx1["party_name"] == "Anil Babu Furniture"
    assert tx1["amount"] == 21000.0
    assert tx1["tx_type"] == "credit"
    assert tx1["category"] == "sales"

    tx2 = data["suggested_transactions"][1]
    assert tx2["party_name"] == "Ramesh Hardware"
    assert tx2["amount"] == 1200.0
    assert tx2["tx_type"] == "debit"
    assert tx2["category"] == "raw_material"


def test_api_endpoint_ocr_empty_transaction_list(monkeypatch):
    """When document contains zero recognizable transactions, returns empty list without error."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.return_value = {
        "transactions": [],
        "raw_text": "Blank page with no visible transactions",
    }

    fake_b64 = base64.b64encode(b"blank_page").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert data["suggested_transactions"] == []


def test_api_endpoint_ocr_identity_document_returns_422(monkeypatch):
    """Identity documents (Aadhaar, PAN, caste) submitted to /ocr/extract must be rejected with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.side_effect = OcrValidationError(
        "Identity document rejected (Income Tax Department PAN card detected). "
        "Personal identity documents cannot be processed as financial transactions."
    )

    fake_b64 = base64.b64encode(b"pan_card_photo").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 422
    assert "Identity document rejected" in resp.json()["detail"]


def test_api_endpoint_ocr_unsupported_mime_returns_422():
    """Unsupported MIME type returns HTTP 422 Unprocessable Entity."""
    fake_b64 = base64.b64encode(b"some_bytes").decode("utf-8")
    payload = {
        "image_base64": fake_b64,
        "mime_type": "application/pdf",
    }
    resp = client.post("/ocr/extract", json=payload)
    assert resp.status_code == 422
    assert "Unsupported image MIME type" in resp.json()["detail"]


def test_api_endpoint_ocr_invalid_base64_returns_422():
    """Invalid base64 payload returns HTTP 422."""
    payload = {
        "image_base64": "!!!not_valid_base64@@@",
        "mime_type": "image/png",
    }
    resp = client.post("/ocr/extract", json=payload)
    assert resp.status_code == 422
    assert "Invalid base64 image data" in resp.json()["detail"]


def test_api_endpoint_ocr_empty_image_returns_422():
    """Empty base64 image string returns HTTP 422."""
    payload = {
        "image_base64": "",
        "mime_type": "image/jpeg",
    }
    resp = client.post("/ocr/extract", json=payload)
    assert resp.status_code == 422


def test_api_endpoint_ocr_over_10mb_returns_422():
    """Decoded image payload exceeding 10 MB returns HTTP 422."""
    large_bytes = b"x" * (10 * 1024 * 1024 + 50)
    large_b64 = base64.b64encode(large_bytes).decode("utf-8")
    payload = {
        "image_base64": large_b64,
        "mime_type": "image/jpeg",
    }
    resp = client.post("/ocr/extract", json=payload)
    assert resp.status_code == 422
    assert "exceeds the 10 MB application limit" in resp.json()["detail"]


def test_api_endpoint_ocr_upstream_gemini_failure_returns_502(monkeypatch):
    """When Gemini Vision fails, endpoint returns HTTP 502 Bad Gateway (never falls back to stub)."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.side_effect = OcrError("Gemini Vision 503 Overloaded")

    fake_b64 = base64.b64encode(b"valid_image").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 502
    assert "Upstream OCR error" in resp.json()["detail"]


def test_api_endpoint_gemini_ocr_503_unavailable_returns_502(monkeypatch):
    """When Gemini Vision returns 503 UNAVAILABLE, endpoint cleanly returns 502 with model name in detail."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "503 UNAVAILABLE: This model is currently experiencing high demand."
    )
    mock_provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=MagicMock())

    fake_b64 = base64.b64encode(b"valid_image").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "Upstream OCR error" in detail
    assert "gemini-3.1-flash-lite" in detail
    assert "503 UNAVAILABLE" in detail


def test_api_endpoint_untrusted_ai_invalid_category_inside_list_returns_422(monkeypatch):
    """If Gemini returns an invalid category in any transaction in the list, Pydantic rejects with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.return_value = {
        "transactions": [
            {
                "date": "2026-09-08",
                "party_name": "Valid Trader",
                "item": "Valid Item",
                "amount": 5000.0,
                "tx_type": "credit",
                "category": "sales",
            },
            {
                "date": "2026-09-08",
                "party_name": "Bad Trader",
                "item": "Supplies",
                "amount": 2000.0,
                "tx_type": "debit",
                "category": "unsupported_crypto_category",
            },
        ],
        "raw_text": "Mixed slip",
    }

    fake_b64 = base64.b64encode(b"image").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_api_endpoint_untrusted_ai_negative_amount_inside_list_returns_422(monkeypatch):
    """If Gemini returns a negative amount in any transaction, Pydantic rejects with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.return_value = {
        "transactions": [
            {
                "date": "2026-09-08",
                "party_name": "Bad Trader",
                "item": "Supplies",
                "amount": -250.0,
                "tx_type": "debit",
                "category": "operating_expense",
            }
        ],
        "raw_text": "Slip",
    }

    fake_b64 = base64.b64encode(b"image").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_api_endpoint_untrusted_ai_malformed_inside_list_returns_422(monkeypatch):
    """If Gemini returns malformed fields in any transaction, Pydantic rejects with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract_from_image.return_value = {
        "transactions": [
            {
                "date": "bad-date-string",
                "party_name": "   ",
                "item": "",
                "amount": "not_a_float",
                "tx_type": "unknown",
            }
        ],
        "raw_text": "Malformed slip",
    }

    fake_b64 = base64.b64encode(b"image").decode("utf-8")
    with patch("app.main.get_ocr_provider", return_value=mock_provider):
        resp = client.post("/ocr/extract", json={"image_base64": fake_b64, "mime_type": "image/jpeg"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_ocr_extract_does_not_mutate_ledger_or_call_finance_engine():
    """Verify /ocr/extract is strictly a suggestion endpoint with no ledger or finance side effects."""
    fake_b64 = base64.b64encode(b"test:multi_transaction").decode("utf-8")
    payload = {
        "image_base64": fake_b64,
        "mime_type": "image/png",
    }

    with patch("app.main.compute_financial_summary") as mock_compute:
        resp = client.post("/ocr/extract", json=payload)

    assert resp.status_code == 200
    mock_compute.assert_not_called()
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert len(data["suggested_transactions"]) == 3
    assert "turnover" not in data
    assert "working_capital_requirement" not in data
    assert "maximum_permissible_bank_finance" not in data
    assert "dscr" not in data


@pytest.mark.parametrize(
    "test_marker, expected_party, expected_type, expected_category, expected_amount",
    [
        ("test:restaurant_expense", "Hotel Swad (Restaurant)", "debit", "operating_expense", 146.0),
        ("test:customer_sales", "Ramesh Kumar (Customer)", "credit", "sales", 1200.0),
        ("test:raw_material_purchase", "Kisan Timber Depot", "debit", "raw_material", 4500.0),
        ("test:wage_payment", "Sunil Majhi (Labour)", "debit", "operating_expense", 2000.0),
        ("test:loan_receipt", "Bandhan Microfinance", "credit", "loan_disbursement", 25000.0),
        ("test:loan_repayment", "Bandhan Microfinance", "debit", "loan_repayment", 1250.0),
    ],
)
def test_api_endpoint_semantic_accounting_scenarios(
    monkeypatch, test_marker, expected_party, expected_type, expected_category, expected_amount
):
    """Verify /ocr/extract correctly returns the semantic direction and category for standard accounting scenarios."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)  # Uses StubOcrProvider
    b64_payload = base64.b64encode(test_marker.encode("utf-8")).decode("utf-8")
    resp = client.post("/ocr/extract", json={"image_base64": b64_payload, "mime_type": "image/jpeg"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert len(data["suggested_transactions"]) == 1
    tx = data["suggested_transactions"][0]
    assert tx["party_name"] == expected_party
    assert tx["tx_type"] == expected_type
    assert tx["category"] == expected_category
    assert tx["amount"] == expected_amount


def test_stub_ocr_provider_scenarios():
    """Verify StubOcrProvider handles single, multi, and receipt total scenarios."""
    provider = StubOcrProvider()

    # Single transaction
    res_single = provider.extract_from_image(b"test:single_transaction", "image/jpeg")
    assert len(res_single["transactions"]) == 1
    assert res_single["transactions"][0]["party_name"] == "Sharma Timber Depot"
    assert Transaction.model_validate(res_single["transactions"][0]).amount == 8500.0

    # Multi-transaction bahi-khata
    res_multi = provider.extract_from_image(b"test:bahi_khata_multi", "image/png")
    assert len(res_multi["transactions"]) == 3
    assert res_multi["transactions"][0]["tx_type"] == "credit"
    assert res_multi["transactions"][1]["tx_type"] == "debit"
    assert res_multi["transactions"][2]["tx_type"] == "debit"

    # Receipt with line items + total (avoids double counting)
    res_receipt = provider.extract_from_image(b"test:receipt_with_total", "image/jpeg")
    assert len(res_receipt["transactions"]) == 1
    assert res_receipt["transactions"][0]["amount"] == 450.0
    assert "Meal Bill" in res_receipt["transactions"][0]["item"]

    # Semantic accounting scenarios in stub
    res_rest = provider.extract_from_image(b"test:restaurant_expense", "image/jpeg")
    assert res_rest["transactions"][0]["tx_type"] == "debit"
    assert res_rest["transactions"][0]["category"] == "operating_expense"
    assert res_rest["transactions"][0]["amount"] == 146.0

    res_sales = provider.extract_from_image(b"test:customer_sales", "image/jpeg")
    assert res_sales["transactions"][0]["tx_type"] == "credit"
    assert res_sales["transactions"][0]["category"] == "sales"

    res_raw = provider.extract_from_image(b"test:raw_material_purchase", "image/jpeg")
    assert res_raw["transactions"][0]["tx_type"] == "debit"
    assert res_raw["transactions"][0]["category"] == "raw_material"

    res_wage = provider.extract_from_image(b"test:wage_payment", "image/jpeg")
    assert res_wage["transactions"][0]["tx_type"] == "debit"
    assert res_wage["transactions"][0]["category"] == "operating_expense"

    res_loan_rec = provider.extract_from_image(b"test:loan_receipt", "image/jpeg")
    assert res_loan_rec["transactions"][0]["tx_type"] == "credit"
    assert res_loan_rec["transactions"][0]["category"] == "loan_disbursement"

    res_loan_rep = provider.extract_from_image(b"test:loan_repayment", "image/jpeg")
    assert res_loan_rep["transactions"][0]["tx_type"] == "debit"
    assert res_loan_rep["transactions"][0]["category"] == "loan_repayment"

    # Empty transaction list
    res_empty = provider.extract_from_image(b"test:empty_transactions", "image/jpeg")
    assert res_empty["transactions"] == []


# --- 13. Date Normalization & Strict Human Review Invariant Tests ---

def test_normalize_ocr_date_dd_mm_yyyy_to_canonical_iso():
    """Verify DD-MM-YYYY format is converted to canonical YYYY-MM-DD."""
    assert normalize_ocr_date("22-05-2007") == "2007-05-22"
    assert normalize_ocr_date("2-5-2007") == "2007-05-02"
    assert normalize_ocr_date("02-05-2007") == "2007-05-02"


def test_normalize_ocr_date_dd_slash_yyyy_to_canonical_iso():
    """Verify DD/MM/YYYY format is converted to canonical YYYY-MM-DD."""
    assert normalize_ocr_date("22/05/2007") == "2007-05-22"
    assert normalize_ocr_date("2/5/2007") == "2007-05-02"


def test_normalize_ocr_date_dd_dot_yyyy_to_canonical_iso():
    """Verify DD.MM.YYYY format is converted to canonical YYYY-MM-DD."""
    assert normalize_ocr_date("22.05.2007") == "2007-05-22"


def test_normalize_ocr_date_canonical_iso_remains_unchanged():
    """Verify canonical YYYY-MM-DD remains unchanged."""
    assert normalize_ocr_date("2007-05-22") == "2007-05-22"
    assert normalize_ocr_date("2026-09-08") == "2026-09-08"
    assert normalize_ocr_date("2007/05/22") == "2007-05-22"


def test_normalize_ocr_date_datetime_date_object():
    """Verify date object input converts to canonical ISO string."""
    assert normalize_ocr_date(date(2007, 5, 22)) == "2007-05-22"


def test_normalize_ocr_date_invalid_calendar_dates_rejected():
    """Verify invalid calendar dates (e.g. Feb 31, non-leap year Feb 29, month 13) return None."""
    assert normalize_ocr_date("31-02-2007") is None  # Feb 31 does not exist
    assert normalize_ocr_date("29-02-2007") is None  # 2007 not a leap year
    assert normalize_ocr_date("29-02-2008") == "2008-02-29"  # 2008 IS a leap year
    assert normalize_ocr_date("32-05-2007") is None  # Day 32
    assert normalize_ocr_date("22-13-2007") is None  # Month 13
    assert normalize_ocr_date("00-05-2007") is None  # Day 0


def test_normalize_ocr_date_ambiguous_two_digit_years_rejected():
    """Verify 2-digit years return None to prevent guessing centuries."""
    assert normalize_ocr_date("22/05/07") is None
    assert normalize_ocr_date("22-05-07") is None
    assert normalize_ocr_date("07-05-22") is None


def test_normalize_ocr_date_malformed_text_returns_none():
    """Verify malformed text or unparseable input returns None."""
    assert normalize_ocr_date("bad-date-format") is None
    assert normalize_ocr_date("yesterday") is None
    assert normalize_ocr_date("") is None
    assert normalize_ocr_date("   ") is None
    assert normalize_ocr_date(None) is None


def test_gemini_vision_ocr_normalizes_extracted_dates():
    """Verify GeminiOcrProvider normalizes non-ISO dates extracted from images."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        transactions=[
            GeminiOcrTransactionItem(
                date="22-05-2007",
                party_name="Hotel Swad",
                item="Meal Bill",
                amount=146.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
        raw_text="होटल स्वाद - 22-05-2007 - ₹146",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_receipt_bytes", mime_type="image/jpeg")

    # Extracted date must be normalized to canonical YYYY-MM-DD
    assert result["transactions"][0]["date"] == "2007-05-22"
    # Pydantic validation must succeed with valid date object
    validated = Transaction.model_validate(result["transactions"][0])
    assert validated.date == date(2007, 5, 22)
    assert validated.amount == 146.0


def test_ocr_extract_endpoint_normalizes_dd_mm_yyyy_date():
    """Verify POST /ocr/extract endpoint returns canonical 2007-05-22 date from 22-05-2007 stub."""
    b64_img = base64.b64encode(b"test:date_dd_mm_yyyy").decode("utf-8")
    response = client.post("/ocr/extract", json={"image_base64": b64_img})
    assert response.status_code == 200
    data = response.json()
    assert len(data["suggested_transactions"]) == 1
    assert data["suggested_transactions"][0]["date"] == "2007-05-22"
    assert data["suggested_transactions"][0]["amount"] == 146.0
    assert data["suggested_transactions"][0]["party_name"] == "Hotel Swad"
    assert data["suggested_transactions"][0]["tx_type"] == "debit"
    assert data["suggested_transactions"][0]["category"] == "operating_expense"


def test_ocr_extract_endpoint_normalizes_dd_slash_yyyy_date():
    """Verify POST /ocr/extract endpoint returns canonical 2007-05-22 date from 22/05/2007 stub."""
    b64_img = base64.b64encode(b"test:date_dd_slash_yyyy").decode("utf-8")
    response = client.post("/ocr/extract", json={"image_base64": b64_img})
    assert response.status_code == 200
    data = response.json()
    assert len(data["suggested_transactions"]) == 1
    assert data["suggested_transactions"][0]["date"] == "2007-05-22"
    assert data["suggested_transactions"][0]["amount"] == 146.0


def test_ocr_provider_selection_missing_key_disallowing_stubs(monkeypatch):
    """When GEMINI_API_KEY is absent and stubs are disallowed, OcrConfigurationError is raised."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "false")
    with pytest.raises(OcrConfigurationError) as exc_info:
        get_ocr_provider()
    assert "GEMINI_API_KEY is not configured" in str(exc_info.value)


def test_ocr_extract_endpoint_missing_credentials_returns_503(monkeypatch):
    """When GEMINI_API_KEY is missing in production mode, endpoint returns HTTP 503 Service Unavailable."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "false")
    b64_img = base64.b64encode(b"fake_jpeg_image_bytes").decode("utf-8")
    response = client.post(
        "/ocr/extract",
        json={"image_base64": b64_img, "mime_type": "image/jpeg"},
    )
    assert response.status_code == 503
    assert "GEMINI_API_KEY is not configured" in response.json().get("detail", "")


def test_ocr_extract_endpoint_accepts_data_url_prefix():
    """Verify POST /ocr/extract accepts base64 with data URL prefix (e.g. from FileReader)."""
    raw_b64 = base64.b64encode(b"test:customer_sales").decode("utf-8")
    data_url = f"data:image/jpeg;base64,{raw_b64}"
    response = client.post(
        "/ocr/extract",
        json={"image_base64": data_url, "mime_type": "image/jpeg"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["suggested_transactions"]) == 1
    assert data["suggested_transactions"][0]["party_name"] == "Ramesh Kumar (Customer)"
    assert data["suggested_transactions"][0]["amount"] == 1200.0


def test_gemini_ocr_disables_afc_in_config():
    """Verify Gemini OCR explicitly sets automatic_function_calling.disable=True.

    Prevents deprecated AFC warning and unnecessary AFC remote loops in single-turn OCR extraction.
    """
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        rejection_reason=None,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-12",
                party_name="Gupta Hardware",
                item="Iron Rods",
                amount=8500.0,
                tx_type="debit",
                category="raw_material",
            )
        ],
        raw_text="Iron Rods ₹8500",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    _, kwargs = mock_genai_client.models.generate_content.call_args
    config = kwargs["config"]
    assert config.automatic_function_calling is not None
    assert config.automatic_function_calling.disable is True


def test_gemini_ocr_strips_markdown_code_fences_from_json_fallback():
    """Verify that if response.parsed is None and response.text is wrapped in markdown code fences, OCR parses successfully."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = (
        "```json\n"
        "{\n"
        '  "is_identity_document": false,\n'
        '  "rejection_reason": null,\n'
        '  "transactions": [\n'
        "    {\n"
        '      "date": "2026-09-12",\n'
        '      "party_name": "Laxmi General Store",\n'
        '      "item": "Flour and Sugar",\n'
        '      "amount": 2400.0,\n'
        '      "tx_type": "debit",\n'
        '      "category": "raw_material"\n'
        "    }\n"
        "  ],\n"
        '  "raw_text": "Laxmi General Store Flour and Sugar 2400"\n'
        "}\n"
        "```"
    )
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert result["transactions"][0]["party_name"] == "Laxmi General Store"
    assert result["transactions"][0]["amount"] == 2400.0
    assert result["transactions"][0]["category"] == "raw_material"


def test_gemini_ocr_retries_on_503_and_succeeds():
    """Verify Gemini OCR retries on transient 503 error and succeeds on subsequent attempt."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        rejection_reason=None,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-12",
                party_name="Gupta Timber",
                item="Wood Planks",
                amount=7500.0,
                tx_type="debit",
                category="raw_material",
            )
        ],
        raw_text="Wood Planks 7500",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())

    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = [
        Exception("503 UNAVAILABLE: This model is currently experiencing high demand."),
        mock_response,
    ]

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    result = provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert result["transactions"][0]["party_name"] == "Gupta Timber"
    assert result["transactions"][0]["amount"] == 7500.0
    assert mock_genai_client.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1
    mock_sleep.assert_called_once_with(0.5)


def test_gemini_ocr_retries_on_429_and_succeeds():
    """Verify Gemini OCR retries on transient 429 rate limit error and succeeds."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_batch = GeminiOcrBatchExtraction(
        is_identity_document=False,
        rejection_reason=None,
        transactions=[
            GeminiOcrTransactionItem(
                date="2026-09-12",
                party_name="Verma Tea",
                item="Tea and Snacks",
                amount=220.0,
                tx_type="debit",
                category="operating_expense",
            )
        ],
        raw_text="Verma Tea 220",
    )
    mock_response.parsed = mock_batch
    mock_response.text = json.dumps(mock_batch.model_dump())

    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = [
        Exception("429 RESOURCE_EXHAUSTED: Rate limit exceeded."),
        mock_response,
    ]

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    result = provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert result["transactions"][0]["party_name"] == "Verma Tea"
    assert result["transactions"][0]["amount"] == 220.0
    assert mock_genai_client.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1


def test_gemini_ocr_does_not_retry_on_invalid_api_key():
    """Verify Gemini OCR fails immediately on 401/403 auth error with ZERO retries."""
    mock_genai_client = MagicMock()
    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "403 PERMISSION_DENIED: The caller does not have permission / API key invalid"
    )

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    with pytest.raises(OcrError) as exc_info:
        provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert "PERMISSION_DENIED" in str(exc_info.value)
    # Must fail immediately on attempt 1 without retrying
    assert mock_genai_client.models.generate_content.call_count == 1
    assert mock_sleep.call_count == 0


def test_gemini_ocr_fails_after_max_attempts_exhausted():
    """Verify Gemini OCR raises OcrError after 3 failed transient attempts."""
    mock_genai_client = MagicMock()
    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "503 UNAVAILABLE: High demand"
    )

    provider = GeminiOcrProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    with pytest.raises(OcrError) as exc_info:
        provider.extract_from_image(b"fake_image_bytes", mime_type="image/jpeg")

    assert "503 UNAVAILABLE" in str(exc_info.value)
    assert mock_genai_client.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    assert mock_sleep.call_args_list[0][0][0] == 0.5
    assert mock_sleep.call_args_list[1][0][0] == 1.0



