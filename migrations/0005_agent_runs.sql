CREATE TABLE agent_run_records (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES prototype_definitions(id) ON DELETE RESTRICT,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  skill_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX agent_run_records_conversation_created_index
  ON agent_run_records(conversation_id, created_at DESC);

CREATE INDEX agent_run_records_agent_created_index
  ON agent_run_records(agent_id, created_at DESC);
