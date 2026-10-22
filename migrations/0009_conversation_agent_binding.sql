ALTER TABLE conversations
  ADD COLUMN agent_id TEXT REFERENCES prototype_definitions(id) ON DELETE RESTRICT;

CREATE INDEX conversations_agent_id_index ON conversations(agent_id)
  WHERE agent_id IS NOT NULL;
