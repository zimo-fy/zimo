ALTER TABLE conversations
ADD COLUMN browser_enabled INTEGER NOT NULL DEFAULT 0 CHECK (browser_enabled IN (0, 1));
