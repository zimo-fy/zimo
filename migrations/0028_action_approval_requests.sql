CREATE TABLE approval_requests (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  action_kind TEXT NOT NULL CHECK (
    action_kind IN ('file_read', 'file_write', 'file_delete', 'command', 'network', 'external_app')
  ),
  action_digest TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'allowed_once', 'denied', 'expired', 'cancelled')
  ),
  expires_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX approval_requests_action_unique
  ON approval_requests(run_id, tool_call_id, action_digest);

CREATE INDEX approval_requests_pending_index
  ON approval_requests(status, expires_at);

CREATE INDEX approval_requests_conversation_index
  ON approval_requests(conversation_id, created_at);
