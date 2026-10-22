CREATE TEMP TABLE mcp_agent_bindings_backup AS
  SELECT agent_id, server_id FROM agent_mcp_server_bindings;
CREATE TEMP TABLE mcp_workflow_bindings_backup AS
  SELECT workflow_id, server_id FROM workflow_mcp_server_bindings;

DROP TABLE agent_mcp_server_bindings;
DROP TABLE workflow_mcp_server_bindings;

ALTER TABLE mcp_connections RENAME TO mcp_connections_v1;

CREATE TABLE mcp_connections (
  server_id TEXT PRIMARY KEY NOT NULL CHECK (length(server_id) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  endpoint TEXT NOT NULL CHECK (length(endpoint) BETWEEN 10 AND 2048),
  source TEXT NOT NULL CHECK (source IN ('custom', 'catalog')),
  authentication TEXT NOT NULL CHECK (authentication IN ('none', 'bearer', 'oauth')),
  secret_ref TEXT CHECK (secret_ref IS NULL OR length(secret_ref) BETWEEN 1 AND 200),
  server_name TEXT NOT NULL CHECK (length(server_name) BETWEEN 1 AND 160),
  server_version TEXT CHECK (server_version IS NULL OR length(server_version) BETWEEN 1 AND 100),
  tools_json TEXT NOT NULL CHECK (length(tools_json) BETWEEN 2 AND 2000000),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO mcp_connections
  (server_id, name, endpoint, source, authentication, secret_ref, server_name,
   server_version, tools_json, connected_at, updated_at)
SELECT server_id, name, endpoint,
       CASE WHEN server_id = 'github' THEN 'catalog' ELSE 'custom' END,
       authentication, secret_ref, server_name, server_version, tools_json,
       connected_at, updated_at
FROM mcp_connections_v1;

DROP TABLE mcp_connections_v1;

CREATE TABLE agent_mcp_server_bindings (
  agent_id TEXT NOT NULL REFERENCES prototype_definitions(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES mcp_connections(server_id) ON DELETE RESTRICT,
  PRIMARY KEY (agent_id, server_id)
);
CREATE INDEX agent_mcp_server_bindings_server_index
  ON agent_mcp_server_bindings(server_id);
INSERT INTO agent_mcp_server_bindings SELECT agent_id, server_id FROM mcp_agent_bindings_backup;

CREATE TABLE workflow_mcp_server_bindings (
  workflow_id TEXT NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES mcp_connections(server_id) ON DELETE RESTRICT,
  PRIMARY KEY (workflow_id, server_id)
);
CREATE INDEX workflow_mcp_server_bindings_server_index
  ON workflow_mcp_server_bindings(server_id);
INSERT INTO workflow_mcp_server_bindings
  SELECT workflow_id, server_id FROM mcp_workflow_bindings_backup;

DROP TABLE mcp_agent_bindings_backup;
DROP TABLE mcp_workflow_bindings_backup;
