-- 2026-11-13 Client Success Process, build 4: the monthly verdict is owed work, and
-- warning signs are recorded. Rules: vault Projects/Client Success Process.md (step 4,
-- "Warning signs"). Idempotent.

-- 1. The monthly verdict becomes a step of the Monthly Report routine job, closed
--    automatically (tool_key 'verdicts') when every required verdict for the client's
--    month is approved on the Verdicts tab. Placed before delivery: the client report
--    says what we kept, changed and stopped, which comes from the approved verdicts.
UPDATE sprint_template_tasks SET sort_order = 7 WHERE id = 'rt-monthly-report-t06' AND sort_order = 6;
INSERT OR IGNORE INTO sprint_template_tasks (id, template_id, notes, assigned_to_role, sort_order, tool_key)
VALUES ('rt-monthly-report-t06v', 'rt-monthly-report',
  'Step 4 verdicts: approve every proposed verdict on the Verdicts tab (success line + Google Ads, Business Profile and SEO where active). Closes itself when the month is complete.',
  '', 6, 'verdicts');

-- Backfill: this month's Monthly Report jobs were generated before the step existed.
INSERT OR IGNORE INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at)
SELECT 'task-vd-' || rg.job_id, rg.job_id, rg.client_id, 'rt-monthly-report-t06v', tt.notes, 'Not Started', '', '', date('now'), date('now')
  FROM routine_generation rg
  JOIN sprint_template_tasks tt ON tt.id = 'rt-monthly-report-t06v'
  JOIN sprint_jobs j ON j.id = rg.job_id
 WHERE rg.template_id = 'rt-monthly-report' AND rg.period_key = strftime('%Y-%m', 'now');

-- 2. Warning signs (step 4). Seven signs; two are detected from approved verdicts
--    (source 'auto', at most one row per client, sign and period), five are logged by
--    hand on the Verdicts tab. One open sign: Robbie is told. Two within 60 days: a
--    "call the decision-maker" job is raised.
CREATE TABLE IF NOT EXISTS client_warning_signs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id   TEXT NOT NULL REFERENCES sprint_clients(id),
  sign        TEXT NOT NULL CHECK (sign IN ('line_behind','count_untrusted','cut_pause_cancel',
                'bill_or_late','other_agency','silence','leads_wrong')),
  period      TEXT,                       -- YYYY-MM for auto signs
  noted_on    TEXT NOT NULL DEFAULT (date('now')),
  note        TEXT,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_on TEXT,
  resolution  TEXT,
  notified_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_by  TEXT DEFAULT 'tracker'
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_warning_auto ON client_warning_signs (client_id, sign, period) WHERE source = 'auto';
CREATE INDEX IF NOT EXISTS ix_warning_open ON client_warning_signs (client_id, status, noted_on);
