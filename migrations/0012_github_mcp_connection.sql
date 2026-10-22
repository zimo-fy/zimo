CREATE TABLE github_mcp_connections (
  server_id TEXT PRIMARY KEY NOT NULL CHECK (server_id = 'github'),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  endpoint TEXT NOT NULL CHECK (endpoint = 'https://api.githubcopilot.com/mcp/readonly'),
  account_login TEXT NOT NULL CHECK (length(account_login) BETWEEN 1 AND 100),
  secret_ref TEXT NOT NULL CHECK (length(secret_ref) BETWEEN 1 AND 200),
  server_version TEXT CHECK (server_version IS NULL OR length(server_version) BETWEEN 1 AND 100),
  tools_json TEXT NOT NULL CHECK (length(tools_json) BETWEEN 2 AND 200000),
  connected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
