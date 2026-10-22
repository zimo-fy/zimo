CREATE TABLE conversation_workspace_grants_next (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  root_ref TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ask', 'auto_approve')),
  status TEXT NOT NULL CHECK (status IN ('active', 'unavailable')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'external' CHECK (kind IN ('managed', 'external')),
  UNIQUE (conversation_id, root_ref)
);

INSERT INTO conversation_workspace_grants_next
  (id, conversation_id, root_ref, display_name, mode, status, created_at, updated_at, kind)
SELECT
  id,
  conversation_id,
  root_ref,
  display_name,
  CASE mode WHEN 'auto_low_risk' THEN 'auto_approve' ELSE mode END,
  status,
  created_at,
  updated_at,
  kind
FROM conversation_workspace_grants;

DROP TABLE conversation_workspace_grants;
ALTER TABLE conversation_workspace_grants_next RENAME TO conversation_workspace_grants;

CREATE INDEX conversation_workspace_grants_conversation_index
  ON conversation_workspace_grants(conversation_id, created_at);

CREATE INDEX conversation_workspace_grants_kind_index
  ON conversation_workspace_grants(conversation_id, kind, created_at);
