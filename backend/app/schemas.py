from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


TransactionCategory = Literal[
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


class Transaction(BaseModel):
    """Represents a single financial transaction in the prototype ledger."""

    date: date
    party_name: str = Field(..., min_length=1, description="Name of party or customer/vendor")
    item: str = Field(..., min_length=1, description="Description of goods or service")
    amount: float = Field(..., ge=0.0, description="Non-negative transaction amount")
    tx_type: Literal["credit", "debit"]
    category: Optional[TransactionCategory] = Field(
        default=None,
        description="Deterministic transaction category for revenue/expense segregation",
    )

    @field_validator("party_name", "item")
    @classmethod
    def check_not_whitespace_only(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("String field must not be empty or whitespace-only")
        return v.strip()



class WorkingCapitalAssessment(BaseModel):
    """Deterministic working capital assessment following prototype formulas."""

    turnover: float = Field(..., ge=0.0)
    working_capital_requirement: float = Field(..., ge=0.0)
    promoter_margin: float = Field(..., ge=0.0)
    maximum_permissible_bank_finance: float = Field(..., ge=0.0)


class FinancialSummary(BaseModel):
    """Structured summary of ledger metrics and financial calculations."""

    total_credit: float
    total_debit: float
    net_cash_flow: float
    turnover: float
    working_capital_requirement: float
    promoter_margin: float
    maximum_permissible_bank_finance: float
    dscr: Optional[float] = None


class FinanceCalculationRequest(BaseModel):
    """Request payload for deterministic financial calculation."""

    transactions: list[Transaction] = Field(
        default_factory=list,
        description="List of informal ledger transactions",
    )
    explicit_turnover: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Optional explicit turnover amount. Must be non-negative if provided.",
    )
    net_operating_income: float = Field(
        ...,
        ge=0.0,
        description="Net operating income. Must be non-negative.",
    )
    debt_service: float = Field(
        ...,
        ge=0.0,
        description="Total annual debt service obligations. Must be non-negative.",
    )


class AudioTranscriptionRequest(BaseModel):
    """Payload for audio transcription."""

    audio_base64: str = Field(..., min_length=1, description="Base64-encoded audio bytes")
    mime_type: Optional[str] = Field(default="audio/webm", description="MIME type of audio")


class TranscriptionResponse(BaseModel):
    """Response containing transcribed speech text."""

    transcript: str = Field(..., description="Transcribed speech text")
    confidence: Optional[float] = Field(default=None, description="Confidence score")


class ExtractionRequest(BaseModel):
    """Payload for structured extraction from transcribed text."""

    transcript: str = Field(..., min_length=1, description="Transcribed speech text of the transaction")


class VoiceExtractionResponse(BaseModel):
    """Response containing an untrusted AI suggested transaction requiring human review."""

    transcript: str = Field(..., description="Original voice transcript text")
    suggested_transaction: Transaction = Field(
        ...,
        description="AI suggested transaction requiring human verification before adding to ledger",
    )
    requires_confirmation: bool = Field(
        default=True,
        description="Guarantees explicit human confirmation before saving to ledger",
    )


class OcrExtractionRequest(BaseModel):
    """Payload for handwritten ledger or photo OCR extraction."""

    image_base64: str = Field(..., min_length=1, description="Base64-encoded image bytes")
    mime_type: Optional[str] = Field(
        default="image/jpeg",
        description="MIME type of the image (e.g. image/jpeg, image/png, image/webp, image/heic)",
    )


class OcrExtractionResponse(BaseModel):
    """Response containing untrusted AI suggested transactions extracted from an image."""

    suggested_transactions: list[Transaction] = Field(
        default_factory=list,
        description="List of AI suggested transactions requiring human verification before adding to ledger",
    )
    raw_text: Optional[str] = Field(
        default=None,
        description="Brief transcription or detected text from the slip or ledger",
    )
    requires_confirmation: bool = Field(
        default=True,
        description="Guarantees explicit human confirmation before saving to ledger",
    )


