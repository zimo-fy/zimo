CREATE TABLE automations (
  id TEXT PRIMARY KEY NOT NULL,
  owner_external_user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  schedule_json TEXT NOT NULL,
  active_from TEXT,
  active_until TEXT,
  next_run_at TEXT,
  last_run_at TEXT,
  last_run_status TEXT CHECK (last_run_status IN ('running', 'completed', 'failed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX automations_owner_updated_index
  ON automations(owner_external_user_id, updated_at);
CREATE INDEX automations_due_index
  ON automations(owner_external_user_id, enabled, next_run_at)
  WHERE deleted_at IS NULL AND next_run_at IS NOT NULL;

CREATE TABLE automation_runs (
  id TEXT PRIMARY KEY NOT NULL,
  automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  conversation_run_id TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  scheduled_for TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error_code TEXT
);

CREATE UNIQUE INDEX automation_runs_one_active_index
  ON automation_runs(automation_id) WHERE status = 'running';
CREATE INDEX automation_runs_automation_started_index
  ON automation_runs(automation_id, started_at DESC);
