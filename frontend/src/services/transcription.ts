/**
 * Transcription provider abstraction for ArthSahayak.
 *
 * Decouples the React UI from specific STT engines (Groq Whisper, Bhashini STT, etc.).
 */

import { transcribeAudio } from './api';

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(audio: Blob): Promise<string>;
}

/**
 * Convert a browser audio Blob into a Base64-encoded string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove Data-URL prefix (e.g. "data:audio/webm;base64,")
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Data);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Default transcription provider connecting to ArthSahayak FastAPI backend.
 */
export class BackendTranscriptionProvider implements TranscriptionProvider {
  readonly name = 'ArthSahayak Backend Transcription Service';

  async transcribe(audio: Blob): Promise<string> {
    const base64Data = await blobToBase64(audio);
    const mimeType = audio.type || 'audio/webm';
    const response = await transcribeAudio(base64Data, mimeType);
    return response.transcript;
  }
}
