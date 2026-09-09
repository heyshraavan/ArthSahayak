"""Tests for Groq Whisper transcription integration.

Verifies:
- Provider selection with and without GROQ_API_KEY
- Mocked Groq client transcription success (whisper-large-v3, temp=0, response_format=json)
- Multilingual speech detection (no hard-coded language parameter)
- Audio MIME type and 10 MB size limit validation
- Upstream Groq failure handling (HTTP 502, no silent fake text fallback)
- Missing API key handling (VoiceConfigurationError)
- Server-side isolation and ledger non-mutation

ZERO external network calls are made in these automated tests.
"""

import base64
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.voice_engine import (
    AudioValidationError,
    GroqWhisperTranscriptionProvider,
    StubTranscriptionProvider,
    TranscriptionError,
    VoiceConfigurationError,
    get_transcription_provider,
    validate_audio_payload,
)

client = TestClient(app)


def test_provider_selection_without_groq_api_key(monkeypatch):
    """When GROQ_API_KEY is absent, StubTranscriptionProvider is selected.

    Application startup never crashes due to an absent key.
    """
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    provider = get_transcription_provider()
    assert isinstance(provider, StubTranscriptionProvider)


def test_provider_selection_with_groq_api_key(monkeypatch):
    """When GROQ_API_KEY is present, GroqWhisperTranscriptionProvider is selected."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_mock_key_12345")
    provider = get_transcription_provider()
    assert isinstance(provider, GroqWhisperTranscriptionProvider)
    assert provider.api_key == "gsk_test_mock_key_12345"


def test_groq_provider_missing_key_raises_configuration_error(monkeypatch):
    """Explicitly initializing GroqWhisperTranscriptionProvider without a key raises VoiceConfigurationError."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(VoiceConfigurationError) as exc_info:
        GroqWhisperTranscriptionProvider(api_key="")
    assert "GROQ_API_KEY is not configured" in str(exc_info.value)


def test_groq_whisper_transcription_success_mocked():
    """Verify GroqWhisperTranscriptionProvider calls Groq API with exact parameters.

    Requirements:
    - model='whisper-large-v3'
    - temperature=0.0
    - response_format='json'
    - No hard-coded language parameter (Whisper detects multilingual speech)
    """
    mock_groq = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "स्कूल से 14,000 रुपये 2 डेस्क के लिए मिले"
    mock_groq.audio.transcriptions.create.return_value = mock_response

    provider = GroqWhisperTranscriptionProvider(api_key="gsk_mock_test_key", client=mock_groq)

    sample_audio = b"fake_webm_audio_bytes_data"
    result = provider.transcribe(audio_data=sample_audio, mime_type="audio/webm;codecs=opus")

    assert result == "स्कूल से 14,000 रुपये 2 डेस्क के लिए मिले"

    # Verify call parameters
    mock_groq.audio.transcriptions.create.assert_called_once()
    _, kwargs = mock_groq.audio.transcriptions.create.call_args

    assert kwargs["model"] == "whisper-large-v3"
    assert kwargs["temperature"] == 0.0
    assert kwargs["response_format"] == "json"
    assert "language" not in kwargs  # Must allow Whisper to detect multilingual speech
    assert kwargs["file"][0] == "recording.webm"
    assert kwargs["file"][1] == sample_audio


def test_groq_whisper_upstream_failure_raises_transcription_error():
    """Upstream Groq failures must raise TranscriptionError and NEVER silently substitute fake text."""
    mock_groq = MagicMock()
    mock_groq.audio.transcriptions.create.side_effect = Exception("Groq 429 Rate limit exceeded")

    provider = GroqWhisperTranscriptionProvider(api_key="gsk_mock_test_key", client=mock_groq)

    with pytest.raises(TranscriptionError) as exc_info:
        provider.transcribe(audio_data=b"valid_audio_bytes", mime_type="audio/webm")

    assert "Groq Whisper transcription failed" in str(exc_info.value)
    assert "Rate limit exceeded" in str(exc_info.value)


def test_groq_whisper_empty_transcription_handling():
    """If Groq returns whitespace or empty text, raise TranscriptionError."""
    mock_groq = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "   "
    mock_groq.audio.transcriptions.create.return_value = mock_response

    provider = GroqWhisperTranscriptionProvider(api_key="gsk_mock_test_key", client=mock_groq)

    with pytest.raises(TranscriptionError) as exc_info:
        provider.transcribe(audio_data=b"valid_audio_bytes", mime_type="audio/wav")

    assert "empty transcription" in str(exc_info.value)


def test_audio_validation_mime_types():
    """Verify supported and unsupported MIME types."""
    # Valid audio MIME types
    for valid_mime in ["audio/webm", "audio/webm;codecs=opus", "audio/mp4", "audio/wav", "audio/mp3", "audio/ogg", "audio/m4a"]:
        validate_audio_payload(b"audio_bytes", valid_mime)

    # Invalid MIME types must raise AudioValidationError
    for invalid_mime in ["application/pdf", "image/png", "text/plain", "video/mp4"]:
        with pytest.raises(AudioValidationError) as exc_info:
            validate_audio_payload(b"audio_bytes", invalid_mime)
        assert "Unsupported audio MIME type" in str(exc_info.value)


def test_audio_validation_10mb_size_limit():
    """Verify 10 MB application-level size limit enforcement."""
    ten_mb = 10 * 1024 * 1024

    # 10 MB exact is allowed
    validate_audio_payload(b"x" * ten_mb, "audio/webm")

    # 10 MB + 1 byte must be rejected
    with pytest.raises(AudioValidationError) as exc_info:
        validate_audio_payload(b"x" * (ten_mb + 1), "audio/webm")
    assert "exceeds the 10 MB application limit" in str(exc_info.value)


def test_audio_validation_empty_payload():
    """Empty audio payload must be rejected."""
    with pytest.raises(AudioValidationError) as exc_info:
        validate_audio_payload(b"", "audio/webm")
    assert "Audio data is empty" in str(exc_info.value)


def test_api_endpoint_groq_failure_returns_502(monkeypatch):
    """Verify POST /voice/transcribe returns 502 Bad Gateway on Groq failure without fake text."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key")

    mock_groq = MagicMock()
    mock_groq.audio.transcriptions.create.side_effect = Exception("Service Unavailable: Upstream 503")

    # Patch Groq initialization in voice_engine
    monkeypatch.setattr("groq.Groq", lambda **kwargs: mock_groq)

    b64_audio = base64.b64encode(b"sample_audio_bytes").decode("utf-8")
    response = client.post(
        "/voice/transcribe",
        json={"audio_base64": b64_audio, "mime_type": "audio/webm"},
    )

    assert response.status_code == 502
    err_detail = response.json().get("detail", "")
    assert "Upstream transcription error" in err_detail
    assert "Service Unavailable" in err_detail


def test_api_endpoint_unsupported_mime_returns_422(monkeypatch):
    """Verify POST /voice/transcribe returns 422 for non-audio MIME types."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    b64_audio = base64.b64encode(b"sample_bytes").decode("utf-8")
    response = client.post(
        "/voice/transcribe",
        json={"audio_base64": b64_audio, "mime_type": "application/pdf"},
    )
    assert response.status_code == 422
    assert "Unsupported audio MIME type" in response.json().get("detail", "")


def test_transcribe_endpoint_does_not_mutate_ledger():
    """Verify POST /voice/transcribe does not return financial summary or calculate metrics."""
    b64_audio = base64.b64encode(b"test:Paid Rs 7500 for timber planks").decode("utf-8")
    response = client.post(
        "/voice/transcribe",
        json={"audio_base64": b64_audio, "mime_type": "audio/webm"},
    )
    assert response.status_code == 200
    data = response.json()

    assert "transcript" in data
    assert "turnover" not in data
    assert "working_capital_requirement" not in data
    assert "dscr" not in data
