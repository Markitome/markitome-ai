import type { Env } from "../../types";
import type { RecordingForTranscription, TranscriptResult, TranscriptionProvider } from "./TranscriptionProvider";

export class ExternalSTTProvider implements TranscriptionProvider {
  readonly name = "external_stt";

  async transcribeRecording(_recording: RecordingForTranscription, _env: Env): Promise<TranscriptResult> {
    throw new Error(
      "External STT provider is a placeholder. Configure a Whisper-compatible or vendor STT API here without using Claude as the speech-to-text engine."
    );
  }
}
