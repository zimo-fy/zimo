ALTER TABLE prototype_definitions
  ADD COLUMN agent_catalog_id TEXT;

ALTER TABLE prototype_definitions
  ADD COLUMN agent_remote_id TEXT;

CREATE UNIQUE INDEX prototype_definitions_agent_catalog_id_unique
  ON prototype_definitions(agent_catalog_id)
  WHERE kind = 'agent' AND agent_catalog_id IS NOT NULL;
