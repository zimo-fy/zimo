CREATE TABLE security_audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  event_type TEXT NOT NULL,
  conversation_id TEXT,
  run_id TEXT NOT NULL,
  approval_id TEXT,
  tool_call_id TEXT,
  tool_id TEXT,
  action_kind TEXT,
  risk TEXT,
  decision TEXT,
  outcome TEXT NOT NULL,
  rule_id TEXT,
  error_code TEXT,
  duration_ms INTEGER,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX security_audit_events_created_index
  ON security_audit_events(created_at DESC, id DESC);

CREATE INDEX security_audit_events_filter_index
  ON security_audit_events(event_type, risk, outcome, created_at DESC);
