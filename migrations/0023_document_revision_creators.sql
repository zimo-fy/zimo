CREATE TABLE document_revisions_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  artifact_id TEXT NOT NULL REFERENCES document_artifacts(id) ON DELETE CASCADE,
  parent_revision_id TEXT REFERENCES document_revisions_v2(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL UNIQUE,
  checksum TEXT NOT NULL CHECK (length(checksum) = 64),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  created_by TEXT NOT NULL CHECK (
    created_by IN ('user_import', 'model_create', 'model_patch', 'conversion')
  ),
  created_at TEXT NOT NULL
);

INSERT INTO document_revisions_v2
  (id, artifact_id, parent_revision_id, storage_key, checksum, size_bytes, created_by, created_at)
SELECT id, artifact_id, parent_revision_id, storage_key, checksum, size_bytes, created_by, created_at
FROM document_revisions;

DROP TABLE document_revisions;
ALTER TABLE document_revisions_v2 RENAME TO document_revisions;

CREATE INDEX document_revisions_artifact_index
  ON document_revisions(artifact_id, created_at);
