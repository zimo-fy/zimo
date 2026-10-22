CREATE TABLE intent_route_records (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  input_fingerprint TEXT NOT NULL,
  input_length INTEGER NOT NULL CHECK (input_length >= 0),
  intent TEXT NOT NULL CHECK (intent IN ('chat', 'agent', 'skill', 'workflow', 'unknown')),
  target_id TEXT,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  did_fallback INTEGER NOT NULL CHECK (did_fallback IN (0, 1)),
  fallback_reason TEXT CHECK (fallback_reason IS NULL OR fallback_reason IN ('timeout', 'classifier_error', 'invalid_schema', 'low_confidence', 'invalid_target', 'no_classifier')),
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX intent_route_records_run_id_unique ON intent_route_records(run_id);
CREATE INDEX intent_route_records_created_at_index ON intent_route_records(created_at DESC);
CREATE INDEX intent_route_records_conversation_id_index ON intent_route_records(conversation_id);
