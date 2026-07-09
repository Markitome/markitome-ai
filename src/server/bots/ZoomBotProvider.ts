import type { BotJoinOptions, BotProvider, BotSessionStatus } from "./BotProvider";
import { assertConfirmedConsent } from "./BotProvider";

export class ZoomBotProvider implements BotProvider {
  readonly platform = "zoom" as const;

  async scheduleBotJoin(
    meetingUrl: string,
    meetingId: string,
    startTime: string,
    options: BotJoinOptions
  ): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.placeholderStatus(meetingId, "scheduled", { meetingUrl, startTime });
  }

  async joinNow(meetingUrl: string, meetingId: string, options: BotJoinOptions): Promise<BotSessionStatus> {
    assertConfirmedConsent(options);
    return this.placeholderStatus(meetingId, "joining", { meetingUrl });
  }

  async leave(botSessionId: string): Promise<BotSessionStatus> {
    return this.placeholderStatus(botSessionId, "left");
  }

  async getStatus(botSessionId: string): Promise<BotSessionStatus> {
    return this.placeholderStatus(botSessionId, "scheduled");
  }

  async handleWebhook(_payload: unknown): Promise<BotSessionStatus | null> {
    return null;
  }

  private placeholderStatus(
    botSessionId: string,
    status: BotSessionStatus["status"],
    _metadata?: Record<string, unknown>
  ): BotSessionStatus {
    return {
      botSessionId,
      platform: this.platform,
      status,
      errorMessage:
        "TODO: Production Zoom joining requires Zoom OAuth/app approval, Meeting SDK approval, recording disclosure compliance, and account-level/tenant-level permissions."
    };
  }
}
