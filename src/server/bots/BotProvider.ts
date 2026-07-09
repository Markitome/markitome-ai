import type { ConsentStatus, MeetingPlatform } from "../../types";

export const BOT_DISPLAY_NAME = "Markitome AI Notetaker - Recording";

export interface BotJoinOptions {
  botDisplayName?: string;
  consentStatus: ConsentStatus;
  requestedByUserId: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface BotSessionStatus {
  botSessionId: string;
  platform: MeetingPlatform;
  status: "scheduled" | "joining" | "recording" | "leaving" | "left" | "failed";
  recordingR2Key?: string | null;
  errorMessage?: string | null;
}

export interface BotProvider {
  readonly platform: MeetingPlatform;
  scheduleBotJoin(
    meetingUrl: string,
    meetingId: string,
    startTime: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus>;
  joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus>;
  leave(botSessionId: string): Promise<BotSessionStatus>;
  getStatus(botSessionId: string): Promise<BotSessionStatus>;
  handleWebhook(payload: unknown): Promise<BotSessionStatus | null>;
}

export function assertConfirmedConsent(options: BotJoinOptions): void {
  if (options.consentStatus !== "confirmed") {
    throw new Error("Bot recording cannot start unless consent_status is confirmed.");
  }
}
