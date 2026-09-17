-- Client Operating Routine — schema migration (run once, remote D1: command-center)
-- Applied 2026-07-26. ALTER ... ADD COLUMN is not IF-NOT-EXISTS in SQLite; the
-- adds below are one-time (re-running errors harmlessly on "duplicate column").

-- Routine metadata on the existing template tables
ALTER TABLE sprint_templates      ADD COLUMN cadence      TEXT DEFAULT '';   -- once|daily|weekly|monthly|45day
ALTER TABLE sprint_templates      ADD COLUMN applies_when TEXT DEFAULT '';   -- comma list of client_services keys; '' = all clients
ALTER TABLE sprint_templates      ADD COLUMN is_routine   INTEGER DEFAULT 0; -- 1 = part of the operating routine
ALTER TABLE sprint_template_tasks ADD COLUMN tool_key     TEXT DEFAULT '';   -- client_activity.tool that auto-completes this step

-- Routine membership flag on clients (decoupled from the 30-Day Sprint).
-- The routine engine targets on_routine=1 (NOT has_sprint). One-time add.
ALTER TABLE sprint_clients ADD COLUMN on_routine INTEGER DEFAULT 0;
-- Initial cohort (2026-07-26): the then-current sprint clients were moved onto
-- the routine and graduated out of the sprint:
--   UPDATE sprint_clients SET on_routine=1 WHERE has_sprint=1 AND archived=0;
--   UPDATE sprint_clients SET has_sprint=0 WHERE has_sprint=1 AND archived=0;

-- Idempotency + daily-gate bookkeeping (safe to re-run)
CREATE TABLE IF NOT EXISTS routine_generation (
  template_id TEXT NOT NULL,
  client_id   TEXT NOT NULL,
  period_key  TEXT NOT NULL,             -- daily=YYYY-MM-DD, weekly=ISO week, monthly=YYYY-MM, 45day=45-<bucket>
  job_id      TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (template_id, client_id, period_key)
);
CREATE TABLE IF NOT EXISTS routine_state (k TEXT PRIMARY KEY, v TEXT);

-- Then load the routine definitions:  wrangler d1 execute command-center --remote --file db/routine_seed.sql
-- (regenerate routine_seed.sql from db/gen_routine_seed.py if the routine changes)
