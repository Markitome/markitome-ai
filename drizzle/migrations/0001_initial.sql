PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  approved_by_user_id TEXT,
  approved_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

CREATE TABLE IF NOT EXISTS agendas (
  id TEXT PRIMARY KEY,
  meeting_id TEXT,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT NOT NULL,
  meeting_datetime TEXT NOT NULL,
  platform TEXT NOT NULL,
  source_type TEXT NOT NULL,
  meeting_url TEXT,
  agenda_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (agenda_id) REFERENCES agendas(id)
);
CREATE INDEX IF NOT EXISTS idx_meetings_owner_user_id ON meetings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);
CREATE INDEX IF NOT EXISTS idx_meetings_processing_status ON meetings(processing_status);
CREATE INDEX IF NOT EXISTS idx_meetings_source_type ON meetings(source_type);
CREATE INDEX IF NOT EXISTS idx_meetings_platform ON meetings(platform);

CREATE TABLE IF NOT EXISTS meeting_participants (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON meeting_participants(user_id);

CREATE TABLE IF NOT EXISTS manual_notes (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_manual_notes_meeting_id ON manual_notes(meeting_id);
CREATE INDEX IF NOT EXISTS idx_manual_notes_user_id ON manual_notes(user_id);

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  duration_seconds INTEGER,
  consent_status TEXT NOT NULL,
  consent_confirmed_by_user_id TEXT,
  consent_confirmed_at TEXT,
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id),
  FOREIGN KEY (consent_confirmed_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_owner_user_id ON recordings(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at);
CREATE INDEX IF NOT EXISTS idx_recordings_processing_status ON recordings(processing_status);
CREATE INDEX IF NOT EXISTS idx_recordings_source_type ON recordings(source_type);
CREATE INDEX IF NOT EXISTS idx_recordings_platform ON recordings(platform);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  recording_id TEXT,
  r2_bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  language TEXT,
  duration_seconds INTEGER,
  word_count INTEGER,
  transcript_preview TEXT,
  transcription_provider TEXT,
  confidence_score REAL,
  processing_status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_recording_id ON transcripts(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_processing_status ON transcripts(processing_status);

CREATE TABLE IF NOT EXISTS ai_notes (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  transcript_id TEXT,
  model_name TEXT NOT NULL,
  raw_response_json TEXT,
  parsed_notes_json TEXT,
  rendered_markdown TEXT,
  token_usage_json TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  generated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_notes_meeting_id ON ai_notes(meeting_id);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  ai_note_id TEXT,
  task TEXT NOT NULL,
  assignee_text TEXT,
  assignee_user_id TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  source_quote TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_note_id) REFERENCES ai_notes(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_action_items_meeting_id ON action_items(meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assignee_user_id ON action_items(assignee_user_id);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  ai_note_id TEXT,
  decision TEXT NOT NULL,
  owner_text TEXT,
  owner_user_id TEXT,
  source_quote TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_note_id) REFERENCES ai_notes(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id ON decisions(meeting_id);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  ai_note_id TEXT,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL,
  key_points_json TEXT NOT NULL DEFAULT '[]',
  open_questions_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (ai_note_id) REFERENCES ai_notes(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_topics_meeting_id ON topics(meeting_id);

CREATE TABLE IF NOT EXISTS bot_sessions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  meeting_url TEXT NOT NULL,
  bot_display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  join_time TEXT,
  leave_time TEXT,
  recording_r2_key TEXT,
  consent_status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_meeting_id ON bot_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_platform ON bot_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_created_at ON bot_sessions(created_at);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disabled',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT,
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  r2_bucket TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  platform TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at);

CREATE TABLE IF NOT EXISTS share_permissions (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  shared_with_user_id TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'view',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meeting_id, shared_with_user_id),
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_share_permissions_meeting_id ON share_permissions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_share_permissions_shared_with_user_id ON share_permissions(shared_with_user_id);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  meeting_id TEXT,
  recording_id TEXT,
  transcript_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_meeting_id ON processing_jobs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_recording_id ON processing_jobs(recording_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  operation TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_estimate_usd REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);

CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value_json TEXT NOT NULL,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO roles (id, name, description) VALUES
  ('role_super_admin', 'super_admin', 'Full system access'),
  ('role_admin', 'admin', 'Company-wide meeting and user administration'),
  ('role_employee', 'employee', 'Employee meeting and recording access');

INSERT OR IGNORE INTO system_settings (id, key, value_json) VALUES
  ('setting_default_consent_requirement', 'default_consent_requirement', '"confirmed"'),
  ('setting_retention_period_days', 'retention_period_days', '365'),
  ('setting_download_policy', 'download_policy', '{"employees":"own_and_shared","admins":true,"super_admins":true}'),
  ('setting_employee_delete_own_recordings', 'employee_delete_own_recordings', 'true'),
  ('setting_allowed_file_types', 'allowed_file_types', '["mp3","wav","m4a","mp4","mov","webm","mkv"]'),
  ('setting_max_upload_size_mb', 'max_upload_size_mb', '1024');
