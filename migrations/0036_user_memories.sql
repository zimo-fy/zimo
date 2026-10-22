CREATE TABLE user_memories (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preference', 'goal', 'open_issue')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX user_memories_owner_index ON user_memories(owner_user_id, updated_at DESC);

CREATE TRIGGER user_memories_owner_limit BEFORE INSERT ON user_memories
WHEN (SELECT COUNT(*) FROM user_memories WHERE owner_user_id = NEW.owner_user_id) >= 100
BEGIN
  SELECT RAISE(ABORT, 'USER_MEMORY_LIMIT');
END;
