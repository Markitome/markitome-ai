import type { Env, MeetingPlatform } from "../../types";
import { ApiError } from "../http/errors";
import { id } from "../utils/crypto";
import { BOT_DISPLAY_NAME, type BotProvider, type BotSessionStatus } from "./BotProvider";
import { GoogleMeetBotProvider } from "./GoogleMeetBotProvider";
import { TeamsBotProvider } from "./TeamsBotProvider";
import { ZoomBotProvider } from "./ZoomBotProvider";

export class BotSessionService {
  private readonly providers = new Map<MeetingPlatform, BotProvider>([
    ["google_meet", new GoogleMeetBotProvider()],
    ["zoom", new ZoomBotProvider()],
    ["microsoft_teams", new TeamsBotProvider()]
  ]);

  constructor(private readonly env: Env) {}

  async schedule(input: {
    platform: MeetingPlatform;
    meetingUrl: string;
    meetingId: string;
    startTime: string;
    consentStatus: string;
    requestedByUserId: string;
  }): Promise<BotSessionStatus> {
    const provider = this.getProvider(input.platform);
    if (input.consentStatus !== "confirmed") {
      throw new ApiError(400, "consent_required", "Bot recording cannot start until consent is confirmed.");
    }
    const botSessionId = id("bot");
    await this.insertSession(botSessionId, input.meetingId, input.platform, input.meetingUrl, "scheduled", input.consentStatus);
    const status = await provider.scheduleBotJoin(input.meetingUrl, botSessionId, input.startTime, {
      consentStatus: "confirmed",
      requestedByUserId: input.requestedByUserId,
      botDisplayName: BOT_DISPLAY_NAME
    });
    await this.updateSession(botSessionId, status.status, status.errorMessage ?? null);
    return { ...status, botSessionId };
  }

  async joinNow(input: {
    platform: MeetingPlatform;
    meetingUrl: string;
    meetingId: string;
    consentStatus: string;
    requestedByUserId: string;
  }): Promise<BotSessionStatus> {
    const provider = this.getProvider(input.platform);
    if (input.consentStatus !== "confirmed") {
      throw new ApiError(400, "consent_required", "Bot recording cannot start until consent is confirmed.");
    }
    const botSessionId = id("bot");
    await this.insertSession(botSessionId, input.meetingId, input.platform, input.meetingUrl, "joining", input.consentStatus);
    const status = await provider.joinNow(input.meetingUrl, botSessionId, {
      consentStatus: "confirmed",
      requestedByUserId: input.requestedByUserId,
      botDisplayName: BOT_DISPLAY_NAME
    });
    await this.updateSession(botSessionId, status.status, status.errorMessage ?? null);
    return { ...status, botSessionId };
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    const session = await this.getSession(botSessionId);
    const provider = this.getProvider(session.platform);
    const status = await provider.leave(botSessionId);
    await this.env.DB.prepare(
      "UPDATE bot_sessions SET status = ?, leave_time = ?, updated_at = ? WHERE id = ?"
    )
      .bind(status.status, new Date().toISOString(), new Date().toISOString(), botSessionId)
      .run();
    return status;
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    const session = await this.getSession(botSessionId);
    return {
      botSessionId,
      platform: session.platform,
      status: session.status,
      recordingR2Key: session.recordingR2Key,
      errorMessage: session.errorMessage
    };
  }

  async handleWebhook(platform: MeetingPlatform, payload: unknown): Promise<BotSessionStatus | null> {
    const provider = this.getProvider(platform);
    return provider.handleWebhook(payload);
  }

  private getProvider(platform: MeetingPlatform): BotProvider {
    const provider = this.providers.get(platform);
    if (!provider) throw new ApiError(400, "unsupported_bot_platform", `No bot provider is configured for ${platform}.`);
    return provider;
  }

  private async insertSession(
    botSessionId: string,
    meetingId: string,
    platform: MeetingPlatform,
    meetingUrl: string,
    status: string,
    consentStatus: string
  ): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO bot_sessions (
        id, meeting_id, platform, meeting_url, bot_display_name, status, consent_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        botSessionId,
        meetingId,
        platform,
        meetingUrl,
        BOT_DISPLAY_NAME,
        status,
        consentStatus,
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();
  }

  private async updateSession(botSessionId: string, status: string, errorMessage: string | null): Promise<void> {
    await this.env.DB.prepare("UPDATE bot_sessions SET status = ?, error_message = ?, updated_at = ? WHERE id = ?")
      .bind(status, errorMessage, new Date().toISOString(), botSessionId)
      .run();
  }

  private async getSession(botSessionId: string): Promise<{
    platform: MeetingPlatform;
    status: BotSessionStatus["status"];
    recordingR2Key: string | null;
    errorMessage: string | null;
  }> {
    const session = await this.env.DB.prepare(
      `SELECT platform, status, recording_r2_key AS recordingR2Key, error_message AS errorMessage
       FROM bot_sessions WHERE id = ?`
    )
      .bind(botSessionId)
      .first<{
        platform: MeetingPlatform;
        status: BotSessionStatus["status"];
        recordingR2Key: string | null;
        errorMessage: string | null;
      }>();
    if (!session) throw new ApiError(404, "not_found", "Bot session not found.");
    return session;
  }
}
