CREATE TABLE communication_channel_bindings_v2 (
  owner_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('weixin', 'email')),
  status TEXT NOT NULL CHECK (status IN ('unbound', 'bound')),
  account_label TEXT,
  secret_ref TEXT,
  config_json TEXT NOT NULL,
  bound_at TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_user_id, kind),
  CHECK (
    status = 'unbound' OR
    (status = 'bound' AND account_label IS NOT NULL AND (kind = 'email' OR secret_ref IS NOT NULL))
  )
);

INSERT INTO communication_channel_bindings_v2
  (owner_user_id, kind, status, account_label, secret_ref, config_json, bound_at, updated_at)
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM user_sessions WHERE external_user_id <> '') = 1
      THEN (SELECT external_user_id FROM user_sessions WHERE external_user_id <> '' LIMIT 1)
    ELSE '__legacy_unassigned__'
  END,
  kind, status, account_label, secret_ref, config_json, bound_at, updated_at
FROM communication_channel_bindings;

DROP TABLE communication_channel_bindings;
ALTER TABLE communication_channel_bindings_v2 RENAME TO communication_channel_bindings;

CREATE TABLE weixin_assistant_routes (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL
);

CREATE TABLE weixin_inbound_receipts (
  owner_user_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  received_at TEXT NOT NULL,
  finished_at TEXT,
  error_code TEXT,
  PRIMARY KEY (owner_user_id, dedupe_key)
);

CREATE INDEX weixin_inbound_receipts_received_index
  ON weixin_inbound_receipts(owner_user_id, received_at);
