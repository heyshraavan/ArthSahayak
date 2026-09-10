import base64
from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from app.dossier_generator import DossierInput, generate_dossier_pdf
from app.finance_engine import compute_financial_summary
from app.schemas import (
    AudioTranscriptionRequest,
    ExtractionRequest,
    FinanceCalculationRequest,
    FinancialSummary,
    OcrExtractionRequest,
    OcrExtractionResponse,
    TranscriptionResponse,
    VoiceExtractionResponse,
)
from app.services.ocr import (
    ImageValidationError,
    OcrConfigurationError,
    OcrError,
    OcrValidationError,
    get_ocr_provider,
)
from app.voice_engine import (
    AudioValidationError,
    ExtractionError,
    StubExtractionProvider,
    StubTranscriptionProvider,
    TranscriptionError,
    VoiceConfigurationError,
    get_extraction_provider,
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
    provider = get_extraction_provider()
    try:
        raw_suggestion = provider.extract(request.transcript)
    except VoiceConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Voice extraction configuration error: {e}",
        )
    except ExtractionError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream extraction error: {e}",
        )

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


@app.post("/ocr/extract", response_model=OcrExtractionResponse)
def extract_ocr_transaction(request: OcrExtractionRequest) -> OcrExtractionResponse:
    """Extract structured transaction suggestion from photo/scanned ledger document.

    TREATS AI OUTPUT AS UNTRUSTED INPUT:
    - Enforces 10 MB decoded image limit and validates image MIME types.
    - Rejects identity documents (Aadhaar, PAN, caste certificates) with HTTP 422.
    - Validates AI suggestion strictly via Pydantic Transaction model.
    - Invalid categories, negative amounts, or malformed fields return HTTP 422.
    - Upstream Gemini failures return HTTP 502 (never silently falls back to fake/stub data).
    - GUARANTEE: Does NOT write to ledger state and does NOT call finance engine.
    """
    try:
        image_bytes = base64.b64decode(request.image_base64, validate=True)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid base64 image data: {e}",
        )

    mime_type = request.mime_type or "image/jpeg"

    provider = get_ocr_provider()
    try:
        raw_suggestion = provider.extract_from_image(image_bytes=image_bytes, mime_type=mime_type)
    except ImageValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except OcrValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except OcrConfigurationError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR configuration error: {e}",
        )
    except OcrError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream OCR error: {e}",
        )

    raw_tx_list = raw_suggestion.get("transactions", [])

    try:
        validated_transactions = [
            validate_suggested_transaction(tx)
            for tx in raw_tx_list
        ]
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI OCR extraction produced invalid transaction data: {e.errors()}",
        )

    return OcrExtractionResponse(
        suggested_transactions=validated_transactions,
        raw_text=raw_suggestion.get("raw_text"),
        requires_confirmation=True,
    )


@app.post("/dossier/generate", response_class=Response)
def generate_dossier(request: DossierInput) -> Response:
    """Generate an audit-ready 2-page PDF Credit Appraisal Dossier from structured input.

    Receives pre-calculated financial data and applicant details. Performs NO financial
    calculations, NO LLM calls, and NO external API calls.
    """
    try:
        pdf_bytes = generate_dossier_pdf(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dossier PDF: {e}",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="ArthSahayak_Credit_Appraisal_Dossier.pdf"',
        },
    )



