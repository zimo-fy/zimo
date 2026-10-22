CREATE TABLE document_artifacts_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 180),
  media_type TEXT NOT NULL CHECK (length(media_type) BETWEEN 1 AND 160),
  format TEXT NOT NULL CHECK (
    format IN (
      'docx',
      'xlsx',
      'pptx',
      'pdf',
      'txt',
      'md',
      'html',
      'json',
      'csv',
      'rtf',
      'odt',
      'ods',
      'odp',
      'epub'
    )
  ),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  status TEXT NOT NULL CHECK (status IN ('ready', 'failed')),
  current_revision_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO document_artifacts_v2
  (id, conversation_id, display_name, media_type, format, size_bytes, status,
   current_revision_id, created_at, updated_at)
SELECT id, conversation_id, display_name, media_type, format, size_bytes, status,
       current_revision_id, created_at, updated_at
FROM document_artifacts;

CREATE TABLE document_revisions_v3 (
  id TEXT PRIMARY KEY NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES document_artifacts_v2(id) ON DELETE CASCADE,
  parent_revision_id TEXT REFERENCES document_revisions_v3(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  created_by TEXT NOT NULL CHECK (
    created_by IN ('user_import', 'model_create', 'model_patch', 'conversion')
  ),
  created_at TEXT NOT NULL
);

INSERT INTO document_revisions_v3
  (id, artifact_id, parent_revision_id, storage_key, checksum, size_bytes, created_by, created_at)
SELECT id, artifact_id, parent_revision_id, storage_key, checksum, size_bytes, created_by, created_at
FROM document_revisions;

CREATE TABLE message_artifact_bindings_v3 (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES document_artifacts_v2(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES document_revisions_v3(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('input', 'output')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, artifact_id, relation)
);

INSERT INTO message_artifact_bindings_v3
  (message_id, artifact_id, revision_id, relation, created_at)
SELECT message_id, artifact_id, revision_id, relation, created_at
FROM message_artifact_bindings;

DROP TABLE message_artifact_bindings;
DROP TABLE document_revisions;
DROP TABLE document_artifacts;

ALTER TABLE document_artifacts_v2 RENAME TO document_artifacts;
ALTER TABLE document_revisions_v3 RENAME TO document_revisions;
ALTER TABLE message_artifact_bindings_v3 RENAME TO message_artifact_bindings;

CREATE INDEX document_artifacts_conversation_index
  ON document_artifacts(conversation_id, created_at);
CREATE INDEX document_revisions_artifact_index
  ON document_revisions(artifact_id, created_at);
CREATE INDEX message_artifact_bindings_message_index
  ON message_artifact_bindings(message_id);
CREATE INDEX message_artifact_bindings_artifact_index
  ON message_artifact_bindings(artifact_id);
