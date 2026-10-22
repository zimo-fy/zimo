CREATE TABLE communication_channel_bindings (
  kind TEXT PRIMARY KEY NOT NULL CHECK (kind IN ('weixin', 'email')),
  status TEXT NOT NULL CHECK (status IN ('unbound', 'bound')),
  account_label TEXT,
  secret_ref TEXT,
  config_json TEXT NOT NULL,
  bound_at TEXT,
  updated_at TEXT NOT NULL,
  CHECK (
    (status = 'unbound' AND secret_ref IS NULL) OR
    (status = 'bound' AND secret_ref IS NOT NULL AND account_label IS NOT NULL)
  )
);
