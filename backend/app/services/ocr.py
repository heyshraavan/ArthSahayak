"""Physical ledger and bahi-khata document OCR processing service module.

Provides OCR provider abstraction, payload validation, Google GenAI SDK
Gemini Vision multi-transaction extraction, offline testing stubs, and
identity document rejection guardrails for rural Indian informal accounting documents.

ARCHITECTURE:
Photo bytes -> Gemini Vision -> structured OCR suggestions list -> Pydantic validation -> human review -> ledger
"""

from datetime import date
import json
import logging
import os
import re
import time
from typing import Any, Callable, Literal, Optional, Protocol

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app.schemas import TransactionCategory
from app.services.gemini_retry import call_gemini_with_retry
from app.voice_engine import DEFAULT_GEMINI_MODEL, resolve_gemini_model, validate_suggested_transaction

load_dotenv()

logger = logging.getLogger("arthsahayak.ocr")

# 10 MB maximum application limit for decoded image payload
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

# Supported image formats for OCR
SUPPORTED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


class OcrError(Exception):
    """Raised when upstream OCR provider fails or returns unparseable content."""


class OcrConfigurationError(Exception):
    """Raised when OCR provider configuration or credentials are missing or invalid."""


class OcrValidationError(Exception):
    """Raised when image content is rejected (e.g., identity document detected)."""


class ImageValidationError(Exception):
    """Raised when image payload fails size, empty, or MIME type constraints."""


def validate_image_payload(image_bytes: bytes, mime_type: str) -> None:
    """Validate image payload constraints.

    Enforces:
    - Non-empty byte content
    - Decoded image payload <= 10 MB
    - Supported MIME type (JPEG, PNG, WebP, HEIC)
    """
    if not image_bytes:
        raise ImageValidationError("Image payload is empty")

    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise ImageValidationError(
            f"Image payload size ({len(image_bytes)} bytes) exceeds the 10 MB application limit"
        )

    # Normalize mime_type to strip parameters such as charset
    base_mime = mime_type.split(";")[0].strip().lower()
    if base_mime not in SUPPORTED_IMAGE_MIME_TYPES:
        raise ImageValidationError(
            f"Unsupported image MIME type: '{mime_type}'. "
            f"Supported formats: JPEG, PNG, WebP, HEIC"
        )


def normalize_ocr_date(raw_date: Optional[Any]) -> Optional[str]:
    """Normalize raw OCR date string or date object to canonical YYYY-MM-DD format.

    Enforces canonical 'YYYY-MM-DD' ISO date strings across OCR extraction.

    Supports common formats:
    - YYYY-MM-DD (canonical ISO format, returns unchanged)
    - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
    - YYYY/MM/DD, YYYY.MM.DD
    - datetime.date objects

    Invariants:
    - Does NOT silently invent a date when a date cannot be confidently parsed.
    - Ambiguous dates (e.g. 2-digit years) or invalid calendar dates (e.g. Feb 31, month 13)
      return None so they can be rejected or surfaced for human correction.
    """
    if raw_date is None:
        return None

    if isinstance(raw_date, date):
        return raw_date.strftime("%Y-%m-%d")

    if not isinstance(raw_date, str):
        return None

    trimmed = raw_date.strip()
    if not trimmed:
        return None

    # Strip timestamp component if present (e.g. "2007-05-22T00:00:00" or "2007-05-22 14:30")
    date_part = re.split(r"[T ]", trimmed)[0].strip()

    # Pattern 1: YYYY[-/. ]MM[-/. ]DD
    iso_match = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", date_part)
    if iso_match:
        year = int(iso_match.group(1))
        month = int(iso_match.group(2))
        day = int(iso_match.group(3))
        if 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            try:
                valid_date = date(year, month, day)
                return valid_date.strftime("%Y-%m-%d")
            except ValueError:
                return None
        return None

    # Pattern 2: DD[-/. ]MM[-/. ]YYYY
    dmy_match = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$", date_part)
    if dmy_match:
        day = int(dmy_match.group(1))
        month = int(dmy_match.group(2))
        year = int(dmy_match.group(3))
        if 1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31:
            try:
                valid_date = date(year, month, day)
                return valid_date.strftime("%Y-%m-%d")
            except ValueError:
                return None
        return None

    # Ambiguous (e.g. 2-digit years) or malformed: return None
    return None


class GeminiOcrTransactionItem(BaseModel):
    """Structured extraction for an individual transaction item from an image.

    Contains ONLY the ledger-required transaction fields.
    Zero PII fields, zero financial calculation metrics.
    """

    date: Optional[str] = Field(
        default=None,
        description="Transaction date in YYYY-MM-DD or DD-MM-YYYY format if visible on the document. Null if unreadable or absent.",
    )
    party_name: Optional[str] = Field(
        default="Unknown Party",
        description=(
            "Customer, supplier, or party name written on the document. "
            "If unreadable or absent, use 'Unknown Party'. Never invent names."
        ),
    )
    item: Optional[str] = Field(
        default="General Item",
        description=(
            "Description of item, goods, or service written on the slip/ledger. "
            "If unreadable or absent, use 'General Item'. Never invent items."
        ),
    )
    amount: Optional[float] = Field(
        default=None,
        description="Transaction amount in INR written on the slip or ledger. Must be non-negative.",
    )
    tx_type: Optional[Literal["credit", "debit"]] = Field(
        default=None,
        description=(
            "Ledger direction from the micro-entrepreneur's business perspective: "
            "'credit' for money entering the business (जमा - sales, loan received, capital added). "
            "'debit' for money leaving the business (नामे/खर्च - expenses, supplies, wages, restaurant/food, loan repayment, personal drawings)."
        ),
    )
    category: Optional[TransactionCategory] = Field(
        default=None,
        description=(
            "Accounting category from the micro-entrepreneur's business perspective:\n"
            "- 'sales': money received from customers for products or services\n"
            "- 'raw_material': money paid to suppliers for stock, timber, raw materials, or merchandise\n"
            "- 'operating_expense': money paid for restaurant/food/meals, travel, utilities, fuel, or staff wages\n"
            "- 'loan_disbursement': money received as a business or microfinance loan\n"
            "- 'capital_injection': money put into the business by the owner\n"
            "- 'loan_repayment': money paid to repay bank or lender loan principal\n"
            "- 'personal_drawings': money withdrawn by the owner for personal or household use\n"
            "- 'refund', 'other'."
        ),
    )


class GeminiOcrBatchExtraction(BaseModel):
    """Pydantic schema for structured Gemini Vision batch OCR extraction.

    Enforces:
    - Identity document detection flag and rejection explanation
    - List of distinct transaction ledger entries
    - Brief extracted text summary
    - STRICT GUARDRAIL: Zero Aadhaar, PAN, caste, personal identity, or bank account fields
    - STRICT GUARDRAIL: Zero financial metric calculation fields
    """

    is_identity_document: bool = Field(
        default=False,
        description=(
            "Set to true ONLY if the image is an identity, citizenship, or government credential "
            "(Aadhaar card, PAN card, voter ID, passport, driving license, caste certificate / "
            "जाति प्रमाण पत्र, domicile certificate, or ration card). Set to false for handwritten "
            "business slips, bahi-khata ledgers, receipts, bills, invoices, or rough accounting chits."
        ),
    )
    rejection_reason: Optional[str] = Field(
        default=None,
        description="If is_identity_document is true, give a brief reason (e.g. 'Aadhaar card detected').",
    )
    transactions: list[GeminiOcrTransactionItem] = Field(
        default_factory=list,
        description="List of distinct business transactions extracted from the document.",
    )
    raw_text: Optional[str] = Field(
        default=None,
        description="Brief transcription or summary of text detected on the slip or ledger.",
    )


# Backward compatibility alias for single extraction model tests
GeminiOcrExtraction = GeminiOcrBatchExtraction


class OcrProvider(Protocol):
    """Protocol for extracting structured transaction data from ledger/receipt images."""

    def extract_from_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
        """Extract raw, untrusted transaction dictionary with transactions list from image bytes."""
        ...


class GeminiOcrProvider:
    """Real handwritten ledger and bahi-khata OCR provider using Google GenAI SDK (Gemini Vision).

    Strictly server-side integration. The API key is read from GEMINI_API_KEY environment
    variable or passed during initialization. Never hard-coded, never committed.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        client: Optional[Any] = None,
        sleep_fn: Optional[Callable[[float], None]] = None,
    ) -> None:
        self.api_key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
        if not self.api_key:
            raise OcrConfigurationError(
                "GEMINI_API_KEY is not configured. Provide an API key or set GEMINI_API_KEY environment variable."
            )
        self.model = resolve_gemini_model(model)
        self.sleep_fn = sleep_fn or time.sleep
        if client is not None:
            self._client = client
        else:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except ImportError as e:
                raise OcrConfigurationError(f"google-genai SDK is not installed: {e}") from e

    def extract_from_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
        """Extract structured transactions from handwritten ledger/chit image using Gemini Vision.

        Input is ONLY the image bytes and MIME type.
        Rejects identity documents.
        Preserves uncertainty; never invents missing facts.
        """
        validate_image_payload(image_bytes, mime_type)

        today_str = date.today().isoformat()
        prompt = (
            f"You are an expert rural micro-enterprise accounting assistant in India.\n"
            f"Extract all distinct business transactions from this physical receipt, slip, voucher, or bahi-khata ledger image.\n"
            f"Today's date is: {today_str}\n\n"
            f"CRITICAL LEDGER RULES:\n"
            f"1. The ledger represents the micro-entrepreneur's business.\n"
            f"   - Money entering the entrepreneur's business (credit / जमा)\n"
            f"   - Money leaving the entrepreneur's business (debit / नामे / खर्च)\n"
            f"2. Do NOT classify a document simply based on the presence of words like: 'bill', 'receipt', 'total', 'cash'.\n"
            f"   Bills from external establishments (restaurant, dhaba, tea stall, hotel, fuel, repair) are DEBIT (operating_expense or raw_material), never sales.\n"
            f"3. Mandatory semantic examples:\n"
            f"   - Business receives money from customer for its product/service:\n     credit + sales\n"
            f"   - Business pays supplier for raw materials:\n     debit + raw_material\n"
            f"   - Business pays wages/labour:\n     debit + operating_expense\n"
            f"   - Business pays restaurant/food/travel/utilities/other business expenses:\n     debit + operating_expense\n"
            f"   - Business receives a loan:\n     credit + loan_disbursement\n"
            f"   - Business repays loan principal:\n     debit + loan_repayment\n"
            f"   - Business owner puts own money into business:\n     credit + capital_injection\n"
            f"   - Business owner takes money out for personal use:\n     debit + personal_drawings\n"
            f"4. Identity Document Rejection:\n"
            f"   If image is a government or personal identity credential (Aadhaar, PAN, voter ID, passport, caste/ration card), "
            f"set is_identity_document=true, rejection_reason='<type> detected', and transactions=[].\n"
            f"5. Receipts with itemized components and a stated total: extract ONE transaction for stated total (do not double count).\n"
            f"   Bahi-khata multi-row ledgers: extract each distinct row as a separate transaction.\n"
            f"6. Fields (each transaction):\n"
            f"   - date: YYYY-MM-DD if visible on the document, otherwise null.\n"
            f"   - party_name: written party or 'Unknown Party'.\n"
            f"   - item: item/service or 'General Item'.\n"
            f"   - amount: non-negative number in INR.\n"
            f"   - tx_type: 'credit' or 'debit'.\n"
            f"   - category: sales, raw_material, operating_expense, loan_disbursement, capital_injection, loan_repayment, personal_drawings, refund, other.\n"
            f"7. Privacy: Never extract Aadhaar numbers, PAN numbers, or bank account numbers."
        )

        clean_mime = mime_type.split(";")[0].strip().lower()
        start_time = time.perf_counter()
        logger.info(
            "Gemini OCR starting: payload=%d bytes, mime=%s, model=%s",
            len(image_bytes),
            clean_mime,
            self.model,
        )

        try:
            from google.genai import types

            image_part = types.Part.from_bytes(
                data=image_bytes,
                mime_type=clean_mime,
            )

            response = call_gemini_with_retry(
                self._client.models.generate_content,
                model=self.model,
                contents=[image_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiOcrBatchExtraction,
                    temperature=0.0,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                ),
                sleep_fn=self.sleep_fn,
            )
        except Exception as err:
            logger.error("Gemini OCR extraction failed (model=%s): %s: %s", self.model, type(err).__name__, err)
            raise OcrError(f"Gemini OCR extraction failed (model={self.model}): {err}") from err

        raw_dict: dict[str, Any] = {}
        if getattr(response, "parsed", None) is not None:
            parsed = response.parsed
            if isinstance(parsed, BaseModel):
                raw_dict = parsed.model_dump()
            elif isinstance(parsed, dict):
                raw_dict = parsed

        if not raw_dict and hasattr(response, "text") and response.text:
            try:
                text_content = response.text.strip()
                if text_content.startswith("```"):
                    lines = text_content.splitlines()
                    if lines and lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].strip().startswith("```"):
                        lines = lines[:-1]
                    text_content = "\n".join(lines).strip()
                raw_dict = json.loads(text_content)
            except Exception as json_err:
                logger.error("Failed to parse Gemini OCR JSON output: %s", json_err)
                raise OcrError(f"Failed to parse Gemini OCR JSON output: {json_err}") from json_err

        if not raw_dict:
            logger.error("Gemini returned empty structured OCR output")
            raise OcrError("Gemini returned empty structured OCR output")

        # Identity Document Rejection Guardrail
        if raw_dict.get("is_identity_document"):
            reason = raw_dict.get("rejection_reason") or "Identity document detected"
            logger.warning("Gemini OCR rejected identity document: %s", reason)
            raise OcrValidationError(
                f"Identity document rejected ({reason}). Personal identity documents (Aadhaar, PAN, "
                f"caste certificates, etc.) cannot be processed as financial transactions."
            )

        transactions_raw = raw_dict.get("transactions", [])
        formatted_transactions: list[dict[str, Any]] = []

        for tx in transactions_raw:
            if isinstance(tx, dict):
                tx_dict = dict(tx)
            elif isinstance(tx, BaseModel):
                tx_dict = tx.model_dump()
            else:
                tx_dict = dict(tx)

            # Date normalization and fallback
            raw_tx_date = tx_dict.get("date")
            if raw_tx_date is not None and str(raw_tx_date).strip() != "":
                normalized = normalize_ocr_date(raw_tx_date)
                if normalized:
                    tx_dict["date"] = normalized
                else:
                    # Keep raw unparseable date string so Pydantic validation rejects it
                    tx_dict["date"] = str(raw_tx_date).strip()
            else:
                # Date unstated on slip: default to today
                tx_dict["date"] = date.today()

            formatted_transactions.append(tx_dict)

        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "Gemini OCR succeeded in %.1fms: extracted %d transactions",
            duration_ms,
            len(formatted_transactions),
        )

        return {
            "transactions": formatted_transactions,
            "raw_text": raw_dict.get("raw_text"),
        }


class StubOcrProvider:
    """Stub OCR provider for testing interfaces, error pathways, and multi-transaction flows.

    Does NOT call external AI services. Maps test markers into representative
    or failing payloads to verify untrusted AI validation and error handling.
    """

    def extract_from_image(self, image_bytes: bytes, mime_type: str = "image/jpeg") -> dict[str, Any]:
        validate_image_payload(image_bytes, mime_type)

        # Explicit test injections for verifying error handling
        if image_bytes.startswith(b"test:identity_doc") or b"Aadhaar" in image_bytes or b"PAN" in image_bytes:
            raise OcrValidationError(
                "Identity document rejected (Aadhaar/PAN detected). Personal identity documents "
                "(Aadhaar, PAN, caste certificates, etc.) cannot be processed as financial transactions."
            )

        if image_bytes.startswith(b"test:invalid_category"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Test Party",
                        "item": "Test Item",
                        "amount": 1000.0,
                        "tx_type": "credit",
                        "category": "unsupported_crypto_category",
                    }
                ],
                "raw_text": "Test slip with invalid category",
            }

        if image_bytes.startswith(b"test:negative_amount"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Test Party",
                        "item": "Test Item",
                        "amount": -1500.0,
                        "tx_type": "debit",
                        "category": "raw_material",
                    }
                ],
                "raw_text": "Test slip with negative amount",
            }

        if image_bytes.startswith(b"test:whitespace_party"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "   ",
                        "item": "Wood Planks",
                        "amount": 2500.0,
                        "tx_type": "debit",
                        "category": "raw_material",
                    }
                ],
                "raw_text": "Test slip with whitespace party",
            }

        if image_bytes.startswith(b"test:malformed"):
            return {
                "transactions": [
                    {
                        "date": "bad-date-format",
                        "party_name": "",
                        "item": "",
                        "amount": "not-a-number",
                        "tx_type": "invalid-type",
                        "category": None,
                    }
                ],
                "raw_text": "Malformed test slip",
            }

        if image_bytes.startswith(b"test:empty_transactions"):
            return {
                "transactions": [],
                "raw_text": "Blank page with no visible business transactions",
            }

        # Date normalization test scenario 1: DD-MM-YYYY (22-05-2007)
        if image_bytes.startswith(b"test:date_dd_mm_yyyy"):
            return {
                "transactions": [
                    {
                        "date": normalize_ocr_date("22-05-2007"),
                        "party_name": "Hotel Swad",
                        "item": "Handwritten Meal Slip",
                        "amount": 146.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    }
                ],
                "raw_text": "होटल स्वाद - 22-05-2007 - ₹146",
            }

        # Date normalization test scenario 2: DD/MM/YYYY (22/05/2007)
        if image_bytes.startswith(b"test:date_dd_slash_yyyy"):
            return {
                "transactions": [
                    {
                        "date": normalize_ocr_date("22/05/2007"),
                        "party_name": "Hotel Swad",
                        "item": "Handwritten Meal Slip",
                        "amount": 146.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    }
                ],
                "raw_text": "होटल स्वाद - 22/05/2007 - ₹146",
            }

        # Semantic test scenario 1: Restaurant expense receipt -> debit + operating_expense
        if image_bytes.startswith(b"test:restaurant_expense"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Hotel Swad (Restaurant)",
                        "item": "Handwritten Restaurant Meal Slip (Thali + Tea)",
                        "amount": 146.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    }
                ],
                "raw_text": "होटल स्वाद - थाली ₹120, चाय ₹26 - कुल योग ₹146",
            }

        # Semantic test scenario 2: Customer sales receipt -> credit + sales
        if image_bytes.startswith(b"test:customer_sales"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Ramesh Kumar (Customer)",
                        "item": "Handmade Wooden Stool",
                        "amount": 1200.0,
                        "tx_type": "credit",
                        "category": "sales",
                    }
                ],
                "raw_text": "बिक्री पर्चा: रमेश कुमार को स्टूल बेचा - ₹1200 नकद प्राप्त",
            }

        # Semantic test scenario 3: Raw material purchase receipt -> debit + raw_material
        if image_bytes.startswith(b"test:raw_material_purchase"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Kisan Timber Depot",
                        "item": "Pine Wood Logs",
                        "amount": 4500.0,
                        "tx_type": "debit",
                        "category": "raw_material",
                    }
                ],
                "raw_text": "किसान टिम्बर डिपो - चीड़ की लकड़ी - ₹4500 नामे",
            }

        # Semantic test scenario 4: Wage payment -> debit + operating_expense
        if image_bytes.startswith(b"test:wage_payment"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Sunil Majhi (Labour)",
                        "item": "Weekly Workshop Labour Wages",
                        "amount": 2000.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    }
                ],
                "raw_text": "सुनील मांझी - साप्ताहिक मजदूरी भुगतान - ₹2000 नामे",
            }

        # Semantic test scenario 5: Loan receipt -> credit + loan_disbursement
        if image_bytes.startswith(b"test:loan_receipt"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Bandhan Microfinance",
                        "item": "Microfinance Loan Disbursement",
                        "amount": 25000.0,
                        "tx_type": "credit",
                        "category": "loan_disbursement",
                    }
                ],
                "raw_text": "बंधन बैंक - व्यवसाय ऋण संवितरण - ₹25000 जमा",
            }

        # Semantic test scenario 6: Loan repayment -> debit + loan_repayment
        if image_bytes.startswith(b"test:loan_repayment"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Bandhan Microfinance",
                        "item": "Weekly Microloan Installment",
                        "amount": 1250.0,
                        "tx_type": "debit",
                        "category": "loan_repayment",
                    }
                ],
                "raw_text": "बंधन बैंक - ऋण किस्त भुगतान - ₹1250 नामे",
            }

        # Multi-transaction receipt with line items + total (prevent double-counting)
        if image_bytes.startswith(b"test:receipt_with_total"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Shree Annapurna Dhaba",
                        "item": "Meal Bill (Special Thali + Lassi + Roti)",
                        "amount": 450.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    }
                ],
                "raw_text": "श्री अन्नपूर्णा ढाबा - थाली ₹300, लस्सी ₹100, रोटी ₹50 - कुल योग: ₹450",
            }

        # Multi-transaction bahi-khata ledger rows
        if image_bytes.startswith(b"test:multi_transaction") or image_bytes.startswith(b"test:bahi_khata_multi"):
            return {
                "transactions": [
                    {
                        "date": date.today(),
                        "party_name": "Anil Babu (School)",
                        "item": "2 School Desks & Benches",
                        "amount": 14000.0,
                        "tx_type": "credit",
                        "category": "sales",
                    },
                    {
                        "date": date.today(),
                        "party_name": "Maa Tara Timber Depot",
                        "item": "Teak Wood Planks",
                        "amount": 7500.0,
                        "tx_type": "debit",
                        "category": "raw_material",
                    },
                    {
                        "date": date.today(),
                        "party_name": "Biren Da",
                        "item": "Weekly Workshop Wages",
                        "amount": 5000.0,
                        "tx_type": "debit",
                        "category": "operating_expense",
                    },
                ],
                "raw_text": "खाता बही पन्ना: अनिल बाबू ₹14000 जमा, माँ तारा टिम्बर ₹7500 नामे, बीरेन दा मजदूरी ₹5000 नामे",
            }

        # Representative default single-transaction debit
        return {
            "transactions": [
                {
                    "date": date.today(),
                    "party_name": "Sharma Timber Depot",
                    "item": "Sal Wood Planks",
                    "amount": 8500.0,
                    "tx_type": "debit",
                    "category": "raw_material",
                }
            ],
            "raw_text": "हाथ से लिखा पर्चा: शर्मा टिम्बर डिपो - साल की लकड़ी - ₹8500 नामे",
        }


def get_ocr_provider(
    api_key: Optional[str] = None,
    allow_stub: Optional[bool] = None,
) -> OcrProvider:
    """Resolve active OCR provider based on environment configuration.

    If GEMINI_API_KEY is present and non-empty, selects GeminiOcrProvider.
    If GEMINI_API_KEY is absent or empty:
    - If allow_stub is True or ALLOW_STUB_PROVIDERS is enabled ('true', '1', 'yes'),
      selects StubOcrProvider for offline testing.
    - Otherwise raises OcrConfigurationError with clear instructions.
    """
    key = (api_key or os.environ.get("GEMINI_API_KEY", "")).strip()
    if key:
        return GeminiOcrProvider(api_key=key)

    is_stub_allowed = (
        allow_stub
        if allow_stub is not None
        else os.environ.get("ALLOW_STUB_PROVIDERS", "").strip().lower() in ("true", "1", "yes")
    )
    if is_stub_allowed:
        logger.warning(
            "GEMINI_API_KEY is absent. Using StubOcrProvider because ALLOW_STUB_PROVIDERS is enabled."
        )
        return StubOcrProvider()

    raise OcrConfigurationError(
        "GEMINI_API_KEY is not configured on the server. Physical ledger OCR requires a valid Gemini API key."
    )
