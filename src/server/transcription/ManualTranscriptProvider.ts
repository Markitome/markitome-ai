import type { Env } from "../../types";
import type { RecordingForTranscription, TranscriptResult, TranscriptionProvider } from "./TranscriptionProvider";

export class ManualTranscriptProvider implements TranscriptionProvider {
  readonly name = "manual_transcript";

  constructor(private readonly text: string) {}

  async transcribeRecording(_recording: RecordingForTranscription, _env: Env): Promise<TranscriptResult> {
    return {
      text: this.text,
      providerName: this.name,
      confidenceScore: null,
      language: null,
      durationSeconds: null
    };
  }
}
