CREATE TABLE workspace_directory_authorizations (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  root_ref TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_user_id, root_ref)
);

CREATE INDEX workspace_directory_authorizations_owner_index
  ON workspace_directory_authorizations(owner_user_id, created_at);
