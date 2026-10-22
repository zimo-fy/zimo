ALTER TABLE automations
  ADD COLUMN time_window_start TEXT NOT NULL DEFAULT '00:00'
  CHECK (
    time_window_start GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(time_window_start, 1, 2) BETWEEN '00' AND '23'
  );

ALTER TABLE automations
  ADD COLUMN time_window_end TEXT NOT NULL DEFAULT '23:59'
  CHECK (
    time_window_end GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(time_window_end, 1, 2) BETWEEN '00' AND '23'
  );
