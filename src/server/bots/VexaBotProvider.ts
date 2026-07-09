import type { Env, MeetingPlatform } from "../../types";
import type { BotJoinOptions, BotProvider, BotSessionStatus } from "./BotProvider";
import { assertConfirmedConsent } from "./BotProvider";

type VexaSupportedPlatform = "google_meet" | "zoom" | "microsoft_teams";
type VexaApiPlatform = "google_meet" | "zoom" | "teams";

export class VexaBotProvider implements BotProvider {
  readonly platform: VexaSupportedPlatform;

  constructor(private readonly env: Env, platform: VexaSupportedPlatform) {
    this.platform = platform;
  }

  async scheduleBotJoin(
    meetingUrl: string,
    meetingId: string,
    _startTime: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createVexaBot(meetingUrl, meetingId, options);
  }

  async joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.createVexaBot(meetingUrl, meetingId, options);
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const meeting = parseExternalBotId(botSessionId) ?? this.parseMeetingUrl(botSessionId);
    if (!meeting) return this.invalidMeetingStatus(botSessionId);
    const response = await fetch(
      `${this.baseUrl()}/bots/${meeting.platform}/${encodeURIComponent(meeting.nativeMeetingId)}`,
      {
        method: "DELETE",
        headers: this.headers()
      }
    );
    if (!response.ok && response.status !== 404) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Vexa could not stop the bot.")
      };
    }
    return {
      botSessionId,
      externalBotId: createExternalBotId(meeting.platform, meeting.nativeMeetingId),
      platform: this.platform,
      status: "left",
      providerMetadata: { provider: "vexa", native_meeting_id: meeting.nativeMeetingId }
    };
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const meeting = parseExternalBotId(botSessionId);
    if (!meeting) {
      return {
        botSessionId,
        platform: this.platform,
        status: "scheduled",
        providerMetadata: { provider: "vexa", local_status: "not_sent_to_provider" }
      };
    }
    const response = await fetch(`${this.baseUrl()}/bots/status`, { headers: this.headers() });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Vexa could not retrieve bot status.")
      };
    }
    const payload = (await response.json()) as {
      running_bots?: Array<{
        container_id?: string;
        platform?: string;
        native_meeting_id?: string;
        status?: string;
        normalized_status?: string;
      }>;
    };
    const runningBot = (payload.running_bots ?? []).find(
      (bot) => bot.platform === meeting.platform && bot.native_meeting_id === meeting.nativeMeetingId
    );
    if (!runningBot) {
      return {
        botSessionId,
        externalBotId: createExternalBotId(meeting.platform, meeting.nativeMeetingId),
        platform: this.platform,
        status: "left",
        providerMetadata: { provider: "vexa", native_meeting_id: meeting.nativeMeetingId, running: false }
      };
    }
    return {
      botSessionId,
      externalBotId: createExternalBotId(meeting.platform, meeting.nativeMeetingId),
      platform: this.platform,
      status: mapVexaStatus(runningBot.normalized_status ?? runningBot.status),
      providerMetadata: {
        provider: "vexa",
        native_meeting_id: meeting.nativeMeetingId,
        container_id: runningBot.container_id ?? null,
        status: runningBot.status ?? null,
        normalized_status: runningBot.normalized_status ?? null
      }
    };
  }

  async handleWebhook(payload: unknown): Promise<BotSessionStatus | null> {
    const body = payload as {
      event_type?: string;
      meeting?: { platform?: string; native_meeting_id?: string; status?: string; id?: number | string };
      recording?: { id?: number | string; meeting_id?: number | string; status?: string; media_files?: unknown[] };
    };
    const meeting = body.meeting;
    if (!meeting?.platform || !meeting.native_meeting_id) return null;
    const platform = fromVexaPlatform(meeting.platform);
    if (!platform) return null;
    const externalBotId = createExternalBotId(meeting.platform as VexaApiPlatform, meeting.native_meeting_id);
    return {
      botSessionId: externalBotId,
      externalBotId,
      platform,
      status: mapVexaStatus(meeting.status),
      recordingR2Key: body.recording?.id ? `vexa-recording:${body.recording.id}` : null,
      providerMetadata: {
        provider: "vexa",
        event_type: body.event_type ?? null,
        meeting_id: meeting.id ?? null,
        native_meeting_id: meeting.native_meeting_id,
        recording: body.recording ?? null
      }
    };
  }

  private async createVexaBot(
    meetingUrl: string,
    botSessionId: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    if (!this.isConfigured()) return this.missingProviderStatus(botSessionId);
    const meeting = this.parseMeetingUrl(meetingUrl);
    if (!meeting) return this.invalidMeetingStatus(botSessionId);
    const response = await fetch(`${this.baseUrl()}/bots`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        platform: meeting.platform,
        native_meeting_id: meeting.nativeMeetingId,
        ...(meeting.passcode ? { passcode: meeting.passcode } : {}),
        bot_name: options.botDisplayName,
        recording_enabled: true,
        transcribe_enabled: true,
        transcription_tier: "realtime",
        language: "en"
      })
    });
    if (!response.ok) {
      return {
        botSessionId,
        platform: this.platform,
        status: "failed",
        errorMessage: await this.errorMessage(response, "Vexa could not create the bot.")
      };
    }
    const data = (await response.json()) as VexaMeetingResponse;
    const nativeMeetingId = data.native_meeting_id ?? meeting.nativeMeetingId;
    const apiPlatform = data.platform ?? meeting.platform;
    const externalBotId = createExternalBotId(apiPlatform, nativeMeetingId);
    return {
      botSessionId,
      externalBotId,
      platform: this.platform,
      status: mapVexaStatus(data.status),
      providerMetadata: {
        provider: "vexa",
        meeting_id: data.id ?? null,
        native_meeting_id: nativeMeetingId,
        constructed_meeting_url: data.constructed_meeting_url ?? null,
        bot_container_id: data.bot_container_id ?? null,
        status: data.status ?? null
      }
    };
  }

  private parseMeetingUrl(meetingUrl: string): ParsedVexaMeeting | null {
    try {
      const url = new URL(meetingUrl);
      if (this.platform === "google_meet") {
        const code = url.pathname.split("/").filter(Boolean).at(-1);
        if (!code || code === "lookup") return null;
        return { platform: "google_meet", nativeMeetingId: code };
      }
      if (this.platform === "zoom") {
        const parts = url.pathname.split("/").filter(Boolean);
        const meetingId = parts[0] === "j" ? parts[1] : parts.find((part) => /^\d{9,11}$/.test(part));
        if (!meetingId) return null;
        return { platform: "zoom", nativeMeetingId: meetingId, passcode: url.searchParams.get("pwd") ?? undefined };
      }
      const teamsPathMatch = url.pathname.match(/\/meet\/(\d+)/);
      const meetingId = teamsPathMatch?.[1] ?? url.searchParams.get("meetingId") ?? undefined;
      const passcode = url.searchParams.get("p") ?? url.searchParams.get("passcode") ?? undefined;
      if (!meetingId) return null;
      return { platform: "teams", nativeMeetingId: meetingId, passcode };
    } catch {
      return null;
    }
  }

  private isConfigured(): boolean {
    return Boolean(this.env.VEXA_API_URL && this.env.VEXA_API_KEY);
  }

  private missingProviderStatus(botSessionId: string): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status: "failed",
      errorMessage:
        "Vexa is not configured. Set VEXA_API_URL and VEXA_API_KEY in Cloudflare Workers to enable open-source meeting bots."
    };
  }

  private invalidMeetingStatus(botSessionId: string): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status: "failed",
      errorMessage: `Vexa could not extract a native meeting ID from the ${this.platform} meeting URL.`
    };
  }

  private baseUrl(): string {
    return (this.env.VEXA_API_URL ?? "").replace(/\/+$/, "");
  }

  private headers(): HeadersInit {
    return {
      accept: "application/json",
      "content-type": "application/json",
      "X-API-Key": this.env.VEXA_API_KEY ?? ""
    };
  }

  private async errorMessage(response: Response, fallback: string): Promise<string> {
    const text = await response.text();
    if (!text) return `${fallback} Provider returned ${response.status}.`;
    try {
      const json = JSON.parse(text) as { detail?: string; error?: string; message?: string };
      return `${fallback} Provider returned ${response.status}${json.detail || json.error || json.message ? `: ${json.detail || json.error || json.message}` : ""}.`;
    } catch {
      return `${fallback} Provider returned ${response.status}: ${text.slice(0, 240)}.`;
    }
  }
}

interface ParsedVexaMeeting {
  platform: VexaApiPlatform;
  nativeMeetingId: string;
  passcode?: string;
}

interface VexaMeetingResponse {
  id?: number | string;
  platform?: VexaApiPlatform;
  native_meeting_id?: string;
  constructed_meeting_url?: string;
  status?: string;
  bot_container_id?: string | null;
}

function createExternalBotId(platform: VexaApiPlatform | string, nativeMeetingId: string): string {
  return `vexa|${platform}|${nativeMeetingId}`;
}

function parseExternalBotId(value: string): ParsedVexaMeeting | null {
  const [provider, platform, nativeMeetingId] = value.split("|");
  if (provider !== "vexa" || !nativeMeetingId) return null;
  if (platform !== "google_meet" && platform !== "zoom" && platform !== "teams") return null;
  return { platform, nativeMeetingId };
}

function fromVexaPlatform(platform: string): MeetingPlatform | null {
  if (platform === "google_meet") return "google_meet";
  if (platform === "zoom") return "zoom";
  if (platform === "teams") return "microsoft_teams";
  return null;
}

function mapVexaStatus(status: string | undefined): BotSessionStatus["status"] {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("fail") || normalized.includes("fatal") || normalized.includes("error")) return "failed";
  if (normalized.includes("completed") || normalized.includes("done") || normalized.includes("stopped")) return "left";
  if (normalized.includes("stopping")) return "leaving";
  if (normalized.includes("active") || normalized === "up" || normalized.includes("running")) return "recording";
  if (normalized.includes("joining") || normalized.includes("admission") || normalized.includes("requested")) return "joining";
  return "scheduled";
}
