ALTER TABLE agent_run_records RENAME TO agent_run_records_v1;

CREATE TABLE agent_run_records (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  skill_ids_json TEXT NOT NULL,
  knowledge_base_ids_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO agent_run_records
  (id, conversation_id, agent_id, model_id, skill_ids_json, knowledge_base_ids_json,
   status, error_code, created_at, updated_at)
SELECT id, conversation_id, agent_id, model_id, skill_ids_json, knowledge_base_ids_json,
       status, error_code, created_at, updated_at
FROM agent_run_records_v1;

DROP TABLE agent_run_records_v1;

CREATE INDEX agent_run_records_conversation_created_index
  ON agent_run_records(conversation_id, created_at DESC);
CREATE INDEX agent_run_records_agent_created_index
  ON agent_run_records(agent_id, created_at DESC);

CREATE TRIGGER capability_cleanup_agent_before_delete
BEFORE DELETE ON prototype_definitions
WHEN OLD.kind = 'agent'
BEGIN
  UPDATE conversations
    SET agent_id = NULL,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE agent_id = OLD.id;
  UPDATE workflow_definitions
    SET status = 'disabled',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(workflow_nodes_json) node
      WHERE json_extract(node.value, '$.type') = 'agent'
        AND json_extract(node.value, '$.config.agentId') = OLD.id
    );
END;

CREATE TRIGGER capability_cleanup_skill_before_delete
BEFORE DELETE ON prototype_definitions
WHEN OLD.kind = 'skill'
BEGIN
  UPDATE conversations
    SET skill_ids_json = (
          SELECT json_group_array(selected.value)
          FROM json_each(conversations.skill_ids_json) selected
          WHERE selected.value <> OLD.id
        ),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(conversations.skill_ids_json) selected
      WHERE selected.value = OLD.id
    );
  UPDATE prototype_definitions
    SET skill_ids_json = (
          SELECT json_group_array(selected.value)
          FROM json_each(prototype_definitions.skill_ids_json) selected
          WHERE selected.value <> OLD.id
        ),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE kind = 'agent' AND EXISTS (
      SELECT 1 FROM json_each(prototype_definitions.skill_ids_json) selected
      WHERE selected.value = OLD.id
    );
  UPDATE workflow_definitions
    SET status = 'disabled',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(workflow_nodes_json) node
      WHERE json_extract(node.value, '$.type') = 'skill'
        AND json_extract(node.value, '$.config.skillId') = OLD.id
    );
END;

CREATE TRIGGER capability_cleanup_knowledge_before_delete
BEFORE DELETE ON knowledge_bases
BEGIN
  UPDATE conversations
    SET knowledge_base_ids_json = (
          SELECT json_group_array(selected.value)
          FROM json_each(conversations.knowledge_base_ids_json) selected
          WHERE selected.value <> OLD.id
        ),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(conversations.knowledge_base_ids_json) selected
      WHERE selected.value = OLD.id
    );
  UPDATE prototype_definitions
    SET knowledge_base_ids_json = (
          SELECT json_group_array(selected.value)
          FROM json_each(prototype_definitions.knowledge_base_ids_json) selected
          WHERE selected.value <> OLD.id
        ),
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE kind = 'agent' AND EXISTS (
      SELECT 1 FROM json_each(prototype_definitions.knowledge_base_ids_json) selected
      WHERE selected.value = OLD.id
    );
  UPDATE workflow_definitions
    SET status = 'disabled',
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE EXISTS (
      SELECT 1 FROM json_each(workflow_nodes_json) node
      WHERE json_extract(node.value, '$.type') = 'knowledge'
        AND json_extract(node.value, '$.config.knowledgeBaseId') = OLD.id
    );
END;

CREATE TRIGGER capability_cleanup_workflow_before_delete
BEFORE DELETE ON workflow_definitions
BEGIN
  UPDATE conversations
    SET workflow_id = NULL,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE workflow_id = OLD.id;
END;

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
