CREATE TABLE knowledge_cloud_links (
  id TEXT PRIMARY KEY NOT NULL,
  knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  catalog_directory_id TEXT NOT NULL,
  catalog_document_id TEXT NOT NULL,
  local_document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  remote_checksum TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX knowledge_cloud_links_base_document_unique
  ON knowledge_cloud_links(knowledge_base_id, catalog_document_id);

CREATE INDEX knowledge_cloud_links_directory_index
  ON knowledge_cloud_links(catalog_directory_id, updated_at);
