"""Tests for Voice Transcription and Structured Extraction pipeline.

Verifies provider abstractions, untrusted AI input validation via Pydantic,
rejection of invalid categories/amounts/formats, human confirmation requirement,
and non-interference with ledger and finance engine calculations.
"""

import base64
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_valid_structured_extraction():
    """Verify structured extraction from valid rural transaction transcript."""
    payload = {"transcript": "Received Rs 14000 from Anil Babu for 2 desks"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["transcript"] == "Received Rs 14000 from Anil Babu for 2 desks"
    assert data["requires_confirmation"] is True

    tx = data["suggested_transaction"]
    assert tx["party_name"] == "Anil Babu (School)"
    assert tx["item"] == "2 Desks & Benches"
    assert tx["amount"] == 14000.0
    assert tx["tx_type"] == "credit"
    assert tx["category"] == "sales"
    assert "date" in tx


def test_valid_extraction_raw_material():
    """Verify structured extraction of expense/raw material transaction."""
    payload = {"transcript": "Paid Rs 7500 to Maa Tara Timber Depot for timber planks"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["requires_confirmation"] is True
    tx = data["suggested_transaction"]
    assert tx["party_name"] == "Maa Tara Timber Depot"
    assert tx["item"] == "Timber Planks"
    assert tx["amount"] == 7500.0
    assert tx["tx_type"] == "debit"
    assert tx["category"] == "raw_material"


def test_invalid_category_rejection():
    """Verify 422 Unprocessable Entity when untrusted AI output generates an invalid category."""
    payload = {"transcript": "Payment [TEST_INVALID_CATEGORY] for supplies"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 422
    err_detail = response.json().get("detail", "")
    assert "invalid transaction data" in str(err_detail).lower()


def test_invalid_amount_rejection():
    """Verify 422 Unprocessable Entity when untrusted AI output contains a negative amount."""
    payload = {"transcript": "Refund [TEST_INVALID_AMOUNT] for lumber"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 422
    err_detail = response.json().get("detail", "")
    assert "invalid transaction data" in str(err_detail).lower()


def test_malformed_ai_output_rejection():
    """Verify 422 Unprocessable Entity when untrusted AI output is malformed (bad date, whitespace party)."""
    payload = {"transcript": "Corrupt record [TEST_MALFORMED]"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 422


def test_empty_transcript_rejection():
    """Verify 422 Unprocessable Entity when transcript is empty."""
    response = client.post("/voice/extract", json={"transcript": ""})
    assert response.status_code == 422


def test_transcription_endpoint_success():
    """Verify POST /voice/transcribe processes base64 audio payload and returns transcript."""
    sample_audio_bytes = b"test:Paid Rs 5000 to Biren Da for weekly wages"
    encoded_b64 = base64.b64encode(sample_audio_bytes).decode("utf-8")

    payload = {
        "audio_base64": encoded_b64,
        "mime_type": "audio/webm",
    }
    response = client.post("/voice/transcribe", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["transcript"] == "Paid Rs 5000 to Biren Da for weekly wages"
    assert "confidence" in data


def test_transcription_endpoint_invalid_base64():
    """Verify 422 Unprocessable Entity when audio_base64 is empty or corrupt."""
    # Empty audio string
    response = client.post("/voice/transcribe", json={"audio_base64": ""})
    assert response.status_code == 422


def test_transaction_cannot_bypass_human_confirmation():
    """Verify extraction returns a suggestion only, does NOT execute financial calculations.

    The extraction endpoint must not return financial summaries, nor invoke turnover/WCR formulas.
    """
    payload = {"transcript": "Received Rs 14000 from Anil Babu for 2 desks"}
    response = client.post("/voice/extract", json=payload)
    assert response.status_code == 200

    data = response.json()
    # Explicit confirmation flag MUST be True
    assert data["requires_confirmation"] is True
    # Verify no financial calculation fields exist on extraction response
    assert "turnover" not in data
    assert "working_capital_requirement" not in data
    assert "maximum_permissible_bank_finance" not in data
    assert "dscr" not in data


def test_existing_manual_transaction_flow_remains_functional():
    """Verify POST /finance/calculate still computes accurately with manually entered transactions."""
    payload = {
        "transactions": [
            {
                "date": "2026-09-08",
                "party_name": "Anil Babu",
                "item": "2 Desks",
                "amount": 14000.0,
                "tx_type": "credit",
                "category": "sales",
            },
            {
                "date": "2026-09-06",
                "party_name": "Maa Tara Timber Depot",
                "item": "Planks",
                "amount": 7500.0,
                "tx_type": "debit",
                "category": "raw_material",
            },
        ],
        "net_operating_income": 20000.0,
        "debt_service": 10000.0,
    }
    response = client.post("/finance/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_credit"] == 14000.0
    assert data["total_debit"] == 7500.0
    assert data["turnover"] == 14000.0
    assert data["working_capital_requirement"] == 3500.0
    assert data["promoter_margin"] == 700.0
    assert data["maximum_permissible_bank_finance"] == 2800.0
    assert data["dscr"] == 2.0
