-- 2026-11-12 client lifecycle (autoplan review, approved by Robbie "take all").
-- Backup of every touched table: ~/Dropbox/EngageEngine/_deprecated/sprint-d1-backup-20261112/
--
-- 1. One lifecycle stage per client: onboarding -> sprint -> routine -> former.
ALTER TABLE sprint_clients ADD COLUMN stage TEXT DEFAULT 'onboarding';

UPDATE sprint_clients SET stage = CASE
  WHEN archived = 1 THEN 'former'
  WHEN has_sprint = 1 THEN 'sprint'
  -- a PAID service active; website hosting alone (B/M/O) does not make a Routine client
  WHEN EXISTS (SELECT 1 FROM client_services s WHERE s.client_id = sprint_clients.id
               AND s.status = 'active') THEN 'routine'
  ELSE 'onboarding' END;

-- 2. Every unarchived client in the routine stage is on the Routine (opt-out stays
--    possible from the Routine tab). Previously only 5 of 42 were.
UPDATE sprint_clients SET on_routine = 1 WHERE archived = 0 AND stage = 'routine';

-- 3. Daily / Weekly Ops are firm-wide chores: one job per period on the agency's own
--    record, not one copy per client.
UPDATE sprint_templates SET applies_when = 'firm', name = 'Daily Ops (firm-wide)'  WHERE id = 'rt-daily';
UPDATE sprint_templates SET applies_when = 'firm', name = 'Weekly Ops (firm-wide)' WHERE id = 'rt-weekly';

-- 4. Clear the old per-client copies' open steps (not missed client work: the chore
--    now lives once on the firm record), then drop jobs left empty.
DELETE FROM sprint_tasks WHERE status = 'Not Started' AND job_id IN (
  SELECT rg.job_id FROM routine_generation rg JOIN sprint_clients c ON c.id = rg.client_id
   WHERE rg.template_id IN ('rt-daily','rt-weekly') AND c.name != 'Marketing Performance');
DELETE FROM sprint_jobs WHERE id IN (
  SELECT rg.job_id FROM routine_generation rg JOIN sprint_clients c ON c.id = rg.client_id
   WHERE rg.template_id IN ('rt-daily','rt-weekly') AND c.name != 'Marketing Performance')
  AND NOT EXISTS (SELECT 1 FROM sprint_tasks st WHERE st.job_id = sprint_jobs.id);
