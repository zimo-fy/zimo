CREATE TABLE model_providers (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'openai-compatible'),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX model_providers_active_name_unique
  ON model_providers(name)
  WHERE deleted_at IS NULL;

CREATE TABLE models (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL REFERENCES model_providers(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider_id, name)
);

CREATE INDEX models_provider_id_index ON models(provider_id);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  active_run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX conversations_updated_at_index
  ON conversations(updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX conversations_model_id_index ON conversations(model_id);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'streaming', 'completed', 'cancelled', 'failed')),
  position INTEGER NOT NULL CHECK (position >= 0),
  replaces_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  error_code TEXT,
  usage_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(conversation_id, position)
);

CREATE INDEX messages_conversation_position_index
  ON messages(conversation_id, position);
CREATE INDEX messages_replaces_message_id_index
  ON messages(replaces_message_id);
