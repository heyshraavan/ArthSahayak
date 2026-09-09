import base64
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.finance_engine import compute_financial_summary
from app.schemas import (
    AudioTranscriptionRequest,
    ExtractionRequest,
    FinanceCalculationRequest,
    FinancialSummary,
    TranscriptionResponse,
    VoiceExtractionResponse,
)
from app.voice_engine import (
    AudioValidationError,
    StubExtractionProvider,
    StubTranscriptionProvider,
    TranscriptionError,
    VoiceConfigurationError,
    get_transcription_provider,
    validate_suggested_transaction,
)

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

extraction_provider = StubExtractionProvider()


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


@app.post("/voice/transcribe", response_model=TranscriptionResponse)
def transcribe_audio(request: AudioTranscriptionRequest) -> TranscriptionResponse:
    """Transcribe audio data through the transcription provider abstraction.

    Dynamically resolves provider:
    - Real Groq Whisper provider when GROQ_API_KEY is configured.
    - Safe stub provider when GROQ_API_KEY is absent.
    """
    try:
        audio_bytes = base64.b64decode(request.audio_base64)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid base64 audio data: {e}",
        )

    provider = get_transcription_provider()
    try:
        transcript = provider.transcribe(
            audio_data=audio_bytes,
            mime_type=request.mime_type or "audio/webm",
        )
    except AudioValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except VoiceConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice configuration error: {e}",
        )
    except TranscriptionError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream transcription error: {e}",
        )

    return TranscriptionResponse(transcript=transcript, confidence=0.95)



@app.post("/voice/extract", response_model=VoiceExtractionResponse)
def extract_transaction(request: ExtractionRequest) -> VoiceExtractionResponse:
    """Extract structured transaction suggestion from speech transcript.

    TREATS AI OUTPUT AS UNTRUSTED INPUT:
    Validates raw dictionary strictly through Pydantic. Invalid categories,
    negative amounts, or malformed fields are rejected with HTTP 422.

    GUARANTEE: Does NOT write to ledger state and does NOT call the finance engine.
    """
    raw_suggestion = extraction_provider.extract(request.transcript)
    try:
        validated_tx = validate_suggested_transaction(raw_suggestion)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI extraction produced invalid transaction data: {e.errors()}",
        )

    return VoiceExtractionResponse(
        transcript=request.transcript,
        suggested_transaction=validated_tx,
        requires_confirmation=True,
    )


