CREATE TABLE conversation_workspace_grants (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  root_ref TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ask', 'auto_low_risk')),
  status TEXT NOT NULL CHECK (status IN ('active', 'unavailable')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (conversation_id, root_ref)
);

CREATE INDEX conversation_workspace_grants_conversation_index
  ON conversation_workspace_grants(conversation_id, created_at);
