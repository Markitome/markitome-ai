import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { AppVariables, Env, MeetingPlatform } from "../../types";
import { BotSessionService } from "../bots/BotSessionService";
import { requireAuth, requireRoles, assertCanAccessMeeting, isAdmin } from "../auth/rbac";
import { ApiError } from "../http/errors";
import { parseJson, parseQuery } from "../http/validation";
import { writeAuditLog } from "../services/AuditLogService";
import { base64UrlDecode, base64UrlEncode, hmacSha256, id, sha256, timingSafeEqual } from "../utils/crypto";
import { enqueueAiNotes, enqueueTranscription } from "../queues/jobs";

export const apiRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();
type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

const googleCalendarStateCookie = "mt_google_calendar_state";
const googleCalendarScope = "https://www.googleapis.com/auth/calendar.readonly";

const consentStatusSchema = z.enum(["not_required", "pending", "confirmed", "rejected", "unknown"]);
const sourceTypeSchema = z.enum([
  "google_meet",
  "zoom",
  "microsoft_teams",
  "screen_recording",
  "phone_call_upload",
  "video_upload",
  "audio_upload",
  "other"
]);
const platformSchema = sourceTypeSchema;
const participantSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional()
});

const meetingInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  meeting_datetime: z.string().min(1),
  platform: platformSchema,
  source_type: sourceTypeSchema,
  meeting_url: z.string().url().optional().nullable(),
  agenda: z.string().optional().default(""),
  manual_notes: z.string().optional().default(""),
  participants: z.array(participantSchema).default([]),
  visibility: z.enum(["private", "shared", "company"]).default("private")
});

const uploadUrlSchema = z.object({
  original_filename: z.string().min(1),
  mime_type: z.string().min(1),
  file_size: z.number().int().positive(),
  source_type: sourceTypeSchema,
  platform: platformSchema,
  title: z.string().min(1),
  meeting_datetime: z.string().min(1),
  participants: z.array(participantSchema).default([]),
  agenda: z.string().optional().default(""),
  manual_notes: z.string().optional().default(""),
  meeting_url: z.string().url().optional().nullable(),
  consent_status: consentStatusSchema,
  historical_import_by_admin: z.boolean().optional().default(false)
});

apiRoutes.use("*", requireAuth);

apiRoutes.get("/users", requireRoles(["admin", "super_admin"]), async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.approval_status AS approvalStatus, u.last_login_at AS lastLoginAt,
            GROUP_CONCAT(r.name) AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.deleted_at IS NULL
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  ).all();
  return c.json({ users: users.results });
});

apiRoutes.get("/users/:id", requireRoles(["admin", "super_admin"]), async (c) => {
  const user = await c.env.DB.prepare("SELECT id, email, name, approval_status AS approvalStatus FROM users WHERE id = ?")
    .bind(c.req.param("id"))
    .first();
  if (!user) throw new ApiError(404, "not_found", "User not found.");
  return c.json({ user });
});

apiRoutes.patch("/users/:id", requireRoles(["admin", "super_admin"]), async (c) => {
  const input = await parseJson(
    c,
    z.object({
      approval_status: z.enum(["pending", "approved", "rejected"]).optional(),
      name: z.string().optional()
    })
  );
  await c.env.DB.prepare(
    `UPDATE users
     SET approval_status = COALESCE(?, approval_status),
         approved_by_user_id = CASE WHEN ? = 'approved' THEN ? ELSE approved_by_user_id END,
         approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
         name = COALESCE(?, name),
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      input.approval_status ?? null,
      input.approval_status ?? null,
      c.get("user").id,
      input.approval_status ?? null,
      new Date().toISOString(),
      input.name ?? null,
      new Date().toISOString(),
      c.req.param("id")
    )
    .run();
  await writeAuditLog(c, { action: "user_approval", targetType: "user", targetId: c.req.param("id"), metadata: input });
  return c.json({ ok: true });
});

apiRoutes.post("/users/:id/roles", requireRoles(["super_admin"]), async (c) => {
  const input = await parseJson(c, z.object({ role: z.enum(["super_admin", "admin", "employee"]) }));
  const role = await c.env.DB.prepare("SELECT id FROM roles WHERE name = ?").bind(input.role).first<{ id: string }>();
  if (!role) throw new ApiError(400, "invalid_role", "Role does not exist.");
  await c.env.DB.prepare("INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id("user_role"), c.req.param("id"), role.id, new Date().toISOString(), new Date().toISOString())
    .run();
  await writeAuditLog(c, { action: "role_change", targetType: "user", targetId: c.req.param("id"), metadata: input });
  return c.json({ ok: true });
});

apiRoutes.delete("/users/:id/roles/:roleId", requireRoles(["super_admin"]), async (c) => {
  await c.env.DB.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?")
    .bind(c.req.param("id"), c.req.param("roleId"))
    .run();
  await writeAuditLog(c, { action: "role_change", targetType: "user", targetId: c.req.param("id") });
  return c.json({ ok: true });
});

apiRoutes.get("/meetings", async (c) => {
  const user = c.get("user");
  const query = parseQuery(
    c,
    z.object({
      employee: z.string().optional(),
      platform: sourceTypeSchema.optional(),
      source_type: sourceTypeSchema.optional(),
      processing_status: z.string().optional(),
      keyword: z.string().optional()
    })
  );
  const filters: string[] = ["m.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (!isAdmin(user)) {
    filters.push("(m.owner_user_id = ? OR m.id IN (SELECT meeting_id FROM share_permissions WHERE shared_with_user_id = ?))");
    binds.push(user.id, user.id);
  }
  if (query.employee && isAdmin(user)) {
    filters.push("m.owner_user_id = ?");
    binds.push(query.employee);
  }
  if (query.platform) {
    filters.push("m.platform = ?");
    binds.push(query.platform);
  }
  if (query.source_type) {
    filters.push("m.source_type = ?");
    binds.push(query.source_type);
  }
  if (query.processing_status) {
    filters.push("m.processing_status = ?");
    binds.push(query.processing_status);
  }
  if (query.keyword) {
    filters.push("(m.title LIKE ? OR m.description LIKE ?)");
    binds.push(`%${query.keyword}%`, `%${query.keyword}%`);
  }
  const meetings = await c.env.DB.prepare(
    `SELECT m.*, u.email AS owner_email
     FROM meetings m
     INNER JOIN users u ON u.id = m.owner_user_id
     WHERE ${filters.join(" AND ")}
     ORDER BY m.meeting_datetime DESC
     LIMIT 100`
  )
    .bind(...binds)
    .all();
  return c.json({ meetings: meetings.results });
});

apiRoutes.post("/meetings", async (c) => {
  const input = await parseJson(c, meetingInputSchema);
  const meeting = await createMeeting(c, input);
  return c.json({ meeting }, 201);
});

apiRoutes.get("/meetings/:id", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const meeting = await getMeetingBundle(c.env, meetingId);
  await writeAuditLog(c, { action: "view_meeting", targetType: "meeting", targetId: meetingId });
  return c.json({ meeting });
});

apiRoutes.patch("/meetings/:id", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const input = await parseJson(
    c,
    z.object({
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      agenda: z.string().optional(),
      manual_notes: z.string().optional()
    })
  );
  await c.env.DB.prepare(
    "UPDATE meetings SET title = COALESCE(?, title), description = COALESCE(?, description), updated_at = ? WHERE id = ?"
  )
    .bind(input.title ?? null, input.description ?? null, new Date().toISOString(), meetingId)
    .run();
  if (input.agenda !== undefined) {
    await c.env.DB.prepare(
      "UPDATE agendas SET content = ?, updated_at = ? WHERE id = (SELECT agenda_id FROM meetings WHERE id = ?)"
    )
      .bind(input.agenda, new Date().toISOString(), meetingId)
      .run();
  }
  if (input.manual_notes !== undefined) {
    await c.env.DB.prepare(
      "UPDATE manual_notes SET content = ?, updated_at = ? WHERE meeting_id = ? AND user_id = ?"
    )
      .bind(input.manual_notes, new Date().toISOString(), meetingId, c.get("user").id)
      .run();
  }
  return c.json({ ok: true });
});

apiRoutes.delete("/meetings/:id", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  await c.env.DB.prepare("UPDATE meetings SET deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), meetingId)
    .run();
  await writeAuditLog(c, { action: "delete_meeting", targetType: "meeting", targetId: meetingId });
  return c.json({ ok: true });
});

apiRoutes.post("/meetings/:id/share", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const input = await parseJson(
    c,
    z.object({
      shared_with_user_id: z.string().min(1),
      permission_level: z.enum(["view", "edit"]).default("view")
    })
  );
  await c.env.DB.prepare(
    `INSERT INTO share_permissions (id, meeting_id, shared_with_user_id, permission_level, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(meeting_id, shared_with_user_id) DO UPDATE SET permission_level = excluded.permission_level, updated_at = excluded.updated_at`
  )
    .bind(id("share"), meetingId, input.shared_with_user_id, input.permission_level, c.get("user").id, new Date().toISOString(), new Date().toISOString())
    .run();
  await writeAuditLog(c, { action: "share_meeting", targetType: "meeting", targetId: meetingId, metadata: input });
  return c.json({ ok: true });
});

apiRoutes.get("/meetings/:id/audit-log", requireRoles(["admin", "super_admin"]), async (c) => {
  const meetingId = c.req.param("id");
  const logs = await c.env.DB.prepare("SELECT * FROM audit_logs WHERE target_id = ? ORDER BY created_at DESC LIMIT 100")
    .bind(meetingId)
    .all();
  return c.json({ audit_logs: logs.results });
});

apiRoutes.post("/recordings/upload-url", async (c) => {
  const input = await parseJson(c, uploadUrlSchema);
  const user = c.get("user");
  if (input.consent_status !== "confirmed" && !(input.historical_import_by_admin && isAdmin(user))) {
    throw new ApiError(400, "consent_required", "Consent confirmation is required before uploading a recording.");
  }
  validateUploadFile(input.original_filename, input.file_size);
  const uploadSessionId = id("upload");
  const token = crypto.randomUUID();
  const extension = input.original_filename.split(".").pop()?.toLowerCase() ?? "bin";
  const r2Key = `recordings/${user.id}/${uploadSessionId}.${extension}`;
  await c.env.DB.prepare(
    `INSERT INTO upload_sessions (
      id, user_id, r2_bucket, r2_key, original_filename, mime_type, file_size, source_type, platform,
      metadata_json, token_hash, status, expires_at, created_at, updated_at
    ) VALUES (?, ?, 'RECORDINGS', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(
      uploadSessionId,
      user.id,
      r2Key,
      input.original_filename,
      input.mime_type,
      input.file_size,
      input.source_type,
      input.platform,
      JSON.stringify(input),
      await sha256(token),
      new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();
  return c.json({
    upload_session_id: uploadSessionId,
    upload_url: `/api/recordings/upload/${uploadSessionId}?token=${encodeURIComponent(token)}`,
    method: "PUT",
    r2_key: r2Key
  });
});

apiRoutes.put("/recordings/upload/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const token = c.req.query("token");
  const session = await getUploadSession(c.env, sessionId);
  if (!token || (await sha256(token)) !== session.tokenHash) throw new ApiError(403, "invalid_upload_token", "Upload token is invalid.");
  if (new Date(session.expiresAt).getTime() < Date.now()) throw new ApiError(410, "upload_expired", "Upload URL has expired.");
  await c.env.RECORDINGS.put(session.r2Key, c.req.raw.body, {
    httpMetadata: { contentType: session.mimeType },
    customMetadata: {
      originalFilename: session.originalFilename,
      uploadedByUserId: c.get("user").id
    }
  });
  await c.env.DB.prepare("UPDATE upload_sessions SET status = 'uploaded', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), sessionId)
    .run();
  return c.json({ ok: true, upload_session_id: sessionId });
});

apiRoutes.post("/recordings/complete-upload", async (c) => {
  const input = await parseJson(c, z.object({ upload_session_id: z.string().min(1) }));
  const session = await getUploadSession(c.env, input.upload_session_id);
  if (session.status !== "uploaded") throw new ApiError(400, "upload_incomplete", "Upload session is not uploaded.");
  const metadata = JSON.parse(session.metadataJson) as z.infer<typeof uploadUrlSchema>;
  const meeting = await createMeeting(c, {
    title: metadata.title,
    description: null,
    meeting_datetime: metadata.meeting_datetime,
    platform: metadata.platform,
    source_type: metadata.source_type,
    meeting_url: metadata.meeting_url,
    agenda: metadata.agenda,
    manual_notes: metadata.manual_notes,
    participants: metadata.participants,
    visibility: "private"
  });
  const recordingId = id("recording");
  await c.env.DB.prepare(
    `INSERT INTO recordings (
      id, meeting_id, owner_user_id, source_type, platform, r2_bucket, r2_key, original_filename,
      mime_type, file_size, consent_status, consent_confirmed_by_user_id, consent_confirmed_at,
      processing_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'RECORDINGS', ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?)`
  )
    .bind(
      recordingId,
      meeting.id,
      c.get("user").id,
      metadata.source_type,
      metadata.platform,
      session.r2Key,
      session.originalFilename,
      session.mimeType,
      session.fileSize,
      metadata.consent_status,
      metadata.consent_status === "confirmed" ? c.get("user").id : null,
      metadata.consent_status === "confirmed" ? new Date().toISOString() : null,
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();
  await c.env.DB.prepare("UPDATE upload_sessions SET status = 'completed', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), input.upload_session_id)
    .run();
  await writeAuditLog(c, { action: "consent_confirmation", targetType: "recording", targetId: recordingId });
  await enqueueTranscription(c.env, recordingId, meeting.id);
  return c.json({ meeting, recording_id: recordingId, processing_status: "uploaded" }, 201);
});

apiRoutes.get("/recordings/:id", async (c) => {
  const recording = await c.env.DB.prepare("SELECT * FROM recordings WHERE id = ? AND deleted_at IS NULL")
    .bind(c.req.param("id"))
    .first<{ meeting_id: string }>();
  if (!recording) throw new ApiError(404, "not_found", "Recording not found.");
  await assertCanAccessMeeting(c, recording.meeting_id);
  await writeAuditLog(c, { action: "view_recording", targetType: "recording", targetId: c.req.param("id") });
  return c.json({ recording });
});

apiRoutes.get("/recordings/:id/download-url", async (c) => {
  const recording = await c.env.DB.prepare("SELECT id, meeting_id AS meetingId FROM recordings WHERE id = ? AND deleted_at IS NULL")
    .bind(c.req.param("id"))
    .first<{ id: string; meetingId: string }>();
  if (!recording) throw new ApiError(404, "not_found", "Recording not found.");
  await assertCanAccessMeeting(c, recording.meetingId);
  const token = await createDownloadToken(c.env, recording.id);
  return c.json({
    download_url: `/api/recordings/${recording.id}/file?token=${encodeURIComponent(token)}`,
    expires_in_seconds: 300
  });
});

apiRoutes.get("/recordings/:id/file", async (c) => {
  const token = c.req.query("token");
  if (!(await verifyDownloadToken(c.env, c.req.param("id"), token))) {
    throw new ApiError(403, "invalid_download_token", "Download token is invalid or expired.");
  }
  const recording = await c.env.DB.prepare("SELECT meeting_id AS meetingId, r2_key AS r2Key, mime_type AS mimeType FROM recordings WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ meetingId: string; r2Key: string; mimeType: string | null }>();
  if (!recording) throw new ApiError(404, "not_found", "Recording not found.");
  await assertCanAccessMeeting(c, recording.meetingId);
  const object = await c.env.RECORDINGS.get(recording.r2Key);
  if (!object) throw new ApiError(404, "not_found", "Recording object not found.");
  await writeAuditLog(c, { action: "download_recording", targetType: "recording", targetId: c.req.param("id") });
  return new Response(object.body, { headers: { "content-type": recording.mimeType ?? "application/octet-stream" } });
});

apiRoutes.delete("/recordings/:id", async (c) => {
  const recording = await c.env.DB.prepare("SELECT meeting_id AS meetingId, owner_user_id AS ownerUserId FROM recordings WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ meetingId: string; ownerUserId: string }>();
  if (!recording) throw new ApiError(404, "not_found", "Recording not found.");
  if (!isAdmin(c.get("user")) && recording.ownerUserId !== c.get("user").id) throw new ApiError(403, "forbidden", "Cannot delete this recording.");
  await c.env.DB.prepare("UPDATE recordings SET deleted_at = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), c.req.param("id"))
    .run();
  await writeAuditLog(c, { action: "delete_recording", targetType: "recording", targetId: c.req.param("id") });
  return c.json({ ok: true });
});

apiRoutes.post("/recordings/:id/retry-processing", async (c) => {
  const recording = await c.env.DB.prepare("SELECT meeting_id AS meetingId, owner_user_id AS ownerUserId FROM recordings WHERE id = ?")
    .bind(c.req.param("id"))
    .first<{ meetingId: string; ownerUserId: string }>();
  if (!recording) throw new ApiError(404, "not_found", "Recording not found.");
  if (!isAdmin(c.get("user")) && recording.ownerUserId !== c.get("user").id) throw new ApiError(403, "forbidden", "Cannot retry this recording.");
  await enqueueTranscription(c.env, c.req.param("id"), recording.meetingId);
  await writeAuditLog(c, { action: "retry_processing", targetType: "recording", targetId: c.req.param("id") });
  return c.json({ ok: true });
});

apiRoutes.get("/meetings/:id/transcript", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const transcript = await c.env.DB.prepare("SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(meetingId)
    .first<{ r2_key: string }>();
  if (!transcript) throw new ApiError(404, "not_found", "Transcript not found.");
  await writeAuditLog(c, { action: "view_transcript", targetType: "meeting", targetId: meetingId });
  return c.json({ transcript });
});

apiRoutes.post("/meetings/:id/transcript/manual-upload", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const input = await parseJson(c, z.object({ transcript_text: z.string().min(1), language: z.string().optional() }));
  const transcriptId = id("transcript");
  const r2Key = `transcripts/${meetingId}/${transcriptId}.txt`;
  await c.env.TRANSCRIPTS.put(r2Key, input.transcript_text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
  await c.env.DB.prepare(
    `INSERT INTO transcripts (
      id, meeting_id, r2_bucket, r2_key, language, word_count, transcript_preview, transcription_provider,
      processing_status, created_at, updated_at
    ) VALUES (?, ?, 'TRANSCRIPTS', ?, ?, ?, ?, 'manual_transcript', 'completed', ?, ?)`
  )
    .bind(
      transcriptId,
      meetingId,
      r2Key,
      input.language ?? null,
      input.transcript_text.trim().split(/\s+/).length,
      input.transcript_text.slice(0, 1000),
      new Date().toISOString(),
      new Date().toISOString()
    )
    .run();
  await enqueueAiNotes(c.env, meetingId, transcriptId);
  return c.json({ transcript_id: transcriptId, processing_status: "generating_notes" }, 201);
});

apiRoutes.get("/meetings/:id/ai-notes", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const notes = await c.env.DB.prepare("SELECT * FROM ai_notes WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(meetingId)
    .first();
  return c.json({ ai_notes: notes });
});

apiRoutes.post("/meetings/:id/regenerate-ai-notes", async (c) => {
  const meetingId = c.req.param("id");
  await assertCanAccessMeeting(c, meetingId);
  const transcript = await c.env.DB.prepare("SELECT id FROM transcripts WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(meetingId)
    .first<{ id: string }>();
  if (!transcript) throw new ApiError(400, "missing_transcript", "A transcript is required before AI notes can be regenerated.");
  await enqueueAiNotes(c.env, meetingId, transcript.id);
  await writeAuditLog(c, { action: "regenerate_ai_notes", targetType: "meeting", targetId: meetingId });
  return c.json({ ok: true });
});

apiRoutes.get("/meetings/:id/export/markdown", async (c) => exportNotes(c, "markdown"));
apiRoutes.get("/meetings/:id/export/json", async (c) => exportNotes(c, "json"));
apiRoutes.get("/meetings/:id/export/transcript", async (c) => exportTranscript(c));
apiRoutes.get("/meetings/:id/export/pdf-ready-html", async (c) => exportNotes(c, "pdf_ready_html"));
apiRoutes.get("/meetings/:id/export/google-docs-text", async (c) => exportNotes(c, "google_docs_text"));

apiRoutes.post("/bots/schedule", async (c) => {
  const input = await parseJson(
    c,
    z.object({
      platform: z.enum(["google_meet", "zoom", "microsoft_teams"]),
      meeting_url: z.string().url(),
      meeting_id: z.string(),
      start_time: z.string(),
      consent_status: consentStatusSchema
    })
  );
  await assertCanAccessMeeting(c, input.meeting_id);
  const result = await new BotSessionService(c.env).schedule({
    platform: input.platform,
    meetingUrl: input.meeting_url,
    meetingId: input.meeting_id,
    startTime: input.start_time,
    consentStatus: input.consent_status,
    requestedByUserId: c.get("user").id
  });
  await writeAuditLog(c, { action: "bot_join", targetType: "meeting", targetId: input.meeting_id });
  return c.json({ bot_session: result }, 201);
});

apiRoutes.post("/bots/join-now", async (c) => {
  const input = await parseJson(
    c,
    z.object({
      platform: z.enum(["google_meet", "zoom", "microsoft_teams"]),
      meeting_url: z.string().url(),
      meeting_id: z.string(),
      consent_status: consentStatusSchema
    })
  );
  await assertCanAccessMeeting(c, input.meeting_id);
  const result = await new BotSessionService(c.env).joinNow({
    platform: input.platform,
    meetingUrl: input.meeting_url,
    meetingId: input.meeting_id,
    consentStatus: input.consent_status,
    requestedByUserId: c.get("user").id
  });
  await writeAuditLog(c, { action: "bot_join", targetType: "meeting", targetId: input.meeting_id });
  return c.json({ bot_session: result }, 201);
});

apiRoutes.post("/bots/:id/leave", async (c) => {
  const result = await new BotSessionService(c.env).leave(c.req.param("id"));
  await writeAuditLog(c, { action: "bot_leave", targetType: "bot_session", targetId: c.req.param("id") });
  return c.json({ bot_session: result });
});

apiRoutes.get("/bots/:id/status", async (c) => {
  const result = await new BotSessionService(c.env).getStatus(c.req.param("id"));
  return c.json({ bot_session: result });
});

apiRoutes.post("/bots/webhook/:platform", async (c) => {
  if (c.env.WEBHOOK_SECRET && c.req.header("x-webhook-secret") !== c.env.WEBHOOK_SECRET) {
    throw new ApiError(403, "invalid_webhook_secret", "Webhook secret is invalid.");
  }
  const result = await new BotSessionService(c.env).handleWebhook(c.req.param("platform") as MeetingPlatform, await c.req.json());
  return c.json({ ok: true, bot_session: result });
});

apiRoutes.get("/integrations/google-calendar/connect", async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) return c.redirect("/setup-required?missing=GOOGLE_CLIENT_ID");
  const state = crypto.randomUUID();
  setCookie(c, googleCalendarStateCookie, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 600
  });
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: googleCalendarScope,
    state,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent"
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

apiRoutes.get("/integrations/google-calendar/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, googleCalendarStateCookie);
  deleteCookie(c, googleCalendarStateCookie, { path: "/" });
  if (!code || !state || state !== expectedState) throw new ApiError(400, "invalid_oauth_state", "Google Calendar OAuth state could not be verified.");
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) return c.redirect("/setup-required?missing=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET");

  const origin = new URL(c.req.url).origin;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/integrations/google-calendar/callback`,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) throw new ApiError(401, "calendar_oauth_exchange_failed", "Google Calendar OAuth token exchange failed.");
  const tokenJson = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!tokenJson.access_token) throw new ApiError(401, "calendar_missing_access_token", "Google did not return a Calendar access token.");

  const user = c.get("user");
  const existing = await getGoogleCalendarIntegration(c.env, user.id);
  const existingConfig = existing ? safeParseIntegrationConfig(existing.config_json) : {};
  const config = {
    ...existingConfig,
    user_id: user.id,
    email: user.email,
    scope: tokenJson.scope ?? googleCalendarScope,
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token ?? existingConfig.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokenJson.expires_in ?? 3600) * 1000).toISOString(),
    connected_at: existingConfig.connected_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  await c.env.DB.prepare(
    `INSERT INTO integrations (id, provider, status, config_json, created_at, updated_at)
     VALUES (?, 'google_calendar', 'enabled', ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = 'enabled', config_json = excluded.config_json, updated_at = excluded.updated_at`
  )
    .bind(googleCalendarIntegrationId(user.id), JSON.stringify(config), new Date().toISOString(), new Date().toISOString())
    .run();
  await writeAuditLog(c, { action: "integration_change", targetType: "integration", targetId: "google_calendar", metadata: { connected: true } });
  return c.redirect("/integrations?connected=google_calendar");
});

apiRoutes.get("/integrations/google-calendar/status", async (c) => {
  const integration = await getGoogleCalendarIntegration(c.env, c.get("user").id);
  return c.json({ google_calendar: sanitizeGoogleCalendarIntegration(integration) });
});

apiRoutes.get("/integrations/google-calendar/events", async (c) => {
  const query = parseQuery(
    c,
    z.object({
      days: z.coerce.number().int().min(1).max(30).optional().default(7)
    })
  );
  const events = await listGoogleCalendarEvents(c, query.days);
  return c.json({ events });
});

apiRoutes.post("/integrations/google-calendar/import-upcoming", async (c) => {
  const input = await parseJson(
    c,
    z.object({
      days: z.number().int().min(1).max(30).optional().default(7)
    })
  );
  const events = await listGoogleCalendarEvents(c, input.days);
  const imported: Array<{ id: string; title: string; calendar_event_id: string }> = [];
  for (const event of events) {
    if (!event.id || !event.summary || !event.start) continue;
    const meetingUrl = event.hangoutLink ?? event.htmlLink ?? null;
    const existing = await c.env.DB.prepare(
      "SELECT id FROM meetings WHERE owner_user_id = ? AND meeting_url = ? AND deleted_at IS NULL"
    )
      .bind(c.get("user").id, meetingUrl)
      .first<{ id: string }>();
    if (existing) continue;
    const meeting = await createMeeting(c, {
      title: event.summary,
      description: event.description ?? null,
      meeting_datetime: event.start,
      platform: "google_meet",
      source_type: "google_meet",
      meeting_url: meetingUrl,
      agenda: event.description ?? "",
      manual_notes: "",
      participants: event.attendees.map((attendee) => ({ email: attendee.email, name: attendee.name })),
      visibility: "private"
    });
    imported.push({ id: meeting.id, title: meeting.title, calendar_event_id: event.id });
  }
  await writeAuditLog(c, { action: "integration_change", targetType: "integration", targetId: "google_calendar", metadata: { imported: imported.length } });
  return c.json({ imported, scanned: events.length });
});

apiRoutes.get("/admin/dashboard", requireRoles(["admin", "super_admin"]), async (c) => {
  const [meetings, recordings, failures] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM meetings WHERE deleted_at IS NULL").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS count, SUM(duration_seconds) AS durationSeconds FROM recordings WHERE deleted_at IS NULL").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM processing_jobs WHERE status = 'failed'").first()
  ]);
  return c.json({
    total_meetings: meetings,
    recordings,
    failed_processing_jobs: failures,
    configuration: getSystemStatus(c.env)
  });
});

apiRoutes.get("/admin/system-status", requireRoles(["super_admin"]), async (c) => {
  return c.json(getSystemStatus(c.env));
});

apiRoutes.get("/admin/meetings", requireRoles(["admin", "super_admin"]), async (c) => {
  const query = parseQuery(
    c,
    z.object({
      employee: z.string().optional(),
      platform: sourceTypeSchema.optional(),
      source_type: sourceTypeSchema.optional(),
      processing_status: z.string().optional(),
      keyword: z.string().optional()
    })
  );
  const filters: string[] = ["m.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (query.employee) {
    filters.push("m.owner_user_id = ?");
    binds.push(query.employee);
  }
  if (query.platform) {
    filters.push("m.platform = ?");
    binds.push(query.platform);
  }
  if (query.source_type) {
    filters.push("m.source_type = ?");
    binds.push(query.source_type);
  }
  if (query.processing_status) {
    filters.push("m.processing_status = ?");
    binds.push(query.processing_status);
  }
  if (query.keyword) {
    filters.push("(m.title LIKE ? OR m.description LIKE ? OR u.email LIKE ?)");
    binds.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`);
  }
  const meetings = await c.env.DB.prepare(
    `SELECT m.*, u.email AS owner_email
     FROM meetings m
     INNER JOIN users u ON u.id = m.owner_user_id
     WHERE ${filters.join(" AND ")}
     ORDER BY m.created_at DESC
     LIMIT 200`
  )
    .bind(...binds)
    .all();
  return c.json({ meetings: meetings.results });
});

apiRoutes.get("/admin/recordings", requireRoles(["admin", "super_admin"]), async (c) => {
  const { recordings } = await listRecordings(c, true, 200);
  return c.json({ recordings: recordings.results });
});

apiRoutes.get("/recordings", async (c) => {
  const { recordings } = await listRecordings(c, false, 100);
  return c.json({ recordings: recordings.results });
});

apiRoutes.get("/action-items", async (c) => {
  const user = c.get("user");
  const accessSql = isAdmin(user)
    ? "1 = 1"
    : "(m.owner_user_id = ? OR m.id IN (SELECT meeting_id FROM share_permissions WHERE shared_with_user_id = ?))";
  const binds = isAdmin(user) ? [] : [user.id, user.id];
  const items = await c.env.DB.prepare(
    `SELECT ai.*, m.title AS meeting_title, m.meeting_datetime
     FROM action_items ai
     INNER JOIN meetings m ON m.id = ai.meeting_id
     WHERE m.deleted_at IS NULL AND ${accessSql}
     ORDER BY COALESCE(ai.due_date, ai.created_at) ASC
     LIMIT 100`
  )
    .bind(...binds)
    .all();
  return c.json({ action_items: items.results });
});

apiRoutes.get("/admin/users/:id/library", requireRoles(["admin", "super_admin"]), async (c) => {
  const meetings = await c.env.DB.prepare("SELECT * FROM meetings WHERE owner_user_id = ? AND deleted_at IS NULL ORDER BY meeting_datetime DESC")
    .bind(c.req.param("id"))
    .all();
  await writeAuditLog(c, { action: "admin_views_employee_library", targetType: "user", targetId: c.req.param("id") });
  return c.json({ meetings: meetings.results });
});

apiRoutes.get("/admin/audit-logs", requireRoles(["admin", "super_admin"]), async (c) => {
  const logs = await c.env.DB.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 250").all();
  return c.json({ audit_logs: logs.results });
});

apiRoutes.get("/admin/processing-failures", requireRoles(["admin", "super_admin"]), async (c) => {
  const jobs = await c.env.DB.prepare("SELECT * FROM processing_jobs WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 100").all();
  return c.json({ jobs: jobs.results });
});

apiRoutes.get("/admin/system-settings", requireRoles(["super_admin"]), async (c) => {
  const settings = await c.env.DB.prepare("SELECT key, value_json, updated_at FROM system_settings ORDER BY key ASC").all();
  return c.json({ settings: settings.results });
});

apiRoutes.get("/admin/integrations", requireRoles(["super_admin"]), async (c) => {
  const integrations = await c.env.DB.prepare("SELECT provider, status, config_json, updated_at FROM integrations WHERE deleted_at IS NULL ORDER BY provider ASC").all();
  return c.json({
    integrations: integrations.results.map((integration) => ({
      ...integration,
      config_json: sanitizeIntegrationConfig(integration.provider as string, integration.config_json as string)
    })),
    required_secrets: {
      google_oauth: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
      anthropic: Boolean(c.env.ANTHROPIC_API_KEY),
      microsoft: Boolean(c.env.MICROSOFT_CLIENT_ID && c.env.MICROSOFT_CLIENT_SECRET && c.env.MICROSOFT_TENANT_ID),
      zoom: Boolean(c.env.ZOOM_CLIENT_ID && c.env.ZOOM_CLIENT_SECRET && c.env.ZOOM_ACCOUNT_ID),
      webhook_secret: Boolean(c.env.WEBHOOK_SECRET)
    }
  });
});

apiRoutes.get("/admin/api-usage", requireRoles(["super_admin"]), async (c) => {
  const usage = await c.env.DB.prepare(
    `SELECT provider, model, operation, COUNT(*) AS calls, SUM(input_tokens) AS input_tokens,
            SUM(output_tokens) AS output_tokens, SUM(cost_estimate_usd) AS cost_estimate_usd
     FROM api_usage_logs
     GROUP BY provider, model, operation
     ORDER BY calls DESC
     LIMIT 100`
  ).all();
  return c.json({ usage: usage.results });
});

apiRoutes.get("/admin/storage-usage", requireRoles(["super_admin"]), async (c) => {
  const [recordings, transcripts] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS count, SUM(file_size) AS bytes FROM recordings WHERE deleted_at IS NULL").first(),
    c.env.DB.prepare("SELECT COUNT(*) AS count, SUM(word_count) AS word_count FROM transcripts").first()
  ]);
  return c.json({ recordings, transcripts });
});

apiRoutes.get("/admin/queue-logs", requireRoles(["super_admin"]), async (c) => {
  const jobs = await c.env.DB.prepare("SELECT * FROM processing_jobs ORDER BY created_at DESC LIMIT 150").all();
  return c.json({ jobs: jobs.results });
});

apiRoutes.post("/admin/processing-jobs/:id/retry", requireRoles(["admin", "super_admin"]), async (c) => {
  const job = await c.env.DB.prepare("SELECT * FROM processing_jobs WHERE id = ?").bind(c.req.param("id")).first<{ job_type: string; recording_id: string | null; meeting_id: string | null; transcript_id: string | null }>();
  if (!job) throw new ApiError(404, "not_found", "Processing job not found.");
  if (job.job_type === "transcription" && job.recording_id && job.meeting_id) await enqueueTranscription(c.env, job.recording_id, job.meeting_id);
  if (job.job_type === "ai_notes" && job.meeting_id && job.transcript_id) await enqueueAiNotes(c.env, job.meeting_id, job.transcript_id);
  await writeAuditLog(c, { action: "retry_processing", targetType: "processing_job", targetId: c.req.param("id") });
  return c.json({ ok: true });
});

apiRoutes.get("/search", async (c) => {
  const { q } = parseQuery(c, z.object({ q: z.string().min(1) }));
  const user = c.get("user");
  const like = `%${q}%`;
  const accessSql = isAdmin(user)
    ? "1 = 1"
    : "(m.owner_user_id = ? OR m.id IN (SELECT meeting_id FROM share_permissions WHERE shared_with_user_id = ?))";
  const binds = isAdmin(user) ? [like, like, like, like, like] : [user.id, user.id, like, like, like, like, like];
  const results = await c.env.DB.prepare(
    `SELECT DISTINCT m.id, m.title, m.meeting_datetime, m.owner_user_id, t.transcript_preview, n.parsed_notes_json
     FROM meetings m
     LEFT JOIN transcripts t ON t.meeting_id = m.id
     LEFT JOIN ai_notes n ON n.meeting_id = m.id
     LEFT JOIN action_items ai ON ai.meeting_id = m.id
     LEFT JOIN decisions d ON d.meeting_id = m.id
     LEFT JOIN topics tp ON tp.meeting_id = m.id
     WHERE m.deleted_at IS NULL AND ${accessSql}
       AND (m.title LIKE ? OR t.transcript_preview LIKE ? OR n.parsed_notes_json LIKE ? OR ai.task LIKE ? OR d.decision LIKE ?)
     ORDER BY m.meeting_datetime DESC
     LIMIT 50`
  )
    .bind(...binds)
    .all();
  return c.json({
    query: q,
    semantic_search_enabled: Boolean(c.env.MEETING_SEARCH),
    results: results.results
  });
});

type GoogleCalendarIntegration = {
  id: string;
  provider: string;
  status: string;
  config_json: string;
  updated_at: string;
} | null;

type GoogleCalendarConfig = {
  user_id?: string;
  email?: string;
  scope?: string;
  access_token?: string;
  refresh_token?: string | null;
  expires_at?: string;
  connected_at?: string;
  updated_at?: string;
};

type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  htmlLink: string | null;
  hangoutLink: string | null;
  attendees: Array<{ email?: string; name?: string }>;
};

function googleCalendarIntegrationId(userId: string): string {
  return `integration_google_calendar_${userId}`;
}

async function getGoogleCalendarIntegration(env: Env, userId: string): Promise<GoogleCalendarIntegration> {
  return env.DB.prepare(
    "SELECT id, provider, status, config_json, updated_at FROM integrations WHERE id = ? AND deleted_at IS NULL"
  )
    .bind(googleCalendarIntegrationId(userId))
    .first<NonNullable<GoogleCalendarIntegration>>();
}

function safeParseIntegrationConfig(configJson: string | null | undefined): GoogleCalendarConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as GoogleCalendarConfig;
  } catch {
    return {};
  }
}

function sanitizeIntegrationConfig(provider: string, configJson: string): string {
  if (provider !== "google_calendar") return configJson;
  return JSON.stringify(sanitizeGoogleCalendarConfig(safeParseIntegrationConfig(configJson)));
}

function sanitizeGoogleCalendarIntegration(integration: GoogleCalendarIntegration): {
  connected: boolean;
  status: string;
  email: string | null;
  scope: string | null;
  connected_at: string | null;
  updated_at: string | null;
} {
  if (!integration) {
    return { connected: false, status: "disabled", email: null, scope: null, connected_at: null, updated_at: null };
  }
  const config = safeParseIntegrationConfig(integration.config_json);
  return {
    connected: integration.status === "enabled",
    status: integration.status,
    email: config.email ?? null,
    scope: config.scope ?? null,
    connected_at: config.connected_at ?? null,
    updated_at: integration.updated_at ?? config.updated_at ?? null
  };
}

function sanitizeGoogleCalendarConfig(config: GoogleCalendarConfig) {
  return {
    user_id: config.user_id,
    email: config.email,
    scope: config.scope,
    connected_at: config.connected_at,
    updated_at: config.updated_at,
    has_access_token: Boolean(config.access_token),
    has_refresh_token: Boolean(config.refresh_token),
    expires_at: config.expires_at
  };
}

async function listGoogleCalendarEvents(c: AppContext, days: number): Promise<GoogleCalendarEvent[]> {
  const integration = await getGoogleCalendarIntegration(c.env, c.get("user").id);
  if (!integration || integration.status !== "enabled") {
    throw new ApiError(400, "google_calendar_not_connected", "Connect Google Calendar before syncing events.");
  }
  const accessToken = await getValidGoogleCalendarAccessToken(c.env, integration);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const response = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new ApiError(502, "google_calendar_events_failed", "Could not fetch Google Calendar events.");
  const json = (await response.json()) as {
    items?: Array<{
      id?: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      htmlLink?: string;
      hangoutLink?: string;
      attendees?: Array<{ email?: string; displayName?: string }>;
    }>;
  };
  return (json.items ?? []).map((event) => ({
    id: event.id ?? "",
    summary: event.summary ?? "Untitled calendar event",
    description: event.description ?? null,
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    attendees: (event.attendees ?? []).map((attendee) => ({ email: attendee.email, name: attendee.displayName }))
  }));
}

async function getValidGoogleCalendarAccessToken(env: Env, integration: NonNullable<GoogleCalendarIntegration>): Promise<string> {
  const config = safeParseIntegrationConfig(integration.config_json);
  const expiresAt = config.expires_at ? new Date(config.expires_at).getTime() : 0;
  if (config.access_token && expiresAt > Date.now() + 60_000) return config.access_token;
  if (!config.refresh_token) throw new ApiError(401, "google_calendar_reconnect_required", "Reconnect Google Calendar to refresh access.");
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new ApiError(500, "google_oauth_not_configured", "Google OAuth secrets are not configured.");

  const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: config.refresh_token,
      grant_type: "refresh_token"
    })
  });
  if (!refreshResponse.ok) throw new ApiError(401, "google_calendar_refresh_failed", "Google Calendar token refresh failed.");
  const refreshJson = (await refreshResponse.json()) as { access_token?: string; expires_in?: number; scope?: string };
  if (!refreshJson.access_token) throw new ApiError(401, "google_calendar_missing_access_token", "Google did not return a refreshed access token.");
  const nextConfig: GoogleCalendarConfig = {
    ...config,
    access_token: refreshJson.access_token,
    scope: refreshJson.scope ?? config.scope,
    expires_at: new Date(Date.now() + (refreshJson.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  };
  await env.DB.prepare("UPDATE integrations SET config_json = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(nextConfig), new Date().toISOString(), integration.id)
    .run();
  return refreshJson.access_token;
}

async function createMeeting(
  c: AppContext,
  input: z.infer<typeof meetingInputSchema>
): Promise<{ id: string; title: string }> {
  const meetingId = id("meeting");
  const agendaId = id("agenda");
  const manualNoteId = id("manual");
  const user = c.get("user");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO agendas (id, meeting_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(
      agendaId,
      meetingId,
      input.agenda ?? "",
      new Date().toISOString(),
      new Date().toISOString()
    ),
    c.env.DB.prepare(
      `INSERT INTO meetings (
        id, title, description, owner_user_id, meeting_datetime, platform, source_type, meeting_url,
        agenda_id, processing_status, visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, ?)`
    ).bind(
      meetingId,
      input.title,
      input.description ?? null,
      user.id,
      input.meeting_datetime,
      input.platform,
      input.source_type,
      input.meeting_url ?? null,
      agendaId,
      input.visibility,
      new Date().toISOString(),
      new Date().toISOString()
    ),
    c.env.DB.prepare("INSERT INTO manual_notes (id, meeting_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      manualNoteId,
      meetingId,
      user.id,
      input.manual_notes ?? "",
      new Date().toISOString(),
      new Date().toISOString()
    )
  ]);
  for (const participant of input.participants ?? []) {
    await c.env.DB.prepare(
      "INSERT INTO meeting_participants (id, meeting_id, name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id("participant"), meetingId, participant.name ?? null, participant.email ?? null, new Date().toISOString(), new Date().toISOString())
      .run();
  }
  return { id: meetingId, title: input.title };
}

async function getMeetingBundle(env: Env, meetingId: string): Promise<unknown> {
  const meeting = await env.DB.prepare(
    `SELECT m.*, u.email AS owner_email, a.content AS agenda
     FROM meetings m
     INNER JOIN users u ON u.id = m.owner_user_id
     LEFT JOIN agendas a ON a.id = m.agenda_id
     WHERE m.id = ?`
  )
    .bind(meetingId)
    .first();
  const [participants, recordings, transcript, notes, manualNote, actions, decisions, topics] = await Promise.all([
    env.DB.prepare("SELECT * FROM meeting_participants WHERE meeting_id = ?").bind(meetingId).all(),
    env.DB.prepare("SELECT * FROM recordings WHERE meeting_id = ? AND deleted_at IS NULL").bind(meetingId).all(),
    env.DB.prepare("SELECT * FROM transcripts WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1").bind(meetingId).first(),
    env.DB.prepare("SELECT * FROM ai_notes WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1").bind(meetingId).first(),
    env.DB.prepare("SELECT content FROM manual_notes WHERE meeting_id = ? ORDER BY updated_at DESC LIMIT 1").bind(meetingId).first<{ content: string }>(),
    env.DB.prepare("SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at DESC").bind(meetingId).all(),
    env.DB.prepare("SELECT * FROM decisions WHERE meeting_id = ? ORDER BY created_at DESC").bind(meetingId).all(),
    env.DB.prepare("SELECT * FROM topics WHERE meeting_id = ? ORDER BY sort_order ASC").bind(meetingId).all()
  ]);
  return {
    ...meeting,
    participants: participants.results,
    recordings: recordings.results,
    transcript,
    ai_notes: notes,
    manual_notes: manualNote?.content ?? "",
    action_items: actions.results,
    decisions: decisions.results,
    topics: topics.results
  };
}

async function getUploadSession(env: Env, sessionId: string): Promise<{
  id: string;
  userId: string;
  r2Key: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  metadataJson: string;
  tokenHash: string;
  status: string;
  expiresAt: string;
}> {
  const session = await env.DB.prepare(
    `SELECT id, user_id AS userId, r2_key AS r2Key, original_filename AS originalFilename,
            mime_type AS mimeType, file_size AS fileSize, metadata_json AS metadataJson,
            token_hash AS tokenHash, status, expires_at AS expiresAt
     FROM upload_sessions
     WHERE id = ?`
  )
    .bind(sessionId)
    .first<{
      id: string;
      userId: string;
      r2Key: string;
      originalFilename: string;
      mimeType: string;
      fileSize: number;
      metadataJson: string;
      tokenHash: string;
      status: string;
      expiresAt: string;
    }>();
  if (!session) throw new ApiError(404, "not_found", "Upload session not found.");
  return session;
}

async function listRecordings(
  c: AppContext,
  forceAdminScope: boolean,
  limit: number
): Promise<{ recordings: D1Result<Record<string, unknown>> }> {
  const user = c.get("user");
  const query = parseQuery(
    c,
    z.object({
      employee: z.string().optional(),
      platform: sourceTypeSchema.optional(),
      source_type: sourceTypeSchema.optional(),
      processing_status: z.string().optional(),
      keyword: z.string().optional()
    })
  );
  const adminScope = forceAdminScope || isAdmin(user);
  const filters: string[] = ["r.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (!adminScope) {
    filters.push("(r.owner_user_id = ? OR r.meeting_id IN (SELECT meeting_id FROM share_permissions WHERE shared_with_user_id = ?))");
    binds.push(user.id, user.id);
  }
  if (query.employee && isAdmin(user)) {
    filters.push("r.owner_user_id = ?");
    binds.push(query.employee);
  }
  if (query.platform) {
    filters.push("r.platform = ?");
    binds.push(query.platform);
  }
  if (query.source_type) {
    filters.push("r.source_type = ?");
    binds.push(query.source_type);
  }
  if (query.processing_status) {
    filters.push("r.processing_status = ?");
    binds.push(query.processing_status);
  }
  if (query.keyword) {
    filters.push("(r.original_filename LIKE ? OR m.title LIKE ? OR u.email LIKE ?)");
    binds.push(`%${query.keyword}%`, `%${query.keyword}%`, `%${query.keyword}%`);
  }
  const recordings = await c.env.DB.prepare(
    `SELECT r.*, m.title AS meeting_title, m.meeting_datetime, u.email AS owner_email
     FROM recordings r
     INNER JOIN meetings m ON m.id = r.meeting_id
     INNER JOIN users u ON u.id = r.owner_user_id
     WHERE ${filters.join(" AND ")}
     ORDER BY r.created_at DESC
     LIMIT ?`
  )
    .bind(...binds, limit)
    .all<Record<string, unknown>>();
  return { recordings };
}

function validateUploadFile(filename: string, fileSize: number): void {
  const extension = filename.split(".").pop()?.toLowerCase();
  const allowed = new Set(["mp3", "wav", "m4a", "mp4", "mov", "webm", "mkv"]);
  if (!extension || !allowed.has(extension)) {
    throw new ApiError(400, "unsupported_file_type", "Supported file types are mp3, wav, m4a, mp4, mov, webm, and mkv.");
  }
  const maxBytes = 1024 * 1024 * 1024;
  if (fileSize > maxBytes) throw new ApiError(400, "file_too_large", "Maximum upload size is 1024 MB by default.");
}

async function exportNotes(
  c: AppContext,
  format: "markdown" | "json" | "google_docs_text" | "pdf_ready_html"
): Promise<Response> {
  const meetingId = c.req.param("id");
  if (!meetingId) throw new ApiError(400, "missing_meeting_id", "Meeting id is required.");
  await assertCanAccessMeeting(c, meetingId);
  const note = await c.env.DB.prepare("SELECT parsed_notes_json AS parsed, rendered_markdown AS markdown FROM ai_notes WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(meetingId)
    .first<{ parsed: string | null; markdown: string | null }>();
  if (!note) throw new ApiError(404, "not_found", "AI notes not found.");
  await writeAuditLog(c, { action: "export_notes", targetType: "meeting", targetId: meetingId, metadata: { format } });
  if (format === "json") return new Response(note.parsed ?? "{}", { headers: { "content-type": "application/json" } });
  if (format === "pdf_ready_html") {
    return new Response(markdownToPdfReadyHtml(note.markdown ?? ""), {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
  return new Response(note.markdown ?? "", { headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function exportTranscript(c: AppContext): Promise<Response> {
  const meetingId = c.req.param("id");
  if (!meetingId) throw new ApiError(400, "missing_meeting_id", "Meeting id is required.");
  await assertCanAccessMeeting(c, meetingId);
  const transcript = await c.env.DB.prepare("SELECT r2_key AS r2Key FROM transcripts WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(meetingId)
    .first<{ r2Key: string }>();
  if (!transcript) throw new ApiError(404, "not_found", "Transcript not found.");
  const object = await c.env.TRANSCRIPTS.get(transcript.r2Key);
  if (!object) throw new ApiError(404, "not_found", "Transcript object not found.");
  await writeAuditLog(c, { action: "export_notes", targetType: "meeting", targetId: meetingId, metadata: { format: "transcript" } });
  return new Response(await object.text(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function createDownloadToken(env: Env, recordingId: string): Promise<string> {
  const payload = base64UrlEncode(JSON.stringify({ recordingId, exp: Date.now() + 1000 * 60 * 5 }));
  const signature = await hmacSha256(env.SESSION_SECRET, payload);
  return `${payload}.${signature}`;
}

async function verifyDownloadToken(env: Env, recordingId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacSha256(env.SESSION_SECRET, payload);
  if (!timingSafeEqual(signature, expected)) return false;
  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as { recordingId?: string; exp?: number };
    return decoded.recordingId === recordingId && typeof decoded.exp === "number" && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function markdownToPdfReadyHtml(markdown: string): string {
  const escaped = markdown
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      return line.trim() ? `<p>${line}</p>` : "";
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Meeting Notes</title><style>body{font-family:Arial,sans-serif;line-height:1.5;max-width:760px;margin:40px auto;color:#111}h1,h2,h3{page-break-after:avoid}li{margin:4px 0}</style></head><body>${escaped}</body></html>`;
}

function getSystemStatus(env: Env): {
  google_oauth_configured: boolean;
  cloudflare_workers_ai_configured: boolean;
  claude_configured: boolean;
  transcription_model: string;
  claude_model: string;
  required_action: string[];
} {
  const requiredAction: string[] = [];
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) requiredAction.push("Configure Google OAuth secrets.");
  if (!env.AI) requiredAction.push("Configure the Cloudflare Workers AI binding.");
  if (!env.ANTHROPIC_API_KEY) requiredAction.push("Set ANTHROPIC_API_KEY with npx wrangler secret put ANTHROPIC_API_KEY.");

  return {
    google_oauth_configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    cloudflare_workers_ai_configured: Boolean(env.AI),
    claude_configured: Boolean(env.ANTHROPIC_API_KEY),
    transcription_model: env.STT_MODEL || "@cf/openai/whisper-large-v3-turbo",
    claude_model: env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
    required_action: requiredAction
  };
}
