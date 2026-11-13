-- 2026-11-13 Client Success Process, build 1: store the success line and the verdicts.
-- Rules: vault Projects/Client Success Process.md. Build order: Projects/Client Success
-- Process — Build Brief 2026-11-12.md. Additive only: two new tables, nothing existing
-- is altered and nothing reads these yet.
-- APPLIED to production command-center 2026-11-13 (wrangler d1 execute --remote).
-- Seed: 2026-11-13_success_process_seed_plp.sql. Checks: success_process_readback.py
-- (stored numbers vs the client's _activity.md) and success_process_constraints_test.py.

-- One approved success line per client and scope. A changed line supersedes the old row;
-- rows are never edited in place, so the history of what was promised stays.
CREATE TABLE IF NOT EXISTS client_success_line (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id       TEXT NOT NULL REFERENCES sprint_clients(id),
  scope           TEXT NOT NULL DEFAULT 'account',   -- e.g. 'Google Ads, Columbia'
  line_text       TEXT NOT NULL,                     -- the one sentence, client's unit
  unit            TEXT NOT NULL,                     -- jobs | calls | booked estimates ...
  per             TEXT NOT NULL DEFAULT 'week',      -- week | month
  start_value     REAL,                              -- as the record states it, never re-derived
  start_per       TEXT,                              -- week | month (the start may be recorded per month)
  start_basis     TEXT,                              -- where the start number came from
  target_value    REAL NOT NULL,
  target_date     TEXT NOT NULL,                     -- YYYY-MM-DD
  outcome_source  TEXT,                              -- how the unit is counted, in words
  outcome_action  TEXT,                              -- Google Ads conversion action that IS the unit (e.g. Sale)
  outcome_filter  TEXT,                              -- campaign-name substring the line is scoped to (e.g. Columbia)
  cpl_bar         REAL,                              -- approved cost per lead bar
  cpl_lead_def    TEXT,                              -- what counts as a lead for the bar
  cpl_actual      REAL,                              -- actual shown at approval
  benchmark_value REAL,
  benchmark_key   TEXT,                              -- weekly-emails/benchmarks.json cpl_rows key
  decision_maker  TEXT,                              -- who signs and pays
  day_contact     TEXT,
  status          TEXT NOT NULL DEFAULT 'proposed'
                  CHECK (status IN ('proposed','approved','superseded')),
  approved_by     TEXT,
  approved_at     TEXT,
  provenance      TEXT,                              -- JSON: account id, date range, source
  open_questions  TEXT,
  supersedes_id   INTEGER REFERENCES client_success_line(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      TEXT DEFAULT 'claude'
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_success_line_live
  ON client_success_line (client_id, scope) WHERE status = 'approved';

-- One verdict per client, month and subject. subject_type 'line' carries the monthly
-- success-line status; every other type carries keep / fix / swerve / kill.
-- "No date, no verdict": recheck_date is required.
CREATE TABLE IF NOT EXISTS client_verdicts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id     TEXT NOT NULL REFERENCES sprint_clients(id),
  period        TEXT NOT NULL,                       -- YYYY-MM the verdict belongs to
  subject_type  TEXT NOT NULL
                CHECK (subject_type IN ('campaign','service','line')),
  subject_key   TEXT NOT NULL,                       -- gads:<campaign id> | gbp:<location> | seo | meta | website | line
  subject_name  TEXT,
  verdict       TEXT NOT NULL,
  reason        TEXT,
  action        TEXT,
  window_start  TEXT,
  window_end    TEXT,
  metrics       TEXT,                                -- JSON numbers the verdict rests on
  provenance    TEXT,                                -- JSON: account id, source/query, pulled_at
  recheck_date  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed','approved','superseded')),
  approved_by   TEXT,
  approved_at   TEXT,
  note          TEXT,
  supersedes_id INTEGER REFERENCES client_verdicts(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_by    TEXT DEFAULT 'claude',
  CHECK (
    (subject_type = 'line'  AND verdict IN ('on_track','behind','reached','not_set')) OR
    (subject_type != 'line' AND verdict IN ('keep','fix','swerve','kill','too_early','fix_tracking'))
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_verdict_live
  ON client_verdicts (client_id, period, subject_key) WHERE status != 'superseded';
CREATE INDEX IF NOT EXISTS ix_verdict_recheck ON client_verdicts (recheck_date) WHERE status != 'superseded';
