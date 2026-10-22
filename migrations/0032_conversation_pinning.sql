ALTER TABLE conversations
  ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1));

CREATE INDEX conversations_pinned_updated_index
  ON conversations(is_pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;
