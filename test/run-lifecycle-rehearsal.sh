#!/bin/bash
# Rehearse the client-lifecycle logic (routine generation, reaper, auto-close, archive,
# graduate, roster) against a LOCAL copy of production D1. Read-only on production:
# it only exports tables. Usage: test/run-lifecycle-rehearsal.sh   (prints PASS/FAIL)
set -e
cd "$(dirname "$0")/.."
W=$(mktemp -d)
for t in sprint_clients client_services client_platform_ids sprint_templates sprint_template_tasks sprint_jobs sprint_tasks routine_generation routine_state client_activity identities pipeline_heartbeats; do
  npx wrangler d1 export command-center --remote --table "$t" --output "$W/$t.sql" >/dev/null 2>&1
  npx wrangler d1 execute command-center --local --persist-to "$W/d1/v3" --file "$W/$t.sql" >/dev/null 2>&1
done
# Applies cleanly on a pre-2026-11-12 schema; on a current one the ALTER fails and is ignored.
npx wrangler d1 execute command-center --local --persist-to "$W/d1/v3" --file db/2026-11-12_lifecycle.sql >/dev/null 2>&1 || true
cp src/worker.js "$W/w.mjs"
echo 'export { generateRoutineJobs as G, reapSupersededRoutineTasks as R, handleRoutineBoard as B, handleClientArchive as A, handleActivityIngest as I, handleSprintDeactivate as D, handleRoster as RO };' >> "$W/w.mjs"
node test/lifecycle-rehearsal.mjs "$W" 2>&1 | grep -E '^(PASS|FAIL|would_create)|Error'
rm -rf "$W"
