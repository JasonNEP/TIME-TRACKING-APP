-- ============================================================
-- Pause / Resume support for time entries
-- Run this ONCE in Supabase SQL Editor AFTER everyone has
-- clocked out and BEFORE deploying the updated app.
-- ============================================================

-- 1. Add status column to time_entries
--    DEFAULT 'completed' so every existing row gets the right value automatically.
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

-- 2. Create the segments table
CREATE TABLE IF NOT EXISTS time_entry_segments (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id UUID        NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Row Level Security
ALTER TABLE time_entry_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own segments"
  ON time_entry_segments
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_time_entry_segments_entry_id
  ON time_entry_segments(time_entry_id);

CREATE INDEX IF NOT EXISTS idx_time_entry_segments_user_id
  ON time_entry_segments(user_id);

-- 5. Migrate all existing completed entries → one segment each
--    Skips entries that already have a segment (safe to re-run).
INSERT INTO time_entry_segments (time_entry_id, user_id, start_time, end_time)
SELECT te.id, te.user_id, te.clock_in, te.clock_out
FROM   time_entries te
WHERE  te.clock_out IS NOT NULL
  AND  NOT EXISTS (
         SELECT 1
         FROM   time_entry_segments s
         WHERE  s.time_entry_id = te.id
       );

-- 6. Handle any accidentally-open entries (should be none after everyone clocked out)
--    Mark them as paused so they surface in the UI for manual cleanup.
UPDATE time_entries
  SET status = 'paused'
WHERE clock_out IS NULL;

INSERT INTO time_entry_segments (time_entry_id, user_id, start_time, end_time)
SELECT te.id, te.user_id, te.clock_in, NULL
FROM   time_entries te
WHERE  te.clock_out IS NULL
  AND  NOT EXISTS (
         SELECT 1
         FROM   time_entry_segments s
         WHERE  s.time_entry_id = te.id
       );
