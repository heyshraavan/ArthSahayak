from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.finance_engine import compute_financial_summary
from app.schemas import FinanceCalculationRequest, FinancialSummary

app = FastAPI(
    title="ArthSahayak API",
    description="AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs",
    version="0.1.0",
)

# Explicitly restricted to local Vite development server
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "arthsahayak-api",
    }


@app.post("/finance/calculate", response_model=FinancialSummary)
def calculate_finance(request: FinanceCalculationRequest) -> FinancialSummary:
    """Calculate financial metrics deterministically from ledger transactions and inputs."""
    return compute_financial_summary(
        transactions=request.transactions,
        explicit_turnover=request.explicit_turnover,
        net_operating_income=request.net_operating_income,
        debt_service=request.debt_service,
    )

