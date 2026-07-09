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
  upload_session_id TEXT,
  consent_status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (upload_session_id) REFERENCES upload_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_meeting_id ON bot_sessions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_platform ON bot_sessions(platform);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_status ON bot_sessions(status);
CREATE INDEX IF NOT EXISTS idx_bot_sessions_created_at ON bot_sessions(created_at);
