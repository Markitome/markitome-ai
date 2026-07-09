import type { Env } from "../../types";
import type { BotJoinOptions, BotProvider, BotSessionStatus } from "./BotProvider";
import { assertConfirmedConsent } from "./BotProvider";

export class GoogleMeetBotProvider implements BotProvider {
  readonly platform = "google_meet" as const;

  constructor(private readonly env: Env) {}

  async scheduleBotJoin(
    meetingUrl: string,
    meetingId: string,
    startTime: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createRecallBot(meetingUrl, meetingId, options, startTime);
  }

  async joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createRecallBot(meetingUrl, meetingId, options);
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.env.RECALLAI_API_KEY) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/bot/${encodeURIComponent(botSessionId)}/leave_call/`, {
      method: "POST",
      headers: this.headers()
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Recall.ai could not remove the bot from the call.")
      };
    }
    return {
      botSessionId,
      platform: this.platform,
      externalBotId: botSessionId,
      status: "left"
    };
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.env.RECALLAI_API_KEY) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/bot/${encodeURIComponent(botSessionId)}/`, {
      headers: this.headers()
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Recall.ai could not retrieve bot status.")
      };
    }
    const json = await response.json() as RecallBotResponse;
    return this.fromRecallBot(json, botSessionId);
  }

  async handleWebhook(_payload: unknown): Promise<BotSessionStatus | null> {
    return null;
  }

  private async createRecallBot(
    meetingUrl: string,
    botSessionId: string,
    options: BotJoinOptions,
    joinAt?: string
  ): Promise<BotSessionStatus> {
    if (!this.env.RECALLAI_API_KEY) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/bot/`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: options.botDisplayName,
        join_at: joinAt,
        metadata: {
          internal_bot_session_id: botSessionId,
          requested_by_user_id: options.requestedByUserId,
          consent_status: options.consentStatus,
          ...(options.metadata ?? {})
        }
      })
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Recall.ai could not create the Google Meet bot.")
      };
    }
    const json = await response.json() as RecallBotResponse;
    return this.fromRecallBot(json, botSessionId);
  }

  private missingProviderStatus(botSessionId: string): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status: "failed",
      errorMessage:
        "Google Meet bot joining is not configured. Set RECALLAI_API_KEY in Cloudflare Workers to enable a real recording bot."
    };
  }

  private fromRecallBot(bot: RecallBotResponse, internalBotSessionId: string): BotSessionStatus {
    const externalBotId = bot.id ?? bot.bot_id ?? internalBotSessionId;
    return {
      botSessionId: internalBotSessionId,
      externalBotId,
      platform: this.platform,
      status: mapRecallStatus(bot.status ?? bot.state),
      errorMessage: bot.status_changes?.find((change) => change.code === "fatal")?.message ?? null,
      providerMetadata: {
        provider: "recall_ai",
        recall_bot_id: externalBotId,
        status: bot.status ?? bot.state ?? null,
        meeting_url: bot.meeting_url ?? null,
        join_at: bot.join_at ?? null
      }
    };
  }

  private baseUrl(): string {
    return (this.env.RECALLAI_BASE_URL || "https://us-east-1.recall.ai/api/v1").replace(/\/+$/, "");
  }

  private headers(): HeadersInit {
    return {
      accept: "application/json",
      authorization: `Token ${this.env.RECALLAI_API_KEY}`,
      "content-type": "application/json"
    };
  }

  private async errorMessage(response: Response, fallback: string): Promise<string> {
    const text = await response.text();
    if (!text) return `${fallback} Provider returned ${response.status}.`;
    try {
      const json = JSON.parse(text) as { detail?: string; message?: string; error?: string; code?: string };
      return `${fallback} Provider returned ${response.status}${json.detail || json.message || json.error || json.code ? `: ${json.detail || json.message || json.error || json.code}` : ""}.`;
    } catch {
      return `${fallback} Provider returned ${response.status}: ${text.slice(0, 240)}.`;
    }
  }
}

interface RecallBotResponse {
  id?: string;
  bot_id?: string;
  meeting_url?: string;
  join_at?: string | null;
  status?: string;
  state?: string;
  status_changes?: Array<{ code?: string; message?: string }>;
}

function mapRecallStatus(status: string | undefined): BotSessionStatus["status"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("fatal") || normalized.includes("error")) return "failed";
  if (normalized.includes("done") || normalized.includes("ended") || normalized.includes("left")) return "left";
  if (normalized.includes("call") || normalized.includes("record")) return "recording";
  if (normalized.includes("join") || normalized.includes("wait")) return "joining";
  return "scheduled";
}
