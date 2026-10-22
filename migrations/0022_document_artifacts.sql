CREATE TABLE document_artifacts (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 180),
  media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 160),
  format TEXT NOT NULL CHECK (format IN ('docx', 'xlsx', 'pptx', 'pdf')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed')),
  current_revision_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX document_artifacts_conversation_index
  ON document_artifacts(conversation_id, created_at);

CREATE TABLE document_revisions (
  id TEXT PRIMARY KEY NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES document_artifacts(id) ON DELETE CASCADE,
  parent_revision_id TEXT REFERENCES document_revisions(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  created_by TEXT NOT NULL CHECK (created_by = 'user_import'),
  created_at TEXT NOT NULL
);

CREATE INDEX document_revisions_artifact_index
  ON document_revisions(artifact_id, created_at);

CREATE TABLE message_artifact_bindings (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL UNIQUE REFERENCES document_artifacts(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('input', 'output')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, artifact_id)
);

CREATE INDEX message_artifact_bindings_message_index
  ON message_artifact_bindings(message_id);
