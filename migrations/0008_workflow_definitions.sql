CREATE TABLE workflow_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'enabled', 'disabled')),
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  icon TEXT NOT NULL,
  version TEXT NOT NULL,
  source TEXT NOT NULL,
  workflow_nodes_json TEXT NOT NULL,
  workflow_edges_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX workflow_definitions_updated_at_index
  ON workflow_definitions(updated_at DESC);
