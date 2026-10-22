ALTER TABLE conversations
  ADD COLUMN skill_ids_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE conversations
  ADD COLUMN workflow_id TEXT REFERENCES workflow_definitions(id) ON DELETE RESTRICT;

ALTER TABLE conversations
  ADD COLUMN mcp_tool_ids_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX conversations_workflow_id_index ON conversations(workflow_id)
  WHERE workflow_id IS NOT NULL;
