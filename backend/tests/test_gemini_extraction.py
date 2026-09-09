"""Tests for Gemini Structured Transaction Extraction integration.

Verifies:
- Provider selection with and without GEMINI_API_KEY
- Missing API key handling (VoiceConfigurationError)
- Mocked Gemini client extraction success (gemini-3.6-flash, temp=0, structured schema)
- Upstream Gemini failure handling (HTTP 502, ExtractionError, no silent fake fallback)
- Untrusted AI output validation via Pydantic (HTTP 422 for bad category, negative amount, whitespace party)
- Date fallback logic (today's date when speaker does not mention date)
- requires_confirmation: true invariant
- Server-side isolation and ledger/finance engine non-interference

ZERO external network calls are made in these automated tests.
"""

from datetime import date
import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.schemas import Transaction
from app.voice_engine import (
    DEFAULT_GEMINI_MODEL,
    ExtractionError,
    GeminiExtractionProvider,
    GeminiTransactionExtraction,
    StubExtractionProvider,
    VoiceConfigurationError,
    get_extraction_provider,
    validate_suggested_transaction,
)

client = TestClient(app)


def test_provider_selection_without_gemini_api_key(monkeypatch):
    """When GEMINI_API_KEY is absent, StubExtractionProvider is selected.

    Application startup never crashes due to an absent key.
    """
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    provider = get_extraction_provider()
    assert isinstance(provider, StubExtractionProvider)


def test_provider_selection_with_gemini_api_key(monkeypatch):
    """When GEMINI_API_KEY is present, GeminiExtractionProvider is selected."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_api_key_xyz987")
    provider = get_extraction_provider()
    assert isinstance(provider, GeminiExtractionProvider)
    assert provider.api_key == "mock_gemini_api_key_xyz987"
    assert provider.model == DEFAULT_GEMINI_MODEL
    assert provider.model == "gemini-3.6-flash"
    assert DEFAULT_GEMINI_MODEL == "gemini-3.6-flash"


def test_gemini_provider_missing_key_raises_configuration_error(monkeypatch):
    """Explicitly initializing GeminiExtractionProvider without a key raises VoiceConfigurationError."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(VoiceConfigurationError) as exc_info:
        GeminiExtractionProvider(api_key="")
    assert "GEMINI_API_KEY is not configured" in str(exc_info.value)


def test_gemini_extraction_success_mocked():
    """Verify GeminiExtractionProvider calls Google GenAI SDK with exact parameters.

    Requirements:
    - model='gemini-3.6-flash'
    - temperature=0.0
    - response_mime_type='application/json'
    - response_schema=GeminiTransactionExtraction
    """
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-08",
        party_name="Ramesh Timber Works",
        item="Teak Wood Logs",
        amount=18500.0,
        tx_type="debit",
        category="raw_material",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract("Paid 18500 to Ramesh Timber Works for Teak Wood Logs on 2026-09-08")

    assert result["party_name"] == "Ramesh Timber Works"
    assert result["item"] == "Teak Wood Logs"
    assert result["amount"] == 18500.0
    assert result["tx_type"] == "debit"
    assert result["category"] == "raw_material"
    assert str(result["date"]) == "2026-09-08"

    # Verify generate_content call
    mock_genai_client.models.generate_content.assert_called_once()
    _, kwargs = mock_genai_client.models.generate_content.call_args
    assert kwargs["model"] == "gemini-3.6-flash"
    config = kwargs["config"]
    assert config.temperature == 0.0
    assert config.response_mime_type == "application/json"
    assert config.response_schema == GeminiTransactionExtraction


def test_gemini_extraction_date_fallback_when_unspecified():
    """Verify date defaults to date.today() when speech does not specify a date."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()

    mock_extraction = GeminiTransactionExtraction(
        date=None,
        party_name="Anil Babu",
        item="School Desks",
        amount=14000.0,
        tx_type="credit",
        category="sales",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract("Sold 2 desks to Anil Babu for 14000 rupees")

    assert result["date"] == date.today()
    assert result["party_name"] == "Anil Babu"
    assert result["amount"] == 14000.0
    assert result["tx_type"] == "credit"
    assert result["category"] == "sales"


def test_gemini_extraction_text_json_fallback():
    """Verify extraction parses JSON from response.text when parsed property is not set."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = json.dumps({
        "date": "2026-09-07",
        "party_name": "Suresh Kirana",
        "item": "Shop Supplies",
        "amount": 1200.0,
        "tx_type": "debit",
        "category": "operating_expense",
    })
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract("Paid 1200 to Suresh Kirana for shop supplies")

    assert result["party_name"] == "Suresh Kirana"
    assert result["amount"] == 1200.0
    assert result["category"] == "operating_expense"


def test_gemini_upstream_failure_raises_extraction_error():
    """Upstream Gemini failures must raise ExtractionError and NEVER silently substitute fake text."""
    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini 503 Service Unavailable")

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Received 5000 from customer")
    assert "Gemini extraction failed" in str(exc_info.value)


def test_gemini_empty_transcript_raises_extraction_error():
    """Empty or whitespace-only transcript raises ExtractionError."""
    mock_genai_client = MagicMock()
    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)

    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("    ")
    assert "Transcript is empty" in str(exc_info.value)


def test_gemini_empty_output_raises_extraction_error():
    """Empty output or unparseable text from Gemini raises ExtractionError."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = ""
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Some transaction speech")
    assert "empty structured output" in str(exc_info.value)


def test_api_endpoint_gemini_success_mocked(monkeypatch):
    """POST /voice/extract returns 200 with suggested_transaction and requires_confirmation=True."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-09",
        party_name="Kisan Fertilisers",
        item="Urea Bag",
        amount=350.0,
        tx_type="debit",
        category="raw_material",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    mock_provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Bought urea bag from Kisan Fertilisers for 350"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["requires_confirmation"] is True
    assert data["transcript"] == "Bought urea bag from Kisan Fertilisers for 350"
    tx = data["suggested_transaction"]
    assert tx["party_name"] == "Kisan Fertilisers"
    assert tx["item"] == "Urea Bag"
    assert tx["amount"] == 350.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "raw_material"


def test_api_endpoint_gemini_upstream_failure_returns_502(monkeypatch):
    """When Gemini API call fails upstream, API endpoint returns HTTP 502 Bad Gateway.

    Must NOT return fake stub data or silently succeed.
    """
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception("Gemini quota exceeded")
    mock_provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Some transaction"})

    assert resp.status_code == 502
    assert "Upstream extraction error" in resp.json()["detail"]


def test_api_endpoint_untrusted_ai_invalid_category_returns_422(monkeypatch):
    """If Gemini returns an invalid category, Pydantic validation rejects it with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract.return_value = {
        "date": "2026-09-09",
        "party_name": "Trader",
        "item": "Supplies",
        "amount": 5000.0,
        "tx_type": "credit",
        "category": "invalid_cryptocurrency_category",
    }

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Received 5000 from Trader"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_api_endpoint_untrusted_ai_negative_amount_returns_422(monkeypatch):
    """If Gemini returns a negative amount, Pydantic validation rejects it with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract.return_value = {
        "date": "2026-09-09",
        "party_name": "Trader",
        "item": "Supplies",
        "amount": -500.0,
        "tx_type": "debit",
        "category": "raw_material",
    }

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Paid negative 500"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_api_endpoint_untrusted_ai_whitespace_party_returns_422(monkeypatch):
    """If Gemini returns empty or whitespace party_name, Pydantic validation rejects it with HTTP 422."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_provider = MagicMock()
    mock_provider.extract.return_value = {
        "date": "2026-09-09",
        "party_name": "    ",
        "item": "Supplies",
        "amount": 500.0,
        "tx_type": "debit",
        "category": "raw_material",
    }

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Paid 500 for supplies"})

    assert resp.status_code == 422
    assert "invalid transaction data" in resp.json()["detail"].lower()


def test_voice_extract_does_not_mutate_ledger_or_calculate_finance(monkeypatch):
    """Verify /voice/extract is strictly a suggestion endpoint with no ledger or finance side effects."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-09",
        party_name="Anil Babu",
        item="Desks",
        amount=14000.0,
        tx_type="credit",
        category="sales",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response
    mock_provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)

    with patch("app.main.get_extraction_provider", return_value=mock_provider), \
         patch("app.main.compute_financial_summary") as mock_compute:
        resp = client.post("/voice/extract", json={"transcript": "Received 14000 from Anil Babu"})

    assert resp.status_code == 200
    mock_compute.assert_not_called()
    data = resp.json()
    assert "turnover" not in data
    assert "maximum_permissible_bank_finance" not in data
    assert "working_capital_requirement" not in data
