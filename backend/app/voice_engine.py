"""Voice extraction engine provider abstractions and untrusted AI input validation.

Architecture:
Audio
-> TranscriptionProvider (Groq Whisper / Stub)
-> transcript
-> ExtractionProvider (Gemini / Stub)
-> untrusted suggested transaction
-> Pydantic validation
-> human review/edit
-> explicit confirmation
-> trusted ledger transaction
"""

from datetime import date
import json
import os
import re
from typing import Any, Literal, Optional, Protocol

from pydantic import BaseModel, Field, ValidationError

from app.schemas import Transaction, TransactionCategory

MAX_AUDIO_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB application limit

DEFAULT_GEMINI_MODEL: str = "gemini-3.6-flash"

SUPPORTED_AUDIO_MIME_TYPES = {
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/ogg",
    "audio/m4a",
    "audio/x-m4a",
    "audio/flac",
}


class VoiceConfigurationError(Exception):
    """Raised when voice provider configuration or credentials are missing or invalid."""
    pass


class TranscriptionError(Exception):
    """Raised when upstream transcription service encounters an error."""
    pass


class ExtractionError(Exception):
    """Raised when upstream structured extraction service encounters an error."""
    pass


class AudioValidationError(Exception):
    """Raised when audio payload fails validation (e.g. unsupported MIME or > 10 MB)."""
    pass


def validate_audio_payload(audio_data: bytes, mime_type: str) -> None:
    """Validate audio MIME type and 10 MB application-level size limit.

    Raises AudioValidationError if audio is empty, exceeds 10 MB, or has unsupported MIME.
    """
    if not audio_data:
        raise AudioValidationError("Audio data is empty")

    if len(audio_data) > MAX_AUDIO_SIZE_BYTES:
        raise AudioValidationError(
            f"Audio payload size ({len(audio_data)} bytes) exceeds the 10 MB application limit"
        )

    normalized_mime = mime_type.split(";")[0].strip().lower()
    if normalized_mime not in SUPPORTED_AUDIO_MIME_TYPES:
        raise AudioValidationError(
            f"Unsupported audio MIME type '{mime_type}'. Supported formats: {', '.join(sorted(SUPPORTED_AUDIO_MIME_TYPES))}"
        )


class TranscriptionProvider(Protocol):
    """Protocol for audio transcription services (e.g. Groq Whisper, Bhashini STT)."""

    def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        """Transcribe raw audio bytes into text."""
        ...


class GroqWhisperTranscriptionProvider:
    """Real speech transcription provider utilizing Groq Whisper API (whisper-large-v3).

    Strictly server-side integration. The API key is read from GROQ_API_KEY environment
    variable or passed during initialization. Never hard-coded, never committed.
    """

    def __init__(self, api_key: Optional[str] = None, client: Optional[Any] = None) -> None:
        self.api_key = (api_key or os.environ.get("GROQ_API_KEY", "")).strip()
        if not self.api_key:
            raise VoiceConfigurationError(
                "GROQ_API_KEY is not configured. Provide an API key or set GROQ_API_KEY environment variable."
            )

        if client is not None:
            self._client = client
        else:
            try:
                from groq import Groq
                self._client = Groq(api_key=self.api_key)
            except ImportError as e:
                raise VoiceConfigurationError(f"Groq SDK is not installed: {e}") from e

    def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        """Transcribe audio bytes using Groq Whisper.

        Validates MIME type and size limit before calling Groq.
        Detects multilingual speech without hard-coding language.
        Uses temperature=0 and response_format='json'.
        """
        validate_audio_payload(audio_data, mime_type)

        # Derive safe file extension for Whisper
        normalized_mime = mime_type.split(";")[0].strip().lower()
        extension_map = {
            "audio/webm": "recording.webm",
            "audio/wav": "recording.wav",
            "audio/wave": "recording.wav",
            "audio/x-wav": "recording.wav",
            "audio/mp3": "recording.mp3",
            "audio/mpeg": "recording.mp3",
            "audio/mp4": "recording.m4a",
            "audio/m4a": "recording.m4a",
            "audio/x-m4a": "recording.m4a",
            "audio/ogg": "recording.ogg",
            "audio/flac": "recording.flac",
        }
        filename = extension_map.get(normalized_mime, "recording.webm")

        try:
            response = self._client.audio.transcriptions.create(
                file=(filename, audio_data),
                model="whisper-large-v3",
                temperature=0.0,
                response_format="json",
            )
        except Exception as err:
            raise TranscriptionError(f"Groq Whisper transcription failed: {err}") from err

        # Extract transcript text
        if hasattr(response, "text"):
            transcript = response.text
        elif isinstance(response, dict):
            transcript = response.get("text", "")
        else:
            transcript = str(response)

        if not transcript.strip():
            raise TranscriptionError("Groq Whisper returned an empty transcription")

        return transcript.strip()


class StubTranscriptionProvider:
    """Stub transcription provider for testing interfaces and end-to-end data flow.

    Does not call external AI providers. Returns safe representative transcripts
    or decodes test payload markers.
    """

    def transcribe(self, audio_data: bytes, mime_type: str = "audio/webm") -> str:
        validate_audio_payload(audio_data, mime_type)

        # Check for test payload marker
        if audio_data.startswith(b"test:"):
            return audio_data[5:].decode("utf-8", errors="replace").strip()

        # Representative default rural transaction transcript for stub testing
        return "Received Rs 14000 from Anil Babu for 2 desks"


def get_transcription_provider(api_key: Optional[str] = None) -> TranscriptionProvider:
    """Resolve active transcription provider based on environment configuration.

    If GROQ_API_KEY is present and non-empty, selects GroqWhisperTranscriptionProvider.
    If GROQ_API_KEY is absent or empty, safely falls back to StubTranscriptionProvider.
    Application startup NEVER fails merely because GROQ_API_KEY is absent.
    """
    key = (api_key or os.environ.get("GROQ_API_KEY", "")).strip()
    if key:
        return GroqWhisperTranscriptionProvider(api_key=key)
    return StubTranscriptionProvider()


class ExtractionProvider(Protocol):
    """Protocol for extracting structured transaction data from speech transcripts."""

    def extract(self, transcript: str) -> dict[str, Any]:
        """Extract raw, untrusted transaction dictionary from transcript text."""
        ...


class GeminiTransactionExtraction(BaseModel):
    """Pydantic schema for structured Gemini transaction extraction output.

    Contains only the ledger-required transaction fields.
    Zero PII fields, zero financial calculation fields.
    """

    date: Optional[str] = Field(
        default=None,
        description="Transaction date in YYYY-MM-DD format. If date is not specified in speech, use null or today's date.",
    )
    party_name: str = Field(
        ...,
        description="Customer or vendor party name. If genuinely unknown, use 'Unknown Party'.",
    )
    item: str = Field(
        ...,
        description="Item, work description, or service provided. If genuinely unknown, use 'General Item'.",
    )
    amount: float = Field(
        ...,
        description="Transaction amount in INR. Must be non-negative.",
    )
    tx_type: Literal["credit", "debit"] = Field(
        ...,
        description="'credit' for income/sales/payments received/loans received. 'debit' for payments made/purchases/wages/expenses/repayments/drawings.",
    )
    category: TransactionCategory = Field(
        ...,
        description=(
            "One of: 'sales', 'raw_material', 'operating_expense', 'loan_disbursement', "
            "'capital_injection', 'loan_repayment', 'personal_drawings', 'refund', 'other'."
        ),
    )


class GeminiExtractionProvider:
    """Real structured transaction extraction provider using Google GenAI SDK (Gemini).

    Strictly server-side integration. The API key is read from GEMINI_API_KEY environment
    variable or passed during initialization. Never hard-coded, never committed.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_GEMINI_MODEL,
        client: Optional[Any] = None,
    ) -> None:
        self.api_key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
        if not self.api_key:
            raise VoiceConfigurationError(
                "GEMINI_API_KEY is not configured. Provide an API key or set GEMINI_API_KEY environment variable."
            )
        self.model = model
        if client is not None:
            self._client = client
        else:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError as e:
                raise VoiceConfigurationError(f"google-genai SDK is not installed: {e}") from e

    def extract(self, transcript: str) -> dict[str, Any]:
        """Extract structured transaction data from speech transcript using Gemini.

        Input is ONLY the transcript text.
        Never hallucinates missing facts.
        Category is an AI suggestion only.
        """
        cleaned = transcript.strip()
        if not cleaned:
            raise ExtractionError("Transcript is empty")

        today_str = date.today().isoformat()
        prompt = (
            f"You are an expert rural micro-enterprise accounting assistant in India.\n"
            f"Extract the structured transaction from this voice transcript spoken in English, Hindi, or local dialect.\n\n"
            f"Today's date is: {today_str}\n\n"
            f"Transcript:\n\"{cleaned}\"\n\n"
            f"Rules:\n"
            f"1. Extract: date (YYYY-MM-DD), party_name, item, amount, tx_type ('credit' or 'debit'), and category.\n"
            f"2. If date is not mentioned in speech, use today's date ({today_str}).\n"
            f"3. Never invent missing business facts. If party or item is genuinely unknown, use 'Unknown Party' or 'General Item'.\n"
            f"4. Category must be strictly one of: sales, raw_material, operating_expense, loan_disbursement, "
            f"capital_injection, loan_repayment, personal_drawings, refund, other.\n"
            f"5. Do not calculate turnover, working capital, or any financial metric.\n"
            f"6. Do not extract or handle any Aadhaar, PAN, or sensitive identity documents."
        )

        try:
            from google.genai import types

            response = self._client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiTransactionExtraction,
                    temperature=0.0,
                ),
            )
        except Exception as err:
            raise ExtractionError(f"Gemini extraction failed: {err}") from err

        # Parse response (handle parsed object, text JSON, or dict)
        raw_dict: dict[str, Any] = {}
        if getattr(response, "parsed", None) is not None:
            parsed = response.parsed
            if isinstance(parsed, BaseModel):
                raw_dict = parsed.model_dump()
            elif isinstance(parsed, dict):
                raw_dict = parsed

        if not raw_dict and hasattr(response, "text") and response.text:
            try:
                raw_dict = json.loads(response.text)
            except Exception as json_err:
                raise ExtractionError(f"Failed to parse Gemini JSON output: {json_err}") from json_err

        if not raw_dict:
            raise ExtractionError("Gemini returned empty structured output")

        # Fill date fallback if speaker did not provide date
        if not raw_dict.get("date"):
            raw_dict["date"] = date.today()

        return raw_dict


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


def get_extraction_provider(api_key: Optional[str] = None) -> ExtractionProvider:
    """Resolve active extraction provider based on environment configuration.

    If GEMINI_API_KEY is present and non-empty, selects GeminiExtractionProvider.
    If GEMINI_API_KEY is absent or empty, safely falls back to StubExtractionProvider.
    Application startup NEVER fails merely because GEMINI_API_KEY is absent.
    """
    key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    if key:
        return GeminiExtractionProvider(api_key=key)
    return StubExtractionProvider()


def validate_suggested_transaction(raw_dict: dict[str, Any]) -> Transaction:
    """Validate untrusted AI extraction output through Pydantic.

    Raises ValidationError if any field fails schema requirements
    (e.g., negative amount, whitespace party name, invalid category, bad date).
    Never silently repairs invalid data.
    """
    return Transaction.model_validate(raw_dict)
