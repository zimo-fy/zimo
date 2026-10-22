CREATE TEMP TABLE mcp_agent_bindings_backup AS
  SELECT agent_id, server_id FROM agent_mcp_server_bindings;
CREATE TEMP TABLE mcp_workflow_bindings_backup AS
  SELECT workflow_id, server_id FROM workflow_mcp_server_bindings;

DROP TRIGGER IF EXISTS capability_cleanup_mcp_before_delete;
DROP TABLE agent_mcp_server_bindings;
DROP TABLE workflow_mcp_server_bindings;

ALTER TABLE mcp_connections RENAME TO mcp_connections_v3;

CREATE TABLE mcp_connections (
  server_id TEXT PRIMARY KEY NOT NULL CHECK (length(server_id) BETWEEN 1 AND 64),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  endpoint TEXT NOT NULL CHECK (length(endpoint) BETWEEN 10 AND 2048),
  source TEXT NOT NULL CHECK (source IN ('custom', 'catalog')),
  authentication TEXT NOT NULL CHECK (
    authentication IN ('none', 'bearer', 'oauth', 'header_token', 'api_key', 'query_token')
  ),
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
SELECT server_id, name, endpoint, source, authentication, secret_ref, server_name,
       server_version, tools_json, connected_at, updated_at
FROM mcp_connections_v3;

DROP TABLE mcp_connections_v3;

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

CREATE TRIGGER capability_cleanup_mcp_before_delete
BEFORE DELETE ON mcp_connections
BEGIN
  DELETE FROM agent_mcp_server_bindings WHERE server_id = OLD.server_id;
  DELETE FROM workflow_mcp_server_bindings WHERE server_id = OLD.server_id;
  UPDATE conversations
    SET mcp_tool_ids_json = (
          SELECT json_group_array(selected.value)
          FROM json_each(conversations.mcp_tool_ids_json) selected
          WHERE substr(selected.value, 1, length('mcp.' || OLD.server_id || '.')) <>
                'mcp.' || OLD.server_id || '.'
        ),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(conversations.mcp_tool_ids_json) selected
      WHERE substr(selected.value, 1, length('mcp.' || OLD.server_id || '.')) =
            'mcp.' || OLD.server_id || '.'
    );
END;
