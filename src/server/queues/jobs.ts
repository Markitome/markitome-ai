import type { Env } from "../../types";
import { ClaudeNotesService } from "../ai/ClaudeNotesService";
import { id } from "../utils/crypto";
import { CloudflareWorkersAITranscriptionProvider } from "../transcription/CloudflareWorkersAITranscriptionProvider";
import { ExternalSTTProvider } from "../transcription/ExternalSTTProvider";
import type { RecordingForTranscription, TranscriptionProvider } from "../transcription/TranscriptionProvider";

interface TranscriptionJob {
  type: "transcription";
  jobId: string;
  recordingId: string;
}

interface AiNotesJob {
  type: "ai_notes";
  jobId: string;
  meetingId: string;
  transcriptId: string;
}

export type QueueJob = TranscriptionJob | AiNotesJob;

export async function enqueueTranscription(env: Env, recordingId: string, meetingId: string): Promise<string> {
  const jobId = id("job");
  await env.DB.prepare(
    `INSERT INTO processing_jobs (id, job_type, meeting_id, recording_id, status, payload_json, created_at, updated_at)
     VALUES (?, 'transcription', ?, ?, 'queued', ?, ?, ?)`
  )
    .bind(jobId, meetingId, recordingId, JSON.stringify({ recordingId }), new Date().toISOString(), new Date().toISOString())
    .run();
  await env.TRANSCRIPTION_QUEUE.send({ type: "transcription", jobId, recordingId } satisfies TranscriptionJob);
  return jobId;
}

export async function enqueueAiNotes(env: Env, meetingId: string, transcriptId: string): Promise<string> {
  const jobId = id("job");
  await env.DB.prepare(
    `INSERT INTO processing_jobs (id, job_type, meeting_id, transcript_id, status, payload_json, created_at, updated_at)
     VALUES (?, 'ai_notes', ?, ?, 'queued', ?, ?, ?)`
  )
    .bind(jobId, meetingId, transcriptId, JSON.stringify({ meetingId, transcriptId }), new Date().toISOString(), new Date().toISOString())
    .run();
  await env.AI_NOTES_QUEUE.send({ type: "ai_notes", jobId, meetingId, transcriptId } satisfies AiNotesJob);
  return jobId;
}

export async function handleQueueBatch(batch: MessageBatch<QueueJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      if (message.body.type === "transcription") {
        await processTranscriptionJob(env, message.body);
      } else {
        await processAiNotesJob(env, message.body);
      }
      message.ack();
    } catch (error) {
      message.retry();
      const body = message.body;
      await markJobFailed(env, body.jobId, error);
    }
  }
}

export async function processTranscriptionJob(env: Env, job: TranscriptionJob): Promise<void> {
  await markJobRunning(env, job.jobId);
  const recording = await env.DB.prepare(
    `SELECT
       id,
       meeting_id AS meetingId,
       r2_bucket AS r2Bucket,
       r2_key AS r2Key,
       mime_type AS mimeType,
       original_filename AS originalFilename
     FROM recordings
     WHERE id = ? AND deleted_at IS NULL`
  )
    .bind(job.recordingId)
    .first<RecordingForTranscription>();
  if (!recording) throw new Error("Recording not found for transcription job.");

  await env.DB.batch([
    env.DB.prepare("UPDATE recordings SET processing_status = 'transcribing', updated_at = ? WHERE id = ?").bind(
      new Date().toISOString(),
      recording.id
    ),
    env.DB.prepare("UPDATE meetings SET processing_status = 'transcribing', updated_at = ? WHERE id = ?").bind(
      new Date().toISOString(),
      recording.meetingId
    )
  ]);

  const provider = selectTranscriptionProvider();
  const transcript = await provider.transcribeRecording(recording, env);
  const transcriptId = id("transcript");
  const transcriptKey = `transcripts/${recording.meetingId}/${transcriptId}.txt`;
  const wordCount = transcript.text.trim() ? transcript.text.trim().split(/\s+/).length : 0;
  await env.TRANSCRIPTS.put(transcriptKey, transcript.text, {
    httpMetadata: { contentType: "text/plain; charset=utf-8" }
  });

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO transcripts (
        id, meeting_id, recording_id, r2_bucket, r2_key, language, duration_seconds, word_count,
        transcript_preview, transcription_provider, confidence_score, processing_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`
    ).bind(
      transcriptId,
      recording.meetingId,
      recording.id,
      "TRANSCRIPTS",
      transcriptKey,
      transcript.language ?? null,
      transcript.durationSeconds ?? null,
      wordCount,
      transcript.text.slice(0, 1000),
      transcript.providerName,
      transcript.confidenceScore ?? null,
      new Date().toISOString(),
      new Date().toISOString()
    ),
    env.DB.prepare("UPDATE recordings SET processing_status = 'transcribed', updated_at = ? WHERE id = ?").bind(
      new Date().toISOString(),
      recording.id
    ),
    env.DB.prepare("UPDATE meetings SET processing_status = 'transcribed', updated_at = ? WHERE id = ?").bind(
      new Date().toISOString(),
      recording.meetingId
    )
  ]);

  await markJobComplete(env, job.jobId);
  await enqueueAiNotes(env, recording.meetingId, transcriptId);
}

export async function processAiNotesJob(env: Env, job: AiNotesJob): Promise<void> {
  await markJobRunning(env, job.jobId);
  await env.DB.prepare("UPDATE meetings SET processing_status = 'generating_notes', updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), job.meetingId)
    .run();

  const meeting = await env.DB.prepare(
    `SELECT m.id, m.title, m.platform, m.source_type AS sourceType, m.meeting_datetime AS meetingDatetime,
            a.content AS agenda,
            (SELECT content FROM manual_notes WHERE meeting_id = m.id ORDER BY updated_at DESC LIMIT 1) AS manualNotes
     FROM meetings m
     LEFT JOIN agendas a ON a.id = m.agenda_id
     WHERE m.id = ? AND m.deleted_at IS NULL`
  )
    .bind(job.meetingId)
    .first<{
      id: string;
      title: string;
      platform: string;
      sourceType: string;
      meetingDatetime: string;
      agenda: string | null;
      manualNotes: string | null;
    }>();
  if (!meeting) throw new Error("Meeting not found for AI notes job.");

  const transcriptRow = await env.DB.prepare("SELECT r2_key AS r2Key FROM transcripts WHERE id = ?")
    .bind(job.transcriptId)
    .first<{ r2Key: string }>();
  if (!transcriptRow) throw new Error("Transcript not found for AI notes job.");
  const transcriptObject = await env.TRANSCRIPTS.get(transcriptRow.r2Key);
  if (!transcriptObject) throw new Error("Transcript object missing from R2.");
  const transcriptText = await transcriptObject.text();

  const participantsResult = await env.DB.prepare(
    "SELECT COALESCE(email, name) AS label FROM meeting_participants WHERE meeting_id = ?"
  )
    .bind(job.meetingId)
    .all<{ label: string }>();

  const generated = await new ClaudeNotesService(env).generate({
    meetingTitle: meeting.title,
    agenda: meeting.agenda,
    participants: participantsResult.results.map((participant) => participant.label).filter(Boolean),
    transcriptText,
    manualNotes: meeting.manualNotes,
    metadata: {
      platform: meeting.platform,
      sourceType: meeting.sourceType,
      meetingDatetime: meeting.meetingDatetime
    }
  });

  const aiNoteId = id("note");
  const statements = [
    env.DB.prepare(
      `INSERT INTO ai_notes (
        id, meeting_id, transcript_id, model_name, raw_response_json, parsed_notes_json, rendered_markdown,
        token_usage_json, generation_status, generated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
    ).bind(
      aiNoteId,
      job.meetingId,
      job.transcriptId,
      generated.modelName,
      generated.rawResponse,
      JSON.stringify(generated.parsed),
      generated.renderedMarkdown,
      JSON.stringify(generated.tokenUsage),
      generated.generatedAt,
      new Date().toISOString(),
      new Date().toISOString()
    )
  ];

  for (const item of generated.parsed.suggested_action_items) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO action_items (
          id, meeting_id, ai_note_id, task, assignee_text, due_date, priority, status, source_quote, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`
      ).bind(
        id("action"),
        job.meetingId,
        aiNoteId,
        item.task,
        item.assignee,
        item.due_date,
        item.priority,
        item.source_quote,
        new Date().toISOString(),
        new Date().toISOString()
      )
    );
  }

  for (const decision of generated.parsed.decisions) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO decisions (
          id, meeting_id, ai_note_id, decision, owner_text, source_quote, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("decision"),
        job.meetingId,
        aiNoteId,
        decision.decision,
        decision.owner,
        decision.source_quote,
        new Date().toISOString(),
        new Date().toISOString()
      )
    );
  }

  generated.parsed.topic_overview.forEach((topic, index) => {
    statements.push(
      env.DB.prepare(
        `INSERT INTO topics (
          id, meeting_id, ai_note_id, topic, summary, key_points_json, open_questions_json, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id("topic"),
        job.meetingId,
        aiNoteId,
        topic.topic,
        topic.summary,
        JSON.stringify(topic.key_points),
        JSON.stringify(topic.open_questions),
        index,
        new Date().toISOString(),
        new Date().toISOString()
      )
    );
  });

  statements.push(
    env.DB.prepare("UPDATE meetings SET processing_status = 'completed', updated_at = ? WHERE id = ?").bind(
      new Date().toISOString(),
      job.meetingId
    )
  );

  await env.DB.batch(statements);
  await markJobComplete(env, job.jobId);
}

function selectTranscriptionProvider(): TranscriptionProvider {
  return new ExternalSTTProvider();
}

async function markJobRunning(env: Env, jobId: string): Promise<void> {
  await env.DB.prepare(
    "UPDATE processing_jobs SET status = 'running', attempts = attempts + 1, started_at = ?, updated_at = ? WHERE id = ?"
  )
    .bind(new Date().toISOString(), new Date().toISOString(), jobId)
    .run();
}

async function markJobComplete(env: Env, jobId: string): Promise<void> {
  await env.DB.prepare("UPDATE processing_jobs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), jobId)
    .run();
}

async function markJobFailed(env: Env, jobId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown queue error";
  await env.DB.prepare("UPDATE processing_jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?")
    .bind(message, new Date().toISOString(), jobId)
    .run();
}
