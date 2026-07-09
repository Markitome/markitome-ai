import type { Env, MeetingPlatform } from "../../types";
import type { BotJoinOptions, BotProvider, BotSessionStatus } from "./BotProvider";
import { assertConfirmedConsent } from "./BotProvider";

type ScreenAppSupportedPlatform = "google_meet" | "zoom" | "microsoft_teams";

export class ScreenAppMeetingBotProvider implements BotProvider {
  readonly platform: ScreenAppSupportedPlatform;

  constructor(private readonly env: Env, platform: ScreenAppSupportedPlatform) {
    this.platform = platform;
  }

  async scheduleBotJoin(
    meetingUrl: string,
    meetingId: string,
    _startTime: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createJoinJob(meetingUrl, meetingId, options);
  }

  async joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createJoinJob(meetingUrl, meetingId, options);
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    return {
      botSessionId,
      externalBotId: botSessionId,
      platform: this.platform,
      status: "leaving",
      errorMessage:
        "The open-source screenappai/meeting-bot API does not expose a documented remote stop endpoint. The bot leaves automatically when the meeting ends, max duration is reached, or it is removed by the host."
    };
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/isbusy`, { headers: this.headers() });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "ScreenApp Meeting Bot could not retrieve status.")
      };
    }
    const payload = (await response.json()) as { data?: number | boolean };
    return {
      botSessionId,
      externalBotId: botSessionId,
      platform: this.platform,
      status: payload.data ? "recording" : "left",
      providerMetadata: {
        provider: "screenappai/meeting-bot",
        busy: Boolean(payload.data)
      }
    };
  }

  async handleWebhook(payload: unknown): Promise<BotSessionStatus | null> {
    const body = payload as {
      recordingId?: string;
      meetingLink?: string;
      status?: string;
      blobUrl?: string;
      timestamp?: string;
      error?: { message?: string; type?: string };
      metadata?: {
        botId?: string;
        eventId?: string;
        provider?: string;
        storage?: Record<string, unknown>;
      };
    };
    const botSessionId = body.metadata?.botId;
    if (!botSessionId) return null;
    const platform = fromScreenAppProvider(body.metadata?.provider);
    return {
      botSessionId,
      externalBotId: createExternalBotId(botSessionId),
      platform: platform ?? this.platform,
      status: body.status === "failed" ? "failed" : "left",
      recordingR2Key: body.recordingId ? `screenapp-recording:${body.recordingId}` : null,
      errorMessage: body.error?.message ?? null,
      providerMetadata: {
        provider: "screenappai/meeting-bot",
        recording_id: body.recordingId ?? null,
        blob_url: body.blobUrl ?? null,
        meeting_link: body.meetingLink ?? null,
        timestamp: body.timestamp ?? null,
        storage: body.metadata?.storage ?? null,
        error: body.error ?? null
      }
    };
  }

  private async createJoinJob(
    meetingUrl: string,
    botSessionId: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}${this.joinPath()}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        bearerToken: this.env.SCREENAPP_BOT_API_TOKEN,
        url: meetingUrl,
        name: options.botDisplayName,
        teamId: "markitome",
        timezone: "UTC",
        userId: options.requestedByUserId,
        eventId: options.metadata?.meetingId ?? botSessionId,
        botId: botSessionId
      })
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "ScreenApp Meeting Bot could not create the join job.")
      };
    }
    const payload = (await response.json()) as {
      success?: boolean;
      message?: string;
      data?: { status?: string; botId?: string; eventId?: string };
    };
    return {
      botSessionId,
      externalBotId: createExternalBotId(botSessionId),
      platform: this.platform,
      status: payload.success === false ? "failed" : "joining",
      errorMessage: payload.success === false ? payload.message ?? "ScreenApp Meeting Bot rejected the join job." : null,
      providerMetadata: {
        provider: "screenappai/meeting-bot",
        endpoint: this.joinPath(),
        response: payload
      }
    };
  }

  private joinPath(): string {
    if (this.platform === "google_meet") return "/google/join";
    if (this.platform === "microsoft_teams") return "/microsoft/join";
    return "/zoom/join";
  }

  private isConfigured(): boolean {
    return Boolean(this.env.SCREENAPP_BOT_API_URL && this.env.SCREENAPP_BOT_API_TOKEN);
  }

  private missingProviderStatus(botSessionId: string): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status: "failed",
      errorMessage:
        "ScreenApp Meeting Bot is not configured. Deploy the free MIT-licensed screenappai/meeting-bot service, then set SCREENAPP_BOT_API_URL and SCREENAPP_BOT_API_TOKEN in Cloudflare Workers."
    };
  }

  private baseUrl(): string {
    return (this.env.SCREENAPP_BOT_API_URL ?? "").replace(/\/+$/, "");
  }

  private headers(): HeadersInit {
    return {
      accept: "application/json",
      "content-type": "application/json"
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

function createExternalBotId(botSessionId: string): string {
  return `screenapp|${botSessionId}`;
}

function fromScreenAppProvider(provider: string | undefined): MeetingPlatform | null {
  if (provider === "google") return "google_meet";
  if (provider === "microsoft") return "microsoft_teams";
  if (provider === "zoom") return "zoom";
  return null;
}
