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


def test_gemini_provider_direct_instantiation(monkeypatch):
    """When initialized with API key, GeminiExtractionProvider uses default model."""
    provider = GeminiExtractionProvider(api_key="mock_gemini_api_key_xyz987")
    assert provider.api_key == "mock_gemini_api_key_xyz987"
    assert provider.model == DEFAULT_GEMINI_MODEL
    assert provider.model == "gemini-3.1-flash-lite"
    assert DEFAULT_GEMINI_MODEL == "gemini-3.1-flash-lite"


def test_gemini_extraction_model_configurable_via_env(monkeypatch):
    """Verify GEMINI_MODEL environment variable overrides default model for GeminiExtractionProvider."""
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.5-flash")
    provider = GeminiExtractionProvider(api_key="mock_gemini_api_key_xyz987")
    assert provider.model == "gemini-3.5-flash"


def test_gemini_model_configuration_consistency_across_ocr(monkeypatch):
    """Verify OCR provider uses the configured model from GEMINI_MODEL."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_gemini_api_key_xyz987")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-3.8-flash")

    from app.services.ocr import get_ocr_provider

    ocr_provider = get_ocr_provider()
    assert ocr_provider.model == "gemini-3.8-flash"



def test_gemini_provider_missing_key_raises_configuration_error(monkeypatch):
    """Explicitly initializing GeminiExtractionProvider without a key raises VoiceConfigurationError."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(VoiceConfigurationError) as exc_info:
        GeminiExtractionProvider(api_key="")
    assert "GEMINI_API_KEY is not configured" in str(exc_info.value)


def test_gemini_extraction_success_mocked():
    """Verify GeminiExtractionProvider calls Google GenAI SDK with exact parameters.

    Requirements:
    - model='gemini-2.5-flash'
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
    assert kwargs["model"] == "gemini-3.1-flash-lite"
    config = kwargs["config"]
    assert config.temperature == 0.0
    assert config.response_mime_type == "application/json"
    assert config.response_schema == GeminiTransactionExtraction
    assert config.automatic_function_calling.disable is True


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


def test_api_endpoint_gemini_503_unavailable_returns_502(monkeypatch):
    """When Gemini returns 503 UNAVAILABLE (high demand), endpoint cleanly returns 502 with model name in detail."""
    monkeypatch.setenv("GEMINI_API_KEY", "mock_key")

    mock_genai_client = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "503 UNAVAILABLE: This model is currently experiencing high demand."
    )
    mock_provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=MagicMock())

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Sold 2 tables for 5000"})

    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "Upstream extraction error" in detail
    assert "gemini-3.1-flash-lite" in detail
    assert "503 UNAVAILABLE" in detail


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


def test_gemini_provider_missing_key_disallowing_stubs(monkeypatch):
    """When initializing GeminiExtractionProvider directly with empty key, VoiceConfigurationError is raised."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(VoiceConfigurationError) as exc_info:
        GeminiExtractionProvider(api_key="")
    assert "GEMINI_API_KEY is not configured" in str(exc_info.value)


def test_dynamic_extraction_based_on_transcript():
    """Verify GeminiExtractionProvider dynamically returns distinct data based on different transcripts."""
    mock_genai_client = MagicMock()

    # Scenario A: Sales transaction
    tx_a = GeminiTransactionExtraction(
        date="2026-09-10",
        party_name="Meera Devi",
        item="Handmade Wooden Stools",
        amount=12000.0,
        tx_type="credit",
        category="sales",
    )
    resp_a = MagicMock()
    resp_a.parsed = tx_a
    resp_a.text = json.dumps(tx_a.model_dump())

    # Scenario B: Operating expense transaction
    tx_b = GeminiTransactionExtraction(
        date="2026-09-11",
        party_name="Kisan Fuel Station",
        item="Diesel for Generator",
        amount=3500.0,
        tx_type="debit",
        category="operating_expense",
    )
    resp_b = MagicMock()
    resp_b.parsed = tx_b
    resp_b.text = json.dumps(tx_b.model_dump())

    mock_genai_client.models.generate_content.side_effect = [resp_a, resp_b]
    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)

    result_a = provider.extract("Sold wooden stools to Meera Devi for 12000 rupees")
    result_b = provider.extract("Paid 3500 rupees at Kisan Fuel Station for generator diesel")

    # Assert results are completely distinct and reflect the respective speech inputs
    assert result_a["party_name"] == "Meera Devi"
    assert result_a["item"] == "Handmade Wooden Stools"
    assert result_a["amount"] == 12000.0
    assert result_a["tx_type"] == "credit"
    assert result_a["category"] == "sales"

    assert result_b["party_name"] == "Kisan Fuel Station"
    assert result_b["item"] == "Diesel for Generator"
    assert result_b["amount"] == 3500.0
    assert result_b["tx_type"] == "debit"
    assert result_b["category"] == "operating_expense"

    # Confirm generate_content was called twice with different prompts containing the transcripts
    assert mock_genai_client.models.generate_content.call_count == 2
    prompt_a = mock_genai_client.models.generate_content.call_args_list[0].kwargs["contents"]
    prompt_b = mock_genai_client.models.generate_content.call_args_list[1].kwargs["contents"]
    assert "Meera Devi" in prompt_a
    assert "Kisan Fuel Station" in prompt_b


def test_gemini_extraction_disables_afc_in_config():
    """Verify Gemini extraction explicitly sets automatic_function_calling.disable=True.

    Prevents deprecated AFC warning and unnecessary AFC remote loops in single-turn extraction.
    """
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-12",
        party_name="Verma Hardware",
        item="Nails and Screws",
        amount=450.0,
        tx_type="debit",
        category="raw_material",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    provider.extract("Paid 450 to Verma Hardware for nails and screws")

    _, kwargs = mock_genai_client.models.generate_content.call_args
    config = kwargs["config"]
    assert config.automatic_function_calling is not None
    assert config.automatic_function_calling.disable is True


def test_gemini_extraction_strips_markdown_code_fences_from_json_fallback():
    """Verify that if response.parsed is None and response.text is wrapped in markdown code fences, it parses successfully."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_response.parsed = None
    mock_response.text = (
        "```json\n"
        "{\n"
        '  "date": "2026-09-12",\n'
        '  "party_name": "Sharma Sweets",\n'
        '  "item": "Snacks for Labor",\n'
        '  "amount": 600.0,\n'
        '  "tx_type": "debit",\n'
        '  "category": "operating_expense"\n'
        "}\n"
        "```"
    )
    mock_genai_client.models.generate_content.return_value = mock_response

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client)
    result = provider.extract("Spent 600 at Sharma Sweets on snacks for labor")

    assert result["party_name"] == "Sharma Sweets"
    assert result["item"] == "Snacks for Labor"
    assert result["amount"] == 600.0
    assert result["tx_type"] == "debit"
    assert result["category"] == "operating_expense"


def test_gemini_extraction_retries_on_503_and_succeeds():
    """Verify Gemini voice extraction retries on transient 503 error and succeeds on subsequent attempt."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-12",
        party_name="Gupta Timber",
        item="Teak Wood",
        amount=5000.0,
        tx_type="debit",
        category="raw_material",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())

    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = [
        Exception("503 UNAVAILABLE: This model is currently experiencing high demand."),
        mock_response,
    ]

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    result = provider.extract("Paid 5000 to Gupta Timber for teak wood")

    assert result["party_name"] == "Gupta Timber"
    assert result["amount"] == 5000.0
    assert mock_genai_client.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1
    mock_sleep.assert_called_once_with(0.5)


def test_gemini_extraction_retries_on_429_and_succeeds():
    """Verify Gemini voice extraction retries on transient 429 rate limit error and succeeds."""
    mock_genai_client = MagicMock()
    mock_response = MagicMock()
    mock_extraction = GeminiTransactionExtraction(
        date="2026-09-12",
        party_name="Kiran Tea Stall",
        item="Morning Tea",
        amount=150.0,
        tx_type="debit",
        category="operating_expense",
    )
    mock_response.parsed = mock_extraction
    mock_response.text = json.dumps(mock_extraction.model_dump())

    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = [
        Exception("429 RESOURCE_EXHAUSTED: Rate limit exceeded. Please try again later."),
        mock_response,
    ]

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    result = provider.extract("Paid 150 for morning tea at Kiran Tea Stall")

    assert result["party_name"] == "Kiran Tea Stall"
    assert result["amount"] == 150.0
    assert mock_genai_client.models.generate_content.call_count == 2
    assert mock_sleep.call_count == 1


def test_gemini_extraction_does_not_retry_on_invalid_api_key():
    """Verify Gemini voice extraction fails immediately on 401/403 auth error with ZERO retries."""
    mock_genai_client = MagicMock()
    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "401 UNAUTHENTICATED: API_KEY_INVALID. Please pass a valid API key."
    )

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Paid 200 for nails")

    assert "API_KEY_INVALID" in str(exc_info.value)
    # Must fail immediately on attempt 1 without retrying
    assert mock_genai_client.models.generate_content.call_count == 1
    assert mock_sleep.call_count == 0


def test_gemini_extraction_fails_after_max_attempts_exhausted():
    """Verify Gemini voice extraction raises ExtractionError after 3 failed transient attempts."""
    mock_genai_client = MagicMock()
    mock_sleep = MagicMock()
    mock_genai_client.models.generate_content.side_effect = Exception(
        "503 UNAVAILABLE: Server overloaded"
    )

    provider = GeminiExtractionProvider(api_key="mock_key", client=mock_genai_client, sleep_fn=mock_sleep)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Paid 200 for nails")

    assert "503 UNAVAILABLE" in str(exc_info.value)
    assert mock_genai_client.models.generate_content.call_count == 3
    assert mock_sleep.call_count == 2
    assert mock_sleep.call_args_list[0][0][0] == 0.5
    assert mock_sleep.call_args_list[1][0][0] == 1.0


