CREATE TABLE prototype_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('agent', 'skill')),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'enabled', 'disabled')),
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  icon TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  model_id TEXT,
  system_prompt TEXT,
  skill_ids_json TEXT NOT NULL,
  skill_package_id TEXT,
  skill_instructions TEXT,
  skill_checksum TEXT,
  permissions_json TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  associations_json TEXT NOT NULL,
  installation_status TEXT CHECK (
    installation_status IS NULL OR
    installation_status IN ('not_installed', 'installed', 'update_available')
  ),
  workflow_nodes_json TEXT NOT NULL,
  workflow_edges_json TEXT NOT NULL,
  documents_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX prototype_definitions_kind_updated_at_index
  ON prototype_definitions(kind, updated_at DESC);

CREATE UNIQUE INDEX prototype_definitions_skill_package_id_unique
  ON prototype_definitions(skill_package_id)
  WHERE kind = 'skill' AND skill_package_id IS NOT NULL;

CREATE TABLE prototype_catalog_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
