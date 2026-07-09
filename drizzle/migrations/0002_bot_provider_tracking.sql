ALTER TABLE bot_sessions ADD COLUMN external_bot_id TEXT;
ALTER TABLE bot_sessions ADD COLUMN provider_metadata_json TEXT;
CREATE INDEX IF NOT EXISTS idx_bot_sessions_external_bot_id ON bot_sessions(external_bot_id);
