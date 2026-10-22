ALTER TABLE conversation_workspace_grants
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'external'
  CHECK (kind IN ('managed', 'external'));

CREATE INDEX conversation_workspace_grants_kind_index
  ON conversation_workspace_grants(conversation_id, kind, created_at);
