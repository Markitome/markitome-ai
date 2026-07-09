import type { Env } from "../../types";
import type { RecordingForTranscription, TranscriptResult, TranscriptionProvider } from "./TranscriptionProvider";

export class CloudflareWorkersAITranscriptionProvider implements TranscriptionProvider {
  readonly name = "cloudflare_workers_ai";

  async transcribeRecording(_recording: RecordingForTranscription, _env: Env): Promise<TranscriptResult> {
    throw new Error(
      "Cloudflare Workers AI transcription is not wired in this MVP because no AI binding/model contract was specified. Add an AI binding and implement audio-to-text here."
    );
  }
}
