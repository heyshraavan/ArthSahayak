/**
 * Structured extraction provider abstraction for ArthSahayak.
 *
 * Decouples the React UI from specific LLM or NLP extraction engines.
 */

import type { BackendTransaction, VoiceExtractionResponse } from '../types';
import { extractVoiceTransaction } from './api';

export interface ExtractionProvider {
  readonly name: string;
  extract(transcript: string): Promise<VoiceExtractionResponse>;
}

/**
 * Default extraction provider connecting to ArthSahayak FastAPI backend.
 */
export class BackendExtractionProvider implements ExtractionProvider {
  readonly name = 'ArthSahayak Backend Extraction Service';

  async extract(transcript: string): Promise<VoiceExtractionResponse> {
    const response = await extractVoiceTransaction(transcript);
    return {
      transcript: response.transcript,
      suggested_transaction: response.suggested_transaction as BackendTransaction,
      requires_confirmation: response.requires_confirmation,
    };
  }
}
