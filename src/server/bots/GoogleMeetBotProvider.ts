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
    return this.createMeetingBot(meetingUrl, meetingId, options, startTime);
  }

  async joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createMeetingBot(meetingUrl, meetingId, options);
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    return {
      botSessionId,
      externalBotId: botSessionId,
      platform: this.platform,
      status: "left",
      errorMessage:
        "MeetingBot does not expose a stable public stop-call endpoint in the inspected REST wrapper. Remove the bot from the meeting manually or extend the self-hosted MeetingBot API with a stop endpoint."
    };
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/api/bots/${encodeURIComponent(botSessionId)}`, {
      headers: this.headers()
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "MeetingBot could not retrieve bot status.")
      };
    }
    return this.fromMeetingBot(await response.json(), botSessionId);
  }

  async handleWebhook(payload: unknown): Promise<BotSessionStatus | null> {
    const body = payload as { botId?: number | string; status?: string; recording?: string };
    if (body.botId === undefined || body.botId === null) return null;
    return {
      botSessionId: String(body.botId),
      externalBotId: String(body.botId),
      platform: this.platform,
      status: mapMeetingBotStatus(body.status),
      recordingR2Key: body.recording ?? null,
      providerMetadata: {
        provider: "meetingbot",
        meetingbot_bot_id: String(body.botId),
        status: body.status ?? null
      }
    };
  }

  private async createMeetingBot(
    meetingUrl: string,
    botSessionId: string,
    options: BotJoinOptions,
    startTime?: string
  ): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/api/bots`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        userId: options.requestedByUserId,
        meetingTitle: options.metadata?.meetingTitle ?? "Markitome meeting",
        botDisplayName: options.botDisplayName,
        meetingInfo: {
          platform: "google",
          meetingUrl
        },
        startTime,
        callbackUrl: this.callbackUrl(),
        metadata: {
          internal_bot_session_id: botSessionId,
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
        errorMessage: await this.errorMessage(response, "MeetingBot could not create the Google Meet bot.")
      };
    }
    return this.fromMeetingBot(await response.json(), botSessionId);
  }

  private fromMeetingBot(bot: unknown, internalBotSessionId: string): BotSessionStatus {
    const data = bot as MeetingBotResponse;
    const externalBotId = data.id !== undefined && data.id !== null ? String(data.id) : internalBotSessionId;
    return {
      botSessionId: internalBotSessionId,
      externalBotId,
      platform: this.platform,
      status: mapMeetingBotStatus(data.status),
      errorMessage: data.deploymentError ?? data.deployment_error ?? null,
      providerMetadata: {
        provider: "meetingbot",
        meetingbot_bot_id: externalBotId,
        status: data.status ?? null,
        recording: data.recording ?? null,
        start_time: data.startTime ?? data.start_time ?? null
      }
    };
  }

  private isConfigured(): boolean {
    return Boolean(this.env.MEETINGBOT_API_URL && this.env.MEETINGBOT_API_KEY);
  }

  private missingProviderStatus(botSessionId: string): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status: "failed",
      errorMessage:
        "MeetingBot is not configured. Deploy meetingbot/meetingbot separately, then set MEETINGBOT_API_URL and MEETINGBOT_API_KEY in Cloudflare Workers."
    };
  }

  private baseUrl(): string {
    return (this.env.MEETINGBOT_API_URL ?? "").replace(/\/+$/, "");
  }

  private callbackUrl(): string {
    const secret = this.env.WEBHOOK_SECRET ? `?token=${encodeURIComponent(this.env.WEBHOOK_SECRET)}` : "";
    return `https://${this.env.APP_DOMAIN}/api/public/bots/meetingbot/webhook${secret}`;
  }

  private headers(): HeadersInit {
    return {
      accept: "application/json",
      "content-type": "application/json",
      "x-api-key": this.env.MEETINGBOT_API_KEY ?? ""
    };
  }

  private async errorMessage(response: Response, fallback: string): Promise<string> {
    const text = await response.text();
    if (!text) return `${fallback} Provider returned ${response.status}.`;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string; detail?: string };
      return `${fallback} Provider returned ${response.status}${json.error || json.message || json.detail ? `: ${json.error || json.message || json.detail}` : ""}.`;
    } catch {
      return `${fallback} Provider returned ${response.status}: ${text.slice(0, 240)}.`;
    }
  }
}

interface MeetingBotResponse {
  id?: number | string;
  status?: string;
  recording?: string | null;
  deploymentError?: string | null;
  deployment_error?: string | null;
  startTime?: string | null;
  start_time?: string | null;
}

function mapMeetingBotStatus(status: string | undefined): BotSessionStatus["status"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("fatal") || normalized.includes("error") || normalized.includes("fail")) return "failed";
  if (normalized.includes("done") || normalized.includes("left") || normalized.includes("ended")) return "left";
  if (normalized.includes("record") || normalized.includes("deployed") || normalized.includes("ready")) return "recording";
  if (normalized.includes("deploy") || normalized.includes("join") || normalized.includes("wait")) return "joining";
  return "scheduled";
}
