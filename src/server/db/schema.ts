import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
};

const softDelete = {
  deletedAt: text("deleted_at")
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    approvalStatus: text("approval_status").notNull().default("pending"),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: text("approved_at"),
    lastLoginAt: text("last_login_at"),
    ...timestamps,
    ...softDelete
  },
  (table) => ({
    emailIdx: index("idx_users_email").on(table.email),
    createdAtIdx: index("idx_users_created_at").on(table.createdAt)
  })
);

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  ...timestamps
});

export const userRoles = sqliteTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    ...timestamps
  },
  (table) => ({
    userIdx: index("idx_user_roles_user_id").on(table.userId),
    uniqueUserRole: uniqueIndex("idx_user_roles_unique_user_role").on(table.userId, table.roleId)
  })
);

export const agendas = sqliteTable("agendas", {
  id: text("id").primaryKey(),
  meetingId: text("meeting_id"),
  content: text("content").notNull().default(""),
  ...timestamps
});

export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id),
    meetingDatetime: text("meeting_datetime").notNull(),
    platform: text("platform").notNull(),
    sourceType: text("source_type").notNull(),
    meetingUrl: text("meeting_url"),
    agendaId: text("agenda_id").references(() => agendas.id),
    processingStatus: text("processing_status").notNull().default("uploaded"),
    visibility: text("visibility").notNull().default("private"),
    ...timestamps,
    ...softDelete
  },
  (table) => ({
    ownerIdx: index("idx_meetings_owner_user_id").on(table.ownerUserId),
    createdAtIdx: index("idx_meetings_created_at").on(table.createdAt),
    processingIdx: index("idx_meetings_processing_status").on(table.processingStatus),
    sourceTypeIdx: index("idx_meetings_source_type").on(table.sourceType),
    platformIdx: index("idx_meetings_platform").on(table.platform)
  })
);

export const meetingParticipants = sqliteTable(
  "meeting_participants",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id),
    name: text("name"),
    email: text("email"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_meeting_participants_meeting_id").on(table.meetingId),
    userIdx: index("idx_meeting_participants_user_id").on(table.userId)
  })
);

export const manualNotes = sqliteTable(
  "manual_notes",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id),
    content: text("content").notNull().default(""),
    ...timestamps,
    ...softDelete
  },
  (table) => ({
    meetingIdx: index("idx_manual_notes_meeting_id").on(table.meetingId),
    userIdx: index("idx_manual_notes_user_id").on(table.userId)
  })
);

export const recordings = sqliteTable(
  "recordings",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").notNull().references(() => users.id),
    sourceType: text("source_type").notNull(),
    platform: text("platform").notNull(),
    r2Bucket: text("r2_bucket").notNull(),
    r2Key: text("r2_key").notNull(),
    originalFilename: text("original_filename"),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    durationSeconds: integer("duration_seconds"),
    consentStatus: text("consent_status").notNull(),
    consentConfirmedByUserId: text("consent_confirmed_by_user_id").references(() => users.id),
    consentConfirmedAt: text("consent_confirmed_at"),
    processingStatus: text("processing_status").notNull().default("uploaded"),
    errorMessage: text("error_message"),
    ...timestamps,
    ...softDelete
  },
  (table) => ({
    meetingIdx: index("idx_recordings_meeting_id").on(table.meetingId),
    ownerIdx: index("idx_recordings_owner_user_id").on(table.ownerUserId),
    createdAtIdx: index("idx_recordings_created_at").on(table.createdAt),
    processingIdx: index("idx_recordings_processing_status").on(table.processingStatus),
    sourceTypeIdx: index("idx_recordings_source_type").on(table.sourceType),
    platformIdx: index("idx_recordings_platform").on(table.platform)
  })
);

export const transcripts = sqliteTable(
  "transcripts",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    recordingId: text("recording_id").references(() => recordings.id, { onDelete: "set null" }),
    r2Bucket: text("r2_bucket").notNull(),
    r2Key: text("r2_key").notNull(),
    language: text("language"),
    durationSeconds: integer("duration_seconds"),
    wordCount: integer("word_count"),
    transcriptPreview: text("transcript_preview"),
    transcriptionProvider: text("transcription_provider"),
    confidenceScore: real("confidence_score"),
    processingStatus: text("processing_status").notNull().default("uploaded"),
    errorMessage: text("error_message"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_transcripts_meeting_id").on(table.meetingId),
    recordingIdx: index("idx_transcripts_recording_id").on(table.recordingId),
    processingIdx: index("idx_transcripts_processing_status").on(table.processingStatus)
  })
);

export const aiNotes = sqliteTable(
  "ai_notes",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").references(() => transcripts.id, { onDelete: "set null" }),
    modelName: text("model_name").notNull(),
    rawResponseJson: text("raw_response_json"),
    parsedNotesJson: text("parsed_notes_json"),
    renderedMarkdown: text("rendered_markdown"),
    tokenUsageJson: text("token_usage_json"),
    generationStatus: text("generation_status").notNull().default("pending"),
    errorMessage: text("error_message"),
    generatedAt: text("generated_at"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_ai_notes_meeting_id").on(table.meetingId)
  })
);

export const actionItems = sqliteTable(
  "action_items",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    aiNoteId: text("ai_note_id").references(() => aiNotes.id, { onDelete: "set null" }),
    task: text("task").notNull(),
    assigneeText: text("assignee_text"),
    assigneeUserId: text("assignee_user_id").references(() => users.id),
    dueDate: text("due_date"),
    priority: text("priority").notNull().default("medium"),
    status: text("status").notNull().default("open"),
    sourceQuote: text("source_quote"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_action_items_meeting_id").on(table.meetingId),
    assigneeIdx: index("idx_action_items_assignee_user_id").on(table.assigneeUserId)
  })
);

export const decisions = sqliteTable(
  "decisions",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    aiNoteId: text("ai_note_id").references(() => aiNotes.id, { onDelete: "set null" }),
    decision: text("decision").notNull(),
    ownerText: text("owner_text"),
    ownerUserId: text("owner_user_id").references(() => users.id),
    sourceQuote: text("source_quote"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_decisions_meeting_id").on(table.meetingId)
  })
);

export const topics = sqliteTable(
  "topics",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    aiNoteId: text("ai_note_id").references(() => aiNotes.id, { onDelete: "set null" }),
    topic: text("topic").notNull(),
    summary: text("summary").notNull(),
    keyPointsJson: text("key_points_json").notNull().default("[]"),
    openQuestionsJson: text("open_questions_json").notNull().default("[]"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_topics_meeting_id").on(table.meetingId)
  })
);

export const botSessions = sqliteTable(
  "bot_sessions",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    meetingUrl: text("meeting_url").notNull(),
    botDisplayName: text("bot_display_name").notNull(),
    status: text("status").notNull(),
    joinTime: text("join_time"),
    leaveTime: text("leave_time"),
    recordingR2Key: text("recording_r2_key"),
    consentStatus: text("consent_status").notNull(),
    errorMessage: text("error_message"),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_bot_sessions_meeting_id").on(table.meetingId),
    platformIdx: index("idx_bot_sessions_platform").on(table.platform),
    createdAtIdx: index("idx_bot_sessions_created_at").on(table.createdAt)
  })
);

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("disabled"),
  configJson: text("config_json").notNull().default("{}"),
  ...timestamps,
  ...softDelete
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    action: text("action").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    actorIdx: index("idx_audit_logs_actor_user_id").on(table.actorUserId),
    createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt),
    targetIdx: index("idx_audit_logs_target").on(table.targetType, table.targetId)
  })
);

export const uploadSessions = sqliteTable(
  "upload_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    r2Bucket: text("r2_bucket").notNull(),
    r2Key: text("r2_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSize: integer("file_size").notNull(),
    sourceType: text("source_type").notNull(),
    platform: text("platform").notNull(),
    metadataJson: text("metadata_json").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    expiresAt: text("expires_at").notNull(),
    ...timestamps
  },
  (table) => ({
    userIdx: index("idx_upload_sessions_user_id").on(table.userId),
    createdAtIdx: index("idx_upload_sessions_created_at").on(table.createdAt)
  })
);

export const sharePermissions = sqliteTable(
  "share_permissions",
  {
    id: text("id").primaryKey(),
    meetingId: text("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    sharedWithUserId: text("shared_with_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    permissionLevel: text("permission_level").notNull().default("view"),
    createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
    ...timestamps
  },
  (table) => ({
    meetingIdx: index("idx_share_permissions_meeting_id").on(table.meetingId),
    sharedWithIdx: index("idx_share_permissions_shared_with_user_id").on(table.sharedWithUserId),
    uniqueShare: uniqueIndex("idx_share_permissions_unique_share").on(table.meetingId, table.sharedWithUserId)
  })
);

export const processingJobs = sqliteTable(
  "processing_jobs",
  {
    id: text("id").primaryKey(),
    jobType: text("job_type").notNull(),
    meetingId: text("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
    recordingId: text("recording_id").references(() => recordings.id, { onDelete: "set null" }),
    transcriptId: text("transcript_id").references(() => transcripts.id, { onDelete: "set null" }),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    errorMessage: text("error_message"),
    payloadJson: text("payload_json").notNull().default("{}"),
    ...timestamps,
    startedAt: text("started_at"),
    completedAt: text("completed_at")
  },
  (table) => ({
    meetingIdx: index("idx_processing_jobs_meeting_id").on(table.meetingId),
    recordingIdx: index("idx_processing_jobs_recording_id").on(table.recordingId),
    statusIdx: index("idx_processing_jobs_status").on(table.status),
    createdAtIdx: index("idx_processing_jobs_created_at").on(table.createdAt)
  })
);

export const apiUsageLogs = sqliteTable(
  "api_usage_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    provider: text("provider").notNull(),
    model: text("model"),
    operation: text("operation").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costEstimateUsd: real("cost_estimate_usd"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
  },
  (table) => ({
    userIdx: index("idx_api_usage_logs_user_id").on(table.userId),
    createdAtIdx: index("idx_api_usage_logs_created_at").on(table.createdAt)
  })
);

export const systemSettings = sqliteTable("system_settings", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueJson: text("value_json").notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => users.id),
  ...timestamps
});
