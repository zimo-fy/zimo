ALTER TABLE messages ADD COLUMN model_display_name TEXT
  CHECK (model_display_name IS NULL OR length(model_display_name) BETWEEN 1 AND 120);
