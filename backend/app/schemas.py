from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class Transaction(BaseModel):
    """Represents a single financial transaction in the prototype ledger."""

    date: date
    party_name: str = Field(..., min_length=1, description="Name of party or customer/vendor")
    item: str = Field(..., min_length=1, description="Description of goods or service")
    amount: float = Field(..., ge=0.0, description="Non-negative transaction amount")
    tx_type: Literal["credit", "debit"]

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
