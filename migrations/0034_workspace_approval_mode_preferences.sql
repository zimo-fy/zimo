CREATE TABLE workspace_approval_mode_preferences (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('ask', 'auto_approve')),
  updated_at TEXT NOT NULL
);

-- Existing installations normally have one signed-in account. Preserve its
-- most recently selected conversation mode without assigning another local
-- account's history when multiple account identities are present.
INSERT INTO workspace_approval_mode_preferences (owner_user_id, mode, updated_at)
SELECT owner.external_user_id, recent.mode, recent.updated_at
FROM (
  SELECT MIN(external_user_id) AS external_user_id
  FROM user_sessions
  WHERE external_user_id <> ''
  HAVING COUNT(DISTINCT external_user_id) = 1
) AS owner
CROSS JOIN (
  SELECT mode, updated_at
  FROM conversation_workspace_grants
  ORDER BY updated_at DESC, id DESC
  LIMIT 1
) AS recent;
