UPDATE conversations
SET browser_enabled = 1
WHERE id NOT IN (
  SELECT conversation_id
  FROM automations
);
