import type { Env } from "../../types";
import type { RecordingForTranscription, TranscriptResult, TranscriptionProvider } from "./TranscriptionProvider";

type WhisperResult = {
  text?: string;
  word_count?: number;
  transcription_info?: {
    language?: string;
    duration?: number;
  };
};

export class CloudflareWorkersAITranscriptionProvider implements TranscriptionProvider {
  readonly name = "cloudflare_workers_ai";

  async transcribeRecording(recording: RecordingForTranscription, env: Env): Promise<TranscriptResult> {
    if (!env.AI) {
      throw new Error("Cloudflare Workers AI binding is missing. Add [ai] binding = \"AI\" to wrangler.toml.");
    }

    const object = await env.RECORDINGS.get(recording.r2Key);
    if (!object) {
      throw new Error("Recording object was not found in R2.");
    }

    const audio = await object.arrayBuffer();
    if (audio.byteLength === 0) {
      throw new Error("Recording object is empty.");
    }

    const model = env.STT_MODEL || "@cf/openai/whisper-large-v3-turbo";
    const result = await transcribeWithWorkersAI(env, model, audio);
    const text = result.text?.trim();
    if (!text) {
      throw new Error("Cloudflare Workers AI returned an empty transcript.");
    }

    return {
      text,
      providerName: this.name,
      confidenceScore: null,
      language: result.transcription_info?.language ?? null,
      durationSeconds: result.transcription_info?.duration ?? null
    };
  }
}

async function transcribeWithWorkersAI(env: Env, model: string, audio: ArrayBuffer): Promise<WhisperResult> {
  if (model === "@cf/openai/whisper") {
    const response = await env.AI!.run(model, { audio: [...new Uint8Array(audio)] });
    return response;
  }

  const base64Audio = arrayBufferToBase64(audio);
  const response = await env.AI!.run(model, {
    audio: base64Audio,
    task: "transcribe",
    vad_filter: true,
    condition_on_previous_text: false
  });
  return response as WhisperResult;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
