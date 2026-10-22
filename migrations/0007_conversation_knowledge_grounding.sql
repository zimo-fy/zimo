ALTER TABLE conversations
  ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE messages
  ADD COLUMN knowledge_citations_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE prototype_definitions
  ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';

ALTER TABLE agent_run_records
  ADD COLUMN knowledge_base_ids_json TEXT NOT NULL DEFAULT '[]';
