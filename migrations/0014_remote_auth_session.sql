ALTER TABLE user_sessions ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'mock';
ALTER TABLE user_sessions ADD COLUMN external_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE user_sessions ADD COLUMN account_id TEXT NOT NULL DEFAULT '';
ALTER TABLE user_sessions ADD COLUMN token_secret_ref TEXT NOT NULL DEFAULT '';
