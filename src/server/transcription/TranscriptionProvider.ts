import type { Env } from "../../types";

export interface RecordingForTranscription {
  id: string;
  meetingId: string;
  r2Bucket: string;
  r2Key: string;
  mimeType: string | null;
  originalFilename: string | null;
}

export interface TranscriptResult {
  text: string;
  language?: string | null;
  durationSeconds?: number | null;
  confidenceScore?: number | null;
  providerName: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribeRecording(recording: RecordingForTranscription, env: Env): Promise<TranscriptResult>;
}
