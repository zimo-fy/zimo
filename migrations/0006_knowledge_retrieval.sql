CREATE TABLE knowledge_bases (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'enabled', 'disabled')),
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX knowledge_bases_status_updated_at_index
  ON knowledge_bases(status, updated_at DESC);

CREATE TABLE knowledge_documents (
  id TEXT PRIMARY KEY NOT NULL,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'ready', 'failed')),
  error_code TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(knowledge_base_id, checksum)
);

CREATE INDEX knowledge_documents_base_updated_at_index
  ON knowledge_documents(knowledge_base_id, updated_at DESC);

CREATE TABLE knowledge_chunks (
  id TEXT PRIMARY KEY NOT NULL,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  text TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  embedding_blob BLOB,
  created_at TEXT NOT NULL,
  UNIQUE(document_id, ordinal)
);

CREATE INDEX knowledge_chunks_base_document_index
  ON knowledge_chunks(knowledge_base_id, document_id, ordinal);

CREATE VIRTUAL TABLE knowledge_chunks_fts USING fts5(
  text,
  content='knowledge_chunks',
  content_rowid='rowid',
  tokenize='trigram case_sensitive 0'
);

CREATE TRIGGER knowledge_chunks_after_insert AFTER INSERT ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER knowledge_chunks_after_delete AFTER DELETE ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text)
    VALUES ('delete', old.rowid, old.text);
END;

CREATE TRIGGER knowledge_chunks_after_update AFTER UPDATE ON knowledge_chunks BEGIN
  INSERT INTO knowledge_chunks_fts(knowledge_chunks_fts, rowid, text)
    VALUES ('delete', old.rowid, old.text);
  INSERT INTO knowledge_chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
