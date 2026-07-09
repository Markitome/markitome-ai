import type { Env, MeetingPlatform } from "../../types";
import { ApiError } from "../http/errors";
import { id } from "../utils/crypto";
import { BOT_DISPLAY_NAME, type BotProvider, type BotSessionStatus } from "./BotProvider";
import { GoogleMeetBotProvider } from "./GoogleMeetBotProvider";
import { TeamsBotProvider } from "./TeamsBotProvider";
import { VexaBotProvider } from "./VexaBotProvider";
import { ZoomBotProvider } from "./ZoomBotProvider";

export class BotSessionService {
  private readonly providers: Map<MeetingPlatform, BotProvider>;

  constructor(private readonly env: Env) {
    const useVexa = Boolean(env.VEXA_API_URL && env.VEXA_API_KEY);
    this.providers = new Map<MeetingPlatform, BotProvider>([
      ["google_meet", useVexa ? new VexaBotProvider(env, "google_meet") : new GoogleMeetBotProvider(env)],
      ["zoom", useVexa ? new VexaBotProvider(env, "zoom") : new ZoomBotProvider()],
      ["microsoft_teams", useVexa ? new VexaBotProvider(env, "microsoft_teams") : new TeamsBotProvider()]
    ]);
  }

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
    await this.insertSession(
      botSessionId,
      input.meetingId,
      input.platform,
      input.meetingUrl,
      "scheduled",
      input.consentStatus,
      input.startTime
    );
    if (shouldDeferToWorkerScheduler(input.startTime)) {
      return {
        botSessionId,
        platform: input.platform,
        status: "scheduled",
        providerMetadata: {
          provider: this.providerName(input.platform),
          local_scheduler: true,
          scheduled_join_time: input.startTime
        }
      };
    }
    const status = await provider.scheduleBotJoin(input.meetingUrl, botSessionId, input.startTime, {
      consentStatus: "confirmed",
      requestedByUserId: input.requestedByUserId,
      botDisplayName: BOT_DISPLAY_NAME
    });
    await this.updateSession(botSessionId, status);
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
    await this.insertSession(
      botSessionId,
      input.meetingId,
      input.platform,
      input.meetingUrl,
      "joining",
      input.consentStatus,
      new Date().toISOString()
    );
    const status = await provider.joinNow(input.meetingUrl, botSessionId, {
      consentStatus: "confirmed",
      requestedByUserId: input.requestedByUserId,
      botDisplayName: BOT_DISPLAY_NAME
    });
    await this.updateSession(botSessionId, status);
    return { ...status, botSessionId };
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    const session = await this.getSession(botSessionId);
    if (session.status === "scheduled" && !session.externalBotId) {
      const status: BotSessionStatus = {
        botSessionId,
        platform: session.platform,
        status: "left",
        providerMetadata: { local_scheduler: true, cancelled_before_join: true }
      };
      await this.updateSession(botSessionId, status);
      return status;
    }
    const provider = this.getProvider(session.platform);
    const status = await provider.leave(session.externalBotId ?? botSessionId);
    await this.env.DB.prepare(
      "UPDATE bot_sessions SET status = ?, leave_time = ?, updated_at = ? WHERE id = ?"
    )
      .bind(status.status, new Date().toISOString(), new Date().toISOString(), botSessionId)
      .run();
    return status;
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    const session = await this.getSession(botSessionId);
    if (session.externalBotId) {
      const status = await this.getProvider(session.platform).getStatus(session.externalBotId);
      const refreshed = { ...status, botSessionId };
      await this.updateSession(botSessionId, refreshed);
      return refreshed;
    }
    return {
      botSessionId,
      platform: session.platform,
      status: session.status,
      externalBotId: session.externalBotId,
      recordingR2Key: session.recordingR2Key,
      errorMessage: session.errorMessage
    };
  }

  async handleWebhook(platform: MeetingPlatform, payload: unknown): Promise<BotSessionStatus | null> {
    const provider = this.getProvider(platform);
    return provider.handleWebhook(payload);
  }

  async handleMeetingBotWebhook(payload: unknown): Promise<BotSessionStatus | null> {
    const status = await this.providers.get("google_meet")?.handleWebhook(payload);
    if (!status?.externalBotId) return status ?? null;
    await this.env.DB.prepare(
      "UPDATE bot_sessions SET status = ?, recording_r2_key = COALESCE(?, recording_r2_key), provider_metadata_json = COALESCE(?, provider_metadata_json), updated_at = ? WHERE external_bot_id = ?"
    )
      .bind(
        status.status,
        status.recordingR2Key ?? null,
        status.providerMetadata ? JSON.stringify(status.providerMetadata) : null,
        new Date().toISOString(),
        status.externalBotId
      )
      .run();
    return status;
  }

  async handleVexaWebhook(payload: unknown): Promise<BotSessionStatus | null> {
    for (const provider of this.providers.values()) {
      const status = await provider.handleWebhook(payload);
      if (!status?.externalBotId) continue;
      await this.updateSessionByExternalBotId(status.externalBotId, status);
      return status;
    }
    return null;
  }

  async runDueScheduledBots(now = new Date()): Promise<{ attempted: number; started: number; failed: number }> {
    const cutoff = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
    const due = await this.env.DB.prepare(
      `SELECT bs.id, bs.platform, bs.meeting_url AS meetingUrl, bs.meeting_id AS meetingId, bs.consent_status AS consentStatus,
              m.owner_user_id AS ownerUserId
       FROM bot_sessions bs
       INNER JOIN meetings m ON m.id = bs.meeting_id
       WHERE bs.status = 'scheduled'
         AND bs.consent_status = 'confirmed'
         AND bs.external_bot_id IS NULL
         AND bs.join_time IS NOT NULL
         AND bs.join_time <= ?
       ORDER BY bs.join_time ASC
       LIMIT 10`
    )
      .bind(cutoff)
      .all<{
        id: string;
        platform: MeetingPlatform;
        meetingUrl: string;
        meetingId: string;
        consentStatus: string;
        ownerUserId: string;
      }>();
    let started = 0;
    let failed = 0;
    for (const session of due.results ?? []) {
      const provider = this.getProvider(session.platform);
      await this.env.DB.prepare("UPDATE bot_sessions SET status = 'joining', updated_at = ? WHERE id = ? AND status = 'scheduled'")
        .bind(new Date().toISOString(), session.id)
        .run();
      const status = await provider.joinNow(session.meetingUrl, session.id, {
        consentStatus: "confirmed",
        requestedByUserId: session.ownerUserId,
        botDisplayName: BOT_DISPLAY_NAME
      });
      await this.updateSession(session.id, status);
      if (status.status === "failed") failed += 1;
      else started += 1;
    }
    return { attempted: due.results?.length ?? 0, started, failed };
  }

  private getProvider(platform: MeetingPlatform): BotProvider {
    const provider = this.providers.get(platform);
    if (!provider) throw new ApiError(400, "unsupported_bot_platform", `No bot provider is configured for ${platform}.`);
    return provider;
  }

  private providerName(platform: MeetingPlatform): string {
    return this.getProvider(platform).constructor.name;
  }

  private async insertSession(
    botSessionId: string,
    meetingId: string,
    platform: MeetingPlatform,
    meetingUrl: string,
    status: string,
    consentStatus: string,
    joinTime: string | null = null
  ): Promise<void> {
    await this.env.DB.prepare(
      `INSERT INTO bot_sessions (
        id, meeting_id, platform, meeting_url, bot_display_name, status, join_time, consent_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        botSessionId,
        meetingId,
        platform,
        meetingUrl,
        BOT_DISPLAY_NAME,
        status,
        joinTime,
        consentStatus,
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();
  }

  private async updateSession(botSessionId: string, status: BotSessionStatus): Promise<void> {
    await this.env.DB.prepare(
      "UPDATE bot_sessions SET status = ?, external_bot_id = COALESCE(?, external_bot_id), provider_metadata_json = COALESCE(?, provider_metadata_json), error_message = ?, updated_at = ? WHERE id = ?"
    )
      .bind(
        status.status,
        status.externalBotId ?? null,
        status.providerMetadata ? JSON.stringify(status.providerMetadata) : null,
        status.errorMessage ?? null,
        new Date().toISOString(),
        botSessionId
      )
      .run();
  }

  private async updateSessionByExternalBotId(externalBotId: string, status: BotSessionStatus): Promise<void> {
    await this.env.DB.prepare(
      "UPDATE bot_sessions SET status = ?, recording_r2_key = COALESCE(?, recording_r2_key), provider_metadata_json = COALESCE(?, provider_metadata_json), error_message = ?, updated_at = ? WHERE external_bot_id = ?"
    )
      .bind(
        status.status,
        status.recordingR2Key ?? null,
        status.providerMetadata ? JSON.stringify(status.providerMetadata) : null,
        status.errorMessage ?? null,
        new Date().toISOString(),
        externalBotId
      )
      .run();
  }

  private async getSession(botSessionId: string): Promise<{
    platform: MeetingPlatform;
    status: BotSessionStatus["status"];
    externalBotId: string | null;
    recordingR2Key: string | null;
    errorMessage: string | null;
  }> {
    const session = await this.env.DB.prepare(
      `SELECT platform, status, external_bot_id AS externalBotId, recording_r2_key AS recordingR2Key, error_message AS errorMessage
       FROM bot_sessions WHERE id = ?`
    )
      .bind(botSessionId)
      .first<{
        platform: MeetingPlatform;
        status: BotSessionStatus["status"];
        externalBotId: string | null;
        recordingR2Key: string | null;
        errorMessage: string | null;
      }>();
    if (!session) throw new ApiError(404, "not_found", "Bot session not found.");
    return session;
  }
}

function shouldDeferToWorkerScheduler(startTime: string): boolean {
  const scheduledAt = Date.parse(startTime);
  if (Number.isNaN(scheduledAt)) return false;
  return scheduledAt > Date.now() + 2 * 60 * 1000;
}
