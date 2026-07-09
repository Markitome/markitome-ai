import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../../types";
import { aiNotesSchema, renderNotesMarkdown, type AiNotesJson } from "./notesSchema";

interface GenerateNotesInput {
  meetingTitle: string;
  agenda: string | null;
  participants: string[];
  transcriptText: string;
  manualNotes: string | null;
  metadata: Record<string, unknown>;
}

export interface GeneratedNotes {
  rawResponse: string;
  parsed: AiNotesJson;
  renderedMarkdown: string;
  modelName: string;
  tokenUsage: unknown;
  generatedAt: string;
}

const fallbackModel = "claude-3-5-sonnet-20241022";
const chunkSize = 24000;

export class ClaudeNotesService {
  constructor(private readonly env: Env) {}

  async generate(input: GenerateNotesInput): Promise<GeneratedNotes> {
    if (!this.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required for Claude note generation.");
    }

    const modelName = this.env.CLAUDE_MODEL || fallbackModel;
    const transcriptContext =
      input.transcriptText.length > chunkSize ? await this.summarizeLongTranscript(input, modelName) : input.transcriptText;

    const prompt = buildFinalPrompt({ ...input, transcriptText: transcriptContext });
    const response = await this.callClaude(modelName, prompt);
    const rawText = extractText(response);
    const parsed = await this.parseOrRepair(rawText, modelName);

    return {
      rawResponse: rawText,
      parsed,
      renderedMarkdown: renderNotesMarkdown(parsed),
      modelName,
      tokenUsage: response.usage ?? null,
      generatedAt: new Date().toISOString()
    };
  }

  private async summarizeLongTranscript(input: GenerateNotesInput, modelName: string): Promise<string> {
    const chunks = splitIntoChunks(input.transcriptText, chunkSize);
    const summaries: string[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      const prompt = `Summarize transcript chunk ${index + 1} of ${chunks.length}.

Rules:
- Preserve concrete decisions, action items, blockers, source quotes, owners, and due dates.
- Do not invent information.
- Return concise bullet points only.

Meeting title: ${input.meetingTitle}
Participants: ${input.participants.join(", ")}
Agenda: ${input.agenda ?? ""}

Transcript chunk:
${chunks[index]}`;
      const response = await this.callClaude(modelName, prompt, 3);
      summaries.push(extractText(response));
    }
    return summaries.map((summary, index) => `Chunk ${index + 1} summary:\n${summary}`).join("\n\n");
  }

  private async parseOrRepair(rawText: string, modelName: string): Promise<AiNotesJson> {
    const extracted = extractJsonObject(rawText);
    const first = safeParseNotes(extracted);
    if (first) return first;

    const repairPrompt = `Repair the following model output into valid JSON matching exactly this schema:
{
  "summary": "string",
  "suggested_action_items": [{"task":"string","assignee":"string or null","due_date":"string or null","priority":"low | medium | high","source_quote":"string or null"}],
  "decisions": [{"decision":"string","owner":"string or null","source_quote":"string or null"}],
  "topic_overview": [{"topic":"string","summary":"string","key_points":["string"],"open_questions":["string"]}],
  "risks_or_blockers": ["string"],
  "follow_up_email_draft": "string"
}

Return only valid JSON. Do not add new facts.

Output to repair:
${rawText}`;
    const repaired = await this.callClaude(modelName, repairPrompt, 2);
    const repairedText = extractText(repaired);
    const parsed = safeParseNotes(extractJsonObject(repairedText));
    if (!parsed) {
      throw new Error("Claude response could not be parsed as the required AI notes JSON schema.");
    }
    return parsed;
  }

  private async callClaude(modelName: string, prompt: string, maxRetries = 3): Promise<Anthropic.Messages.Message> {
    const anthropic = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY });
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await anthropic.messages.create({
          model: modelName,
          max_tokens: 6000,
          temperature: 0,
          system:
            "You generate grounded internal meeting notes. Use only supplied transcript, agenda, manual notes, and metadata. Return only valid JSON when asked for JSON.",
          messages: [{ role: "user", content: prompt }]
        });
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Claude request failed.");
  }
}

function buildFinalPrompt(input: GenerateNotesInput): string {
  return `Generate structured AI meeting notes.

Claude rules:
- Do not invent action items.
- Do not invent decisions.
- If assignee is unclear, use null.
- If due date is unclear, use null.
- If a decision is not clearly stated, do not include it.
- Preserve business context.
- Return only valid JSON.
- Include source quotes wherever useful.
- Be concise but complete.
- Avoid generic summaries.
- Use transcript and agenda as primary sources.

Required JSON format:
{
  "summary": "string",
  "suggested_action_items": [
    {"task": "string", "assignee": "string or null", "due_date": "string or null", "priority": "low | medium | high", "source_quote": "string or null"}
  ],
  "decisions": [
    {"decision": "string", "owner": "string or null", "source_quote": "string or null"}
  ],
  "topic_overview": [
    {"topic": "string", "summary": "string", "key_points": ["string"], "open_questions": ["string"]}
  ],
  "risks_or_blockers": ["string"],
  "follow_up_email_draft": "string"
}

Meeting title: ${input.meetingTitle}
Agenda: ${input.agenda ?? ""}
Participants: ${input.participants.join(", ")}
Manual notes: ${input.manualNotes ?? ""}
Metadata JSON: ${JSON.stringify(input.metadata)}

Transcript:
${input.transcriptText}`;
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return text;
  return text.slice(first, last + 1);
}

function safeParseNotes(text: string): AiNotesJson | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    const validated = aiNotesSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function splitIntoChunks(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}
