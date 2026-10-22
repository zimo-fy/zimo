CREATE TABLE message_artifact_bindings_v2 (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL REFERENCES document_artifacts(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES document_revisions(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('input', 'output')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, artifact_id, relation)
);

INSERT INTO message_artifact_bindings_v2
  (message_id, artifact_id, revision_id, relation, created_at)
SELECT b.message_id,
       b.artifact_id,
       CASE
         WHEN b.relation = 'input' THEN COALESCE(
           (SELECT r.id FROM document_revisions r
            WHERE r.artifact_id = b.artifact_id AND r.created_by = 'user_import'
            ORDER BY r.created_at, r.id LIMIT 1),
           a.current_revision_id
         )
         ELSE a.current_revision_id
       END,
       b.relation,
       b.created_at
FROM message_artifact_bindings b
JOIN document_artifacts a ON a.id = b.artifact_id;

DROP TABLE message_artifact_bindings;
ALTER TABLE message_artifact_bindings_v2 RENAME TO message_artifact_bindings;

CREATE INDEX message_artifact_bindings_message_index
  ON message_artifact_bindings(message_id);
CREATE INDEX message_artifact_bindings_artifact_index
  ON message_artifact_bindings(artifact_id);

-- Earlier patch runs could advance an imported artifact without creating an output binding.
-- Restore those logical documents to the original input revision; retained revision rows/files
-- remain available for later recovery and conversation deletion cleanup.
UPDATE document_artifacts
SET current_revision_id = (
      SELECT b.revision_id FROM message_artifact_bindings b
      WHERE b.artifact_id = document_artifacts.id AND b.relation = 'input'
      ORDER BY b.created_at, b.message_id LIMIT 1
    ),
    size_bytes = (
      SELECT r.size_bytes FROM document_revisions r
      JOIN message_artifact_bindings b ON b.revision_id = r.id
      WHERE b.artifact_id = document_artifacts.id AND b.relation = 'input'
      ORDER BY b.created_at, b.message_id LIMIT 1
    )
WHERE EXISTS (
    SELECT 1 FROM message_artifact_bindings b
    WHERE b.artifact_id = document_artifacts.id AND b.relation = 'input'
  )
  AND NOT EXISTS (
    SELECT 1 FROM message_artifact_bindings b
    WHERE b.artifact_id = document_artifacts.id AND b.relation = 'output'
  )
  AND EXISTS (
    SELECT 1 FROM document_revisions r
    WHERE r.id = document_artifacts.current_revision_id AND r.created_by = 'model_patch'
  );
