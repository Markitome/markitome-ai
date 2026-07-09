export type RoleName = "super_admin" | "admin" | "employee";

export type ConsentStatus = "not_required" | "pending" | "confirmed" | "rejected" | "unknown";

export type ProcessingStatus =
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "generating_notes"
  | "completed"
  | "failed";

export type MeetingPlatform =
  | "google_meet"
  | "zoom"
  | "microsoft_teams"
  | "screen_recording"
  | "phone_call_upload"
  | "video_upload"
  | "audio_upload"
  | "other";

export interface Env {
  DB: D1Database;
  RECORDINGS: R2Bucket;
  TRANSCRIPTS: R2Bucket;
  TRANSCRIPTION_QUEUE: Queue;
  AI_NOTES_QUEUE: Queue;
  MEETING_SEARCH?: VectorizeIndex;
  APP_ENV: string;
  APP_NAME: string;
  APP_DOMAIN: string;
  ALLOWED_EMAIL_DOMAIN: string;
  CLAUDE_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT_ID?: string;
  ZOOM_CLIENT_ID?: string;
  ZOOM_CLIENT_SECRET?: string;
  ZOOM_ACCOUNT_ID?: string;
  WEBHOOK_SECRET?: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  approvalStatus: string;
  roles: RoleName[];
}

export type AppVariables = {
  user: AppUser;
};

export interface StructuredError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
