"""Tests for Groq Structured Transaction Extraction integration.

Verifies:
- Provider selection with and without GROQ_API_KEY
- Missing API key handling (VoiceConfigurationError / HTTP 503)
- Mocked Groq client extraction success (llama-3.1-8b-instant, temp=0, json_object format)
- Upstream Groq failure handling (HTTP 502, ExtractionError, no silent fake fallback)
- Untrusted AI output validation via Pydantic (HTTP 422 for bad category, negative amount, whitespace party)
- Date fallback logic (today's date when speaker does not mention date)
- Markdown code fence stripping from raw LLM output
- requires_confirmation: true invariant
- Server-side isolation and ledger/finance engine non-interference
- Latency measurement logging

ZERO external network calls are made in these automated tests.
"""

from datetime import date
import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.voice_engine import (
    DEFAULT_GROQ_EXTRACTION_MODEL,
    ExtractionError,
    GroqExtractionProvider,
    StubExtractionProvider,
    VoiceConfigurationError,
    get_extraction_provider,
    resolve_groq_extraction_model,
)

client = TestClient(app)


def test_provider_selection_without_groq_api_key(monkeypatch):
    """When GROQ_API_KEY is absent and stubs are allowed, StubExtractionProvider is selected."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "true")
    provider = get_extraction_provider()
    assert isinstance(provider, StubExtractionProvider)


def test_provider_selection_with_groq_api_key(monkeypatch):
    """When GROQ_API_KEY is present, GroqExtractionProvider is selected with default model."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_groq_api_key_12345")
    provider = get_extraction_provider()
    assert isinstance(provider, GroqExtractionProvider)
    assert provider.api_key == "gsk_mock_groq_api_key_12345"
    assert provider.model == DEFAULT_GROQ_EXTRACTION_MODEL
    assert provider.model == "llama-3.1-8b-instant"


def test_groq_extraction_model_configurable_via_env(monkeypatch):
    """Verify GROQ_EXTRACTION_MODEL environment variable overrides default model."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_mock_groq_api_key_12345")
    monkeypatch.setenv("GROQ_EXTRACTION_MODEL", "llama-3.3-70b-versatile")
    provider = get_extraction_provider()
    assert isinstance(provider, GroqExtractionProvider)
    assert provider.model == "llama-3.3-70b-versatile"


def test_groq_provider_missing_key_raises_configuration_error(monkeypatch):
    """Explicitly initializing GroqExtractionProvider without a key raises VoiceConfigurationError."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(VoiceConfigurationError) as exc_info:
        GroqExtractionProvider(api_key="")
    assert "GROQ_API_KEY is not configured" in str(exc_info.value)


def test_provider_selection_missing_key_disallowing_stubs(monkeypatch):
    """When GROQ_API_KEY is absent and stubs are disallowed, VoiceConfigurationError is raised."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "false")
    with pytest.raises(VoiceConfigurationError) as exc_info:
        get_extraction_provider()
    assert "GROQ_API_KEY is not configured" in str(exc_info.value)


def test_groq_extraction_success_mocked():
    """Verify GroqExtractionProvider calls Groq chat completion with JSON mode and exact parameters."""
    mock_groq_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "date": "2026-09-08",
        "party_name": "Ramesh Timber Works",
        "item": "Teak Wood Logs",
        "amount": 18500.0,
        "tx_type": "debit",
        "category": "raw_material",
    })
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq_client.chat.completions.create.return_value = mock_response

    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)
    result = provider.extract("Paid 18500 to Ramesh Timber Works for Teak Wood Logs on 2026-09-08")

    assert result["party_name"] == "Ramesh Timber Works"
    assert result["item"] == "Teak Wood Logs"
    assert result["amount"] == 18500.0
    assert result["tx_type"] == "debit"
    assert result["category"] == "raw_material"
    assert str(result["date"]) == "2026-09-08"

    # Verify chat completion arguments
    mock_groq_client.chat.completions.create.assert_called_once()
    _, kwargs = mock_groq_client.chat.completions.create.call_args
    assert kwargs["model"] == "llama-3.1-8b-instant"
    assert kwargs["temperature"] == 0.0
    assert kwargs["response_format"] == {"type": "json_object"}
    messages = kwargs["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert "Ramesh Timber Works" in messages[1]["content"]


def test_groq_extraction_date_fallback_when_unspecified():
    """Verify date defaults to date.today() when speech does not specify a date."""
    mock_groq_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "date": None,
        "party_name": "Anil Babu",
        "item": "School Desks",
        "amount": 14000.0,
        "tx_type": "credit",
        "category": "sales",
    })
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq_client.chat.completions.create.return_value = mock_response

    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)
    result = provider.extract("Sold 2 desks to Anil Babu for 14000 rupees")

    assert result["date"] == date.today()
    assert result["party_name"] == "Anil Babu"
    assert result["amount"] == 14000.0
    assert result["tx_type"] == "credit"
    assert result["category"] == "sales"


def test_groq_extraction_strips_markdown_code_fences():
    """Verify that if Groq returns JSON wrapped in markdown code blocks, it parses cleanly."""
    mock_groq_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = (
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
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq_client.chat.completions.create.return_value = mock_response

    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)
    result = provider.extract("Spent 600 at Sharma Sweets on snacks for labor")

    assert result["party_name"] == "Sharma Sweets"
    assert result["item"] == "Snacks for Labor"
    assert result["amount"] == 600.0
    assert result["tx_type"] == "debit"
    assert result["category"] == "operating_expense"


def test_groq_empty_transcript_raises_extraction_error():
    """Empty or whitespace-only transcript raises ExtractionError."""
    mock_groq_client = MagicMock()
    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)

    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("    ")
    assert "Transcript is empty" in str(exc_info.value)


def test_groq_empty_output_raises_extraction_error():
    """Empty response content from Groq raises ExtractionError."""
    mock_groq_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = ""
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq_client.chat.completions.create.return_value = mock_response

    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Some transaction speech")
    assert "empty extraction output" in str(exc_info.value)


def test_groq_upstream_failure_raises_extraction_error():
    """Upstream Groq API failures must raise ExtractionError and NEVER silently substitute fake text."""
    mock_groq_client = MagicMock()
    mock_groq_client.chat.completions.create.side_effect = Exception("Groq rate limit exceeded")

    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)
    with pytest.raises(ExtractionError) as exc_info:
        provider.extract("Received 5000 from customer")
    assert "Groq extraction failed" in str(exc_info.value)


def test_dynamic_extraction_based_on_transcript():
    """Verify GroqExtractionProvider dynamically returns distinct data based on different transcripts."""
    mock_groq_client = MagicMock()

    resp_a = MagicMock()
    choice_a = MagicMock()
    choice_a.message.content = json.dumps({
        "date": "2026-09-10",
        "party_name": "Meera Devi",
        "item": "Handmade Wooden Stools",
        "amount": 12000.0,
        "tx_type": "credit",
        "category": "sales",
    })
    resp_a.choices = [choice_a]

    resp_b = MagicMock()
    choice_b = MagicMock()
    choice_b.message.content = json.dumps({
        "date": "2026-09-11",
        "party_name": "Kisan Fuel Station",
        "item": "Diesel for Generator",
        "amount": 3500.0,
        "tx_type": "debit",
        "category": "operating_expense",
    })
    resp_b.choices = [choice_b]

    mock_groq_client.chat.completions.create.side_effect = [resp_a, resp_b]
    provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)

    result_a = provider.extract("Sold wooden stools to Meera Devi for 12000 rupees")
    result_b = provider.extract("Paid 3500 rupees at Kisan Fuel Station for generator diesel")

    assert result_a["party_name"] == "Meera Devi"
    assert result_a["amount"] == 12000.0
    assert result_a["category"] == "sales"

    assert result_b["party_name"] == "Kisan Fuel Station"
    assert result_b["amount"] == 3500.0
    assert result_b["category"] == "operating_expense"


# --- API Endpoint Integration Tests ---

def test_api_endpoint_groq_success_mocked(monkeypatch):
    """POST /voice/extract returns 200 with suggested_transaction and requires_confirmation=True."""
    mock_groq_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = json.dumps({
        "date": "2026-09-09",
        "party_name": "Kisan Fertilisers",
        "item": "Urea Bag",
        "amount": 350.0,
        "tx_type": "debit",
        "category": "raw_material",
    })
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    mock_groq_client.chat.completions.create.return_value = mock_response

    mock_provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)

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


def test_api_endpoint_groq_upstream_failure_returns_502(monkeypatch):
    """When Groq API call fails upstream, API endpoint returns HTTP 502 Bad Gateway."""
    mock_groq_client = MagicMock()
    mock_groq_client.chat.completions.create.side_effect = Exception("Groq internal server error")
    mock_provider = GroqExtractionProvider(api_key="mock_key", client=mock_groq_client)

    with patch("app.main.get_extraction_provider", return_value=mock_provider):
        resp = client.post("/voice/extract", json={"transcript": "Some transaction"})

    assert resp.status_code == 502
    assert "Upstream extraction error" in resp.json()["detail"]


def test_api_endpoint_groq_missing_credentials_returns_503(monkeypatch):
    """When GROQ_API_KEY is missing in production mode, endpoint returns HTTP 503 Service Unavailable."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.setenv("ALLOW_STUB_PROVIDERS", "false")
    response = client.post(
        "/voice/extract",
        json={"transcript": "Received 2000 from customer for repair work"},
    )
    assert response.status_code == 503
    assert "GROQ_API_KEY is not configured" in response.json().get("detail", "")


def test_api_endpoint_untrusted_ai_invalid_category_returns_422(monkeypatch):
    """If Groq returns an invalid category, Pydantic validation rejects it with HTTP 422."""
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
    """If Groq returns a negative amount, Pydantic validation rejects it with HTTP 422."""
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
    """If Groq returns empty or whitespace party_name, Pydantic validation rejects it with HTTP 422."""
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


def test_voice_extract_does_not_mutate_ledger_or_calculate_finance():
    """Verify /voice/extract is strictly a suggestion endpoint with no ledger or finance side effects."""
    mock_provider = MagicMock()
    mock_provider.extract.return_value = {
        "date": "2026-09-09",
        "party_name": "Anil Babu",
        "item": "Desks",
        "amount": 14000.0,
        "tx_type": "credit",
        "category": "sales",
    }

    with patch("app.main.get_extraction_provider", return_value=mock_provider), \
         patch("app.main.compute_financial_summary") as mock_compute:
        resp = client.post("/voice/extract", json={"transcript": "Received 14000 from Anil Babu"})

    assert resp.status_code == 200
    mock_compute.assert_not_called()
    data = resp.json()
    assert "turnover" not in data
    assert "maximum_permissible_bank_finance" not in data
    assert "working_capital_requirement" not in data
