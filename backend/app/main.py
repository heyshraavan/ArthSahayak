import base64
import logging
import os
import time

from dotenv import load_dotenv
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

load_dotenv()

# Centralized logging setup
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("arthsahayak.api")

app = FastAPI(
    title="ArthSahayak API",
    description="AI-Driven Hyper-Local Business Advisory and Financial Structuring Assistant for Rural Micro-Entrepreneurs",
    version="0.1.0",
)

# Allowed CORS origins: local Vite development and production Vercel frontend
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://arth-sahayak.vercel.app",
]

# Allow additional origins via CORS_ORIGINS environment variable (comma-separated)
extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]

origins = list(dict.fromkeys(default_origins + extra_origins))

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
    """Transcribe audio data through Groq Whisper API.

    Validates audio data, passes bytes to Groq Whisper, and logs diagnostic metrics.
    When GROQ_API_KEY is missing and stubs are not enabled, returns HTTP 503 Service Unavailable.
    """
    start_time = time.perf_counter()
    logger.info("Received POST /voice/transcribe request")

    try:
        raw_b64 = request.audio_base64.strip()
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        audio_bytes = base64.b64decode(raw_b64)
    except Exception as e:
        logger.warning("POST /voice/transcribe base64 decode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid base64 audio data: {e}",
        )

    mime_type = request.mime_type or "audio/webm"
    logger.info("POST /voice/transcribe payload size: %d bytes, MIME: %s", len(audio_bytes), mime_type)

    try:
        provider = get_transcription_provider()
    except VoiceConfigurationError as e:
        logger.error("POST /voice/transcribe configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    provider_name = type(provider).__name__
    logger.info("POST /voice/transcribe resolved provider: %s", provider_name)

    try:
        transcript = provider.transcribe(
            audio_data=audio_bytes,
            mime_type=mime_type,
        )
    except AudioValidationError as e:
        logger.warning("POST /voice/transcribe validation error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except VoiceConfigurationError as e:
        logger.error("POST /voice/transcribe configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except TranscriptionError as e:
        logger.error("POST /voice/transcribe upstream error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream transcription error: {e}",
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "POST /voice/transcribe completed in %.1fms, transcript length: %d chars",
        elapsed_ms,
        len(transcript),
    )

    return TranscriptionResponse(transcript=transcript, confidence=0.95)


@app.post("/voice/extract", response_model=VoiceExtractionResponse)
def extract_transaction(request: ExtractionRequest) -> VoiceExtractionResponse:
    """Extract structured transaction suggestion from speech transcript using Groq LLM.

    TREATS AI OUTPUT AS UNTRUSTED INPUT:
    Validates raw dictionary strictly through Pydantic. Invalid categories,
    negative amounts, or malformed fields are rejected with HTTP 422.
    When GROQ_API_KEY is missing and stubs are not enabled, returns HTTP 503.

    GUARANTEE: Does NOT write to ledger state and does NOT call the finance engine.
    """
    start_time = time.perf_counter()
    logger.info("Received POST /voice/extract request, transcript length: %d chars", len(request.transcript))

    try:
        provider = get_extraction_provider()
    except VoiceConfigurationError as e:
        logger.error("POST /voice/extract configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    provider_name = type(provider).__name__
    provider_model = getattr(provider, "model", None)
    logger.info("POST /voice/extract resolved provider: %s (model=%s)", provider_name, provider_model)

    try:
        raw_suggestion = provider.extract(request.transcript)
    except VoiceConfigurationError as e:
        logger.error("POST /voice/extract configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except ExtractionError as e:
        logger.error("POST /voice/extract upstream error (provider=%s, model=%s): %s", provider_name, provider_model, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream extraction error: {e}",
        )

    try:
        validated_tx = validate_suggested_transaction(raw_suggestion)
    except ValidationError as e:
        logger.warning("POST /voice/extract transaction validation failed: %s", e.errors())
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI extraction produced invalid transaction data: {e.errors()}",
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "POST /voice/extract completed in %.1fms: category=%s, tx_type=%s, amount=%s",
        elapsed_ms,
        validated_tx.category,
        validated_tx.tx_type,
        validated_tx.amount,
    )

    return VoiceExtractionResponse(
        transcript=request.transcript,
        suggested_transaction=validated_tx,
        requires_confirmation=True,
    )


@app.post("/ocr/extract", response_model=OcrExtractionResponse)
def extract_ocr_transaction(request: OcrExtractionRequest) -> OcrExtractionResponse:
    """Extract structured transaction suggestion from photo/scanned ledger document using Gemini Vision.

    TREATS AI OUTPUT AS UNTRUSTED INPUT:
    - Enforces 10 MB decoded image limit and validates image MIME types.
    - Rejects identity documents (Aadhaar, PAN, caste certificates) with HTTP 422.
    - Validates AI suggestion strictly via Pydantic Transaction model.
    - Invalid categories, negative amounts, or malformed fields return HTTP 422.
    - Upstream Gemini failures return HTTP 502 (never silently falls back to fake/stub data).
    - When GEMINI_API_KEY is missing and stubs are not enabled, returns HTTP 503.
    - GUARANTEE: Does NOT write to ledger state and does NOT call finance engine.
    """
    start_time = time.perf_counter()
    logger.info("Received POST /ocr/extract request")

    try:
        raw_b64 = request.image_base64.strip()
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(raw_b64, validate=True)
    except Exception as e:
        logger.warning("POST /ocr/extract base64 decode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid base64 image data: {e}",
        )

    mime_type = request.mime_type or "image/jpeg"
    logger.info("POST /ocr/extract payload size: %d bytes, MIME: %s", len(image_bytes), mime_type)

    try:
        provider = get_ocr_provider()
    except OcrConfigurationError as e:
        logger.error("POST /ocr/extract configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )

    provider_name = type(provider).__name__
    provider_model = getattr(provider, "model", None)
    logger.info("POST /ocr/extract resolved provider: %s (model=%s)", provider_name, provider_model)

    try:
        raw_suggestion = provider.extract_from_image(image_bytes=image_bytes, mime_type=mime_type)
    except (ImageValidationError, OcrValidationError) as e:
        logger.warning("POST /ocr/extract validation rejection: %s", e)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except OcrConfigurationError as e:
        logger.error("POST /ocr/extract configuration error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )
    except OcrError as e:
        logger.error("POST /ocr/extract upstream error (provider=%s, model=%s): %s", provider_name, provider_model, e)
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
        logger.warning("POST /ocr/extract transaction validation failed: %s", e.errors())
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"AI OCR extraction produced invalid transaction data: {e.errors()}",
        )

    elapsed_ms = (time.perf_counter() - start_time) * 1000
    logger.info(
        "POST /ocr/extract completed in %.1fms: extracted %d transactions",
        elapsed_ms,
        len(validated_transactions),
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



