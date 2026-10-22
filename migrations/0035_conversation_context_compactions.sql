CREATE TABLE conversation_context_compactions (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger TEXT NOT NULL CHECK (trigger IN ('threshold', 'overflow_recovery', 'manual')),
  source_from_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  source_to_message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  covered_through_position INTEGER NOT NULL CHECK (covered_through_position >= 0),
  retained_from_position INTEGER NOT NULL CHECK (retained_from_position >= 0),
  summary TEXT,
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (conversation_id, version),
  CHECK (
    (status = 'completed' AND summary IS NOT NULL AND length(summary) > 0 AND output_tokens IS NOT NULL AND error_code IS NULL)
    OR (status = 'running' AND summary IS NULL AND output_tokens IS NULL AND error_code IS NULL)
    OR (status = 'failed' AND summary IS NULL AND output_tokens IS NULL AND error_code IS NOT NULL)
  )
);

CREATE INDEX conversation_context_compactions_conversation_version_index
  ON conversation_context_compactions(conversation_id, version DESC);

CREATE INDEX conversation_context_compactions_status_index
  ON conversation_context_compactions(status, updated_at);
