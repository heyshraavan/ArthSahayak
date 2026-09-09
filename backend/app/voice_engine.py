"""Voice extraction engine provider abstractions and untrusted AI input validation.

Architecture:
Audio
-> TranscriptionProvider
-> transcript
-> ExtractionProvider
-> untrusted suggested transaction
-> Pydantic validation
-> human review/edit
-> explicit confirmation
-> trusted ledger transaction
"""

import base64
from datetime import date
import re
from typing import Any, Protocol

from pydantic import ValidationError

from app.schemas import Transaction, TransactionCategory


class TranscriptionProvider(Protocol):
    """Protocol for audio transcription services (e.g. Groq Whisper, Bhashini STT)."""

    def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        """Transcribe raw audio bytes into text."""
        ...


class ExtractionProvider(Protocol):
    """Protocol for extracting structured transaction data from speech transcripts."""

    def extract(self, transcript: str) -> dict[str, Any]:
        """Extract raw, untrusted transaction dictionary from transcript text."""
        ...


class StubTranscriptionProvider:
    """Stub transcription provider for testing interfaces and end-to-end data flow.

    Does not call external AI providers. Returns safe representative transcripts
    or decodes test payload markers.
    """

    def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        # Check for test payload marker
        if audio_data.startswith(b"test:"):
            return audio_data[5:].decode("utf-8", errors="replace").strip()

        # Representative default rural transaction transcript for stub testing
        return "Received Rs 14000 from Anil Babu for 2 desks"


class StubExtractionProvider:
    """Stub extraction provider for testing interface contracts and UI confirmation flows.

    NOTE: This is a testing stub and does NOT pretend to perform arbitrary-language AI
    understanding. It maps representative rural transaction patterns and test scenarios
    into raw, untrusted dictionaries that MUST be validated by Pydantic.
    """

    def extract(self, transcript: str) -> dict[str, Any]:
        cleaned = transcript.strip()

        # Explicit test injections for verifying untrusted AI error handling
        if "[TEST_INVALID_CATEGORY]" in cleaned:
            return {
                "date": date.today(),
                "party_name": "Test Party",
                "item": "Test Item",
                "amount": 1000.0,
                "tx_type": "credit",
                "category": "unsupported_crypto_category",
            }

        if "[TEST_INVALID_AMOUNT]" in cleaned:
            return {
                "date": date.today(),
                "party_name": "Test Party",
                "item": "Test Item",
                "amount": -500.0,
                "tx_type": "debit",
                "category": "raw_material",
            }

        if "[TEST_MALFORMED]" in cleaned:
            return {
                "date": "not-a-date",
                "party_name": "   ",
                "item": "",
                "amount": 100.0,
                "tx_type": "unknown_type",
                "category": None,
            }

        # Representative Scenario 1: Timber depot purchase
        if "timber" in cleaned.lower() or "planks" in cleaned.lower() or "लकड़ी" in cleaned:
            amount = self._extract_amount(cleaned, default=7500.0)
            return {
                "date": date.today(),
                "party_name": "Maa Tara Timber Depot",
                "item": "Timber Planks",
                "amount": amount,
                "tx_type": "debit",
                "category": "raw_material",
            }

        # Representative Scenario 2: Wage payment
        if "wage" in cleaned.lower() or "salary" in cleaned.lower() or "मजदूरी" in cleaned:
            amount = self._extract_amount(cleaned, default=5000.0)
            return {
                "date": date.today(),
                "party_name": "Biren Da",
                "item": "Weekly Wages",
                "amount": amount,
                "tx_type": "debit",
                "category": "operating_expense",
            }

        # Representative Scenario 3: School furniture order (Sales)
        if "school" in cleaned.lower() or "desk" in cleaned.lower() or "स्कूल" in cleaned:
            amount = self._extract_amount(cleaned, default=14000.0)
            return {
                "date": date.today(),
                "party_name": "Anil Babu (School)",
                "item": "2 Desks & Benches",
                "amount": amount,
                "tx_type": "credit",
                "category": "sales",
            }

        # General pattern matcher for simple speech phrases
        is_debit = any(w in cleaned.lower() for w in ["paid", "bought", "spent", "purchase", "खर्च", "दिए", "खरीदा"])
        tx_type = "debit" if is_debit else "credit"
        category: TransactionCategory = "raw_material" if is_debit else "sales"
        amount = self._extract_amount(cleaned, default=1000.0)

        # Extract party name if 'from' or 'to' is present
        party = "Customer" if tx_type == "credit" else "Supplier"
        match_party = re.search(r"(?:from|to|party)\s+([A-Za-z0-9\s]+?)(?:\s+for|\s+amount|\s+rs|\s+₹|$)", cleaned, re.IGNORECASE)
        if match_party and match_party.group(1).strip():
            party = match_party.group(1).strip()

        # Extract item if 'for' is present
        item = "Carpentry Work" if tx_type == "credit" else "Supplies"
        match_item = re.search(r"(?:for)\s+([A-Za-z0-9\s]+?)(?:\s+amount|\s+rs|\s+₹|$)", cleaned, re.IGNORECASE)
        if match_item and match_item.group(1).strip():
            item = match_item.group(1).strip()

        return {
            "date": date.today(),
            "party_name": party,
            "item": item,
            "amount": amount,
            "tx_type": tx_type,
            "category": category,
        }

    def _extract_amount(self, text: str, default: float) -> float:
        """Helper to extract positive numeric amount from text string."""
        match = re.search(r"(?:rs\.?|inr|₹)?\s*([0-9]+(?:\.[0-9]+)?)", text, re.IGNORECASE)
        if match:
            try:
                val = float(match.group(1))
                if val > 0:
                    return val
            except ValueError:
                pass
        return default


def validate_suggested_transaction(raw_dict: dict[str, Any]) -> Transaction:
    """Validate untrusted AI extraction output through Pydantic.

    Raises ValidationError if any field fails schema requirements
    (e.g., negative amount, whitespace party name, invalid category, bad date).
    Never silently repairs invalid data.
    """
    return Transaction.model_validate(raw_dict)
