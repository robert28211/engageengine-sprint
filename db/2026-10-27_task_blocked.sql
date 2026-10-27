-- 2026-10-27: task-level "blocked by". A task stays 'Not Started' (every count,
-- the reaper and routine logic keep working); blocked_by non-empty = waiting.
-- blocked_by = who/what it waits on (Client, a team member, Robin, Google...),
-- blocked_reason = the specific thing, blocked_at = date it went blocked.
ALTER TABLE sprint_tasks ADD COLUMN blocked_by TEXT DEFAULT '';
ALTER TABLE sprint_tasks ADD COLUMN blocked_reason TEXT DEFAULT '';
ALTER TABLE sprint_tasks ADD COLUMN blocked_at TEXT DEFAULT '';
