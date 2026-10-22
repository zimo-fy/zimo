CREATE TABLE communication_channel_bindings_v2 (
  kind TEXT PRIMARY KEY NOT NULL CHECK (kind IN ('weixin', 'email')),
  status TEXT NOT NULL CHECK (status IN ('unbound', 'bound')),
  account_label TEXT,
  secret_ref TEXT,
  config_json TEXT NOT NULL,
  bound_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'unbound' AND secret_ref IS NULL) OR
    (
      status = 'bound' AND account_label IS NOT NULL AND
      (kind = 'email' OR secret_ref IS NOT NULL)
    )
  )
);

INSERT INTO communication_channel_bindings_v2
  (kind, status, account_label, secret_ref, config_json, bound_at, updated_at)
SELECT kind, status, account_label, secret_ref, config_json, bound_at, updated_at
FROM communication_channel_bindings;

DROP TABLE communication_channel_bindings;

ALTER TABLE communication_channel_bindings_v2
  RENAME TO communication_channel_bindings;
