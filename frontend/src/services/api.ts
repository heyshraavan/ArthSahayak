import type {
  DossierInput,
  FinanceCalculationRequest,
  FinancialSummary,
  OcrExtractionResponse,
} from '../types';

const RAW_API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://127.0.0.1:8000';
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Send financial calculation request to FastAPI backend.
 * Calls POST /finance/calculate and returns deterministic FinancialSummary.
 */
export async function calculateFinance(
  request: FinanceCalculationRequest
): Promise<FinancialSummary> {
  const url = `${API_BASE_URL}/finance/calculate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      let errorMessage = `Server error ${response.status}: ${response.statusText}`;
      let errorDetails: unknown = null;
      try {
        errorDetails = await response.json();
        if (
          typeof errorDetails === 'object' &&
          errorDetails !== null &&
          'detail' in errorDetails
        ) {
          const detail = (errorDetails as { detail: unknown }).detail;
          errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
        }
      } catch {
        // response was not JSON
      }
      throw new ApiError(errorMessage, response.status, errorDetails);
    }

    const data = await response.json();

    // Validate expected numeric fields
    if (
      typeof data.total_credit !== 'number' ||
      typeof data.total_debit !== 'number' ||
      typeof data.net_cash_flow !== 'number' ||
      typeof data.turnover !== 'number' ||
      typeof data.working_capital_requirement !== 'number' ||
      typeof data.promoter_margin !== 'number' ||
      typeof data.maximum_permissible_bank_finance !== 'number'
    ) {
      throw new ApiError('Invalid response payload format from Finance Engine');
    }

    return {
      total_credit: data.total_credit,
      total_debit: data.total_debit,
      net_cash_flow: data.net_cash_flow,
      turnover: data.turnover,
      working_capital_requirement: data.working_capital_requirement,
      promoter_margin: data.promoter_margin,
      maximum_permissible_bank_finance: data.maximum_permissible_bank_finance,
      dscr: typeof data.dscr === 'number' ? data.dscr : null,
    };
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : 'Unknown connection error';
    throw new ApiError(
      `Network Error: Failed to reach ArthSahayak API (${message}). Ensure FastAPI is running at ${API_BASE_URL}.`,
      0
    );
  }
}

/**
 * Check backend service health status.
 * Calls GET /health.
 */
export async function checkHealth(): Promise<{ status: string; service: string }> {
  const url = `${API_BASE_URL}/health`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(`Health check failed with status: ${response.status}`, response.status);
  }
  return response.json();
}

/**
 * Transcribe audio payload through the backend transcription endpoint.
 * Calls POST /voice/transcribe.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType = 'audio/webm'
): Promise<{ transcript: string; confidence?: number | null }> {
  const url = `${API_BASE_URL}/voice/transcribe`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        audio_base64: audioBase64,
        mime_type: mimeType,
      }),
    });

    if (!response.ok) {
      let errorMessage = `Transcription server error (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson?.detail) {
          errorMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // non-json response
      }
      throw new ApiError(errorMessage, response.status);
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown transcription error';
    throw new ApiError(`Failed to transcribe audio: ${message}`);
  }
}

/**
 * Extract structured transaction suggestion from transcribed text.
 * Calls POST /voice/extract.
 *
 * NOTE: The returned suggestion is UNTRUSTED AI OUTPUT and requires human verification.
 */
export async function extractVoiceTransaction(
  transcript: string
): Promise<{
  transcript: string;
  suggested_transaction: {
    date: string;
    party_name: string;
    item: string;
    amount: number;
    tx_type: 'credit' | 'debit';
    category?: string | null;
  };
  requires_confirmation: boolean;
}> {
  const url = `${API_BASE_URL}/voice/extract`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      let errorMessage = `Extraction error (${response.status})`;
      try {
        const errJson = await response.json();
        if (errJson?.detail) {
          errorMessage = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // non-json
      }
      throw new ApiError(errorMessage, response.status);
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown extraction error';
    throw new ApiError(`Failed to extract transaction from voice: ${message}`);
  }
}

/**
 * Extract structured transactions from a photograph of a handwritten slip, receipt, or bahi-khata.
 * Calls POST /ocr/extract.
 *
 * NOTE: The returned suggestions are UNTRUSTED AI OUTPUT and require human verification.
 */
export async function extractOcrTransactions(
  imageBase64: string,
  mimeType = 'image/jpeg'
): Promise<OcrExtractionResponse> {
  const url = `${API_BASE_URL}/ocr/extract`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        image_base64: imageBase64,
        mime_type: mimeType,
      }),
    });

    if (!response.ok) {
      let errorMessage = `OCR extraction error (${response.status})`;
      let detailMsg: string | null = null;
      try {
        const errJson = await response.json();
        if (errJson?.detail) {
          detailMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // non-json response
      }

      if (response.status === 422) {
        errorMessage = detailMsg || 'The image could not be reliably read. Please review or enter manually.';
      } else if (response.status === 502) {
        errorMessage = 'AI service is temporarily unavailable. Please try again.';
      } else if (detailMsg) {
        errorMessage = detailMsg;
      }
      throw new ApiError(errorMessage, response.status);
    }

    return await response.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown network error';
    throw new ApiError(
      `Network Error: Failed to reach ArthSahayak OCR service (${message}). AI scanning requires an active connection.`,
      0
    );
  }
}

/**
 * Generate an audit-ready 2-page PDF Credit Appraisal Dossier.
 * Calls POST /dossier/generate with structured financial & applicant data.
 * Returns the PDF as a binary Blob.
 */
export async function generateDossier(input: DossierInput): Promise<Blob> {
  const url = `${API_BASE_URL}/dossier/generate`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      let errorMessage = `Dossier generation error (${response.status})`;
      let detailMsg: string | null = null;
      try {
        const errJson = await response.json();
        if (errJson?.detail) {
          detailMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        // non-json response
      }

      if (response.status === 422) {
        errorMessage = detailMsg || 'Invalid data payload for credit dossier.';
      } else if (response.status === 500) {
        errorMessage = detailMsg || 'Server error generating PDF dossier. Please try again.';
      } else if (detailMsg) {
        errorMessage = detailMsg;
      }
      throw new ApiError(errorMessage, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      throw new ApiError('Invalid response from server: expected PDF document', response.status);
    }

    return await response.blob();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown network error';
    throw new ApiError(
      `Network Error: Failed to reach ArthSahayak API (${message}). Ensure backend server is running at ${API_BASE_URL}.`,
      0
    );
  }
}

