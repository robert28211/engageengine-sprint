-- 2026-10-17: runbook v2 — the 24 steps the observed-workflow analysis found missing,
-- plus a P4 · Offboarding lifecycle template. Source: _Internal/Setup/CLIENT-ONBOARDING-RUNBOOK.md
-- (▲ steps) and CLIENT-DELIVERY-OBSERVED-WORKFLOW.md (the evidence).
--
-- Data-only. Existing task ids are untouched (sprint_tasks joins on them), their
-- sort_order is multiplied by 10 so new rows can sit between. New ids carry a letter
-- suffix on the step they follow (…-t02a follows …-t02). Idempotent: re-running
-- re-applies the same end state.
--
-- Applies to NEW jobs created from these templates. Jobs already open for a client
-- keep the task list they were created with.

-- ── renumber existing rows once (skip if already ×10) ───────────────────────
UPDATE sprint_template_tasks SET sort_order = sort_order * 10
 WHERE template_id IN ('rt-p0-onboard','rt-p1-baseline','rt-p2-build')
   AND sort_order < 10;

-- ── P0 · Onboarding ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO sprint_template_tasks (id,template_id,notes,assigned_to_role,sort_order,tool_key) VALUES
('rt-p0-onboard-t00', 'rt-p0-onboard', 'Site-at-close check: domain resolves, certificate present, contact form submits and where it goes, who hosts, who owns GTM, who built it. Write answers in the client note. (Wilson sat on a parking page a week after close; Big Red Box''s form returned 405.)', 'Staff', 5, ''),
('rt-p0-onboard-t01a','rt-p0-onboard', 'Confirm the intake row actually exists in the Intake tab. Three clients "used the link" and the database had nothing.', 'Staff', 15, 'intake'),
('rt-p0-onboard-t02a','rt-p0-onboard', 'Duplicate-property sweep: list every GA4 property and Google Ads account matching the business name; pin the one with rows in the last 30 days. Four clients were pinned to the empty twin.', 'Staff', 25, 'client-connect'),
('rt-p0-onboard-t03a','rt-p0-onboard', 'Search Console by DNS TXT: list existing TXT records BEFORE adding one. Never replace. (One Burbage record was overwritten and lost.)', 'Staff', 35, 'client-connect'),
('rt-p0-onboard-t04a','rt-p0-onboard', 'GBP duplicate listings: if the name returns two profiles, record both and ask the client which is real. Austin''s second listing was re-found three times.', 'Staff', 45, 'gbp'),
('rt-p0-onboard-t05a','rt-p0-onboard', 'Meta: if the client has two ad accounts, record which one is live. (Brabham''s live account was named "Backup".)', 'Staff', 55, 'client-connect'),
('rt-p0-onboard-t09a','rt-p0-onboard', 'Pin by hand what /client-connect cannot see: Clarity project ID, Vendasta AG- id, every Local Services Ads account (its cid, not the picker number), direct-billed Google Ads (mark it direct). Brabham had four LSA accounts, the Index said three.', 'Staff', 95, 'credentials'),
('rt-p0-onboard-t09b','rt-p0-onboard', 'One name, one folder, one row: resolve the company through _CANONICAL-FOLDERS.md before any folder, D1 row or clients.json entry. One business with two product lines is one client. (Smith Built: two clients, three spellings. 42 recaps misfiled across three duplicate folders.)', 'Staff', 96, 'register'),
('rt-p0-onboard-t11a','rt-p0-onboard', 'Create the portal client row in portalops: slug, the person''s login email (not a shared inbox), vertical, market, active_sources = the Services row. Hold the invite until P2.', 'Staff', 115, 'portal'),
('rt-p0-onboard-t12a','rt-p0-onboard', 'Every red Access cell has an owner (client / Burt / Robin / their GTM vendor) and the date asked, written in the client note. Chase weekly. (Stormy''s GTM block sat a month, found twice, nobody chasing.)', 'Staff', 125, 'access');

-- ── P1 · Baseline & Diagnose ────────────────────────────────────────────────
INSERT OR REPLACE INTO sprint_template_tasks (id,template_id,notes,assigned_to_role,sort_order,tool_key) VALUES
('rt-p1-baseline-t00', 'rt-p1-baseline', 'Read the record first: Clients/<Client>/_activity.md, SETTLED.md, newest Internal Report. Nothing there → write "record: no prior" in the note. Every later finding says whether it was already known.', 'Staff', 5, ''),
('rt-p1-baseline-t03a','rt-p1-baseline', 'DVS score of 0 marked "site blocked" is a finding, not a score: fix the block (bot rules, WAF), re-score. Fifteen sites scored 0 in June; Sheppard''s was never re-run.', 'Staff', 35, 'dvs'),
('rt-p1-baseline-t05a','rt-p1-baseline', 'Confirm every campaign the audit lists is actually enabled and serving. Carolina Stone''s were built, staged and never switched on for six weeks.', 'Staff', 55, 'ads-audit'),
('rt-p1-baseline-t07a','rt-p1-baseline', 'Findings become tickets: every "broken" line in any P1 output gets its own Tracker task with an owner. A finding that is not a task is lost (Midlands'' dead conversion actions, CCS''s dead quote button).', 'Staff', 75, ''),
('rt-p1-baseline-t08a','rt-p1-baseline', 'GATE — Robbie names the failure mode: FM1/FM2/FM3/FM4 plus one sentence on where their demand is. Write it in this note AND in portalops (current_fm + demand position) the same day. 29 of 37 portal clients are missing it.', 'Robbie', 85, 'portal');

-- ── P2 · Build & Launch ─────────────────────────────────────────────────────
INSERT OR REPLACE INTO sprint_template_tasks (id,template_id,notes,assigned_to_role,sort_order,tool_key) VALUES
('rt-p2-build-t00', 'rt-p2-build', 'Nothing destructive without a read-back: before creating, changing or deleting anything in DNS, an ad account, a billing profile or a container, list what is there now and paste it in the note. (Six domains'' TXT records overwritten 09-01; Deacon''s Ads account built with no billing.)', 'Staff', 5, ''),
('rt-p2-build-t01a','rt-p2-build', 'Campaigns stay PAUSED until the P2 gate. Mount Horeb''s ran with no sitelinks, no conversion tag and wrong worship times because they were built before review.', 'Staff', 15, 'ads-build'),
('rt-p2-build-t02a','rt-p2-build', 'Check the thank-you page and the primary-conversion flag specifically. Guttermen''s thank-you page counted every form as "Phone call lead"; TDC''s primary flag was wrong until a report caught it.', 'Staff', 25, 'tracking-audit'),
('rt-p2-build-t03a','rt-p2-build', 'FILE the test lead: screenshot of the event in GA4 and in Google Ads, saved to Client Reports/<Client>/ and the vault folder as "<date> test conversion". The gate does not close without the file. Seven clients launched without it.', 'Staff', 35, 'tracking-audit'),
('rt-p2-build-t03b','rt-p2-build', 'Post-rebuild tag check: any site move, rebuild, theme or plugin change re-runs /tracking-audit and the test lead the same day. Donen''s GA4 died 42 days after a rebuild; Big Red Box went dark after a Pages move.', 'Staff', 36, 'tracking-audit'),
('rt-p2-build-t04a','rt-p2-build', 'Confirm the custom-intent audience ID exists and is refreshing. Atlantic was believed to be on intent leads for months; the audience did not exist.', 'Staff', 45, 'pixel-priority'),
('rt-p2-build-t06a','rt-p2-build', 'Test the portal invite AS THE CLIENT: log in with their email, code arrives (check spam), menu lands on the reports hub, first document opens. Only then does the invite go. (Dumpster Mule''s codes went to spam; Burbage''s menu opened the wrong page and Robbie was told it worked.)', 'Staff', 65, 'portal'),
('rt-p2-build-t06b','rt-p2-build', 'Client approval loop, written in this note on day one of P2: who at the client approves copy, where the draft waits (one place), how the yes is recorded (reply saved to the vault folder). Wilson, Sheppard''s and TDC all stalled because this was invented mid-flow.', 'Staff', 66, ''),
('rt-p2-build-t08', 'rt-p2-build', 'Welcome email in Robbie''s voice (/robbie-voice → Neo Drafts → Robbie approves), with the portal link from the tested invite. Sent only after the gate.', 'Staff', 80, '');

-- ── P4 · Offboarding (new) ──────────────────────────────────────────────────
INSERT OR REPLACE INTO sprint_templates (id,name,category,sort_order,cadence,applies_when,is_routine)
VALUES ('rt-p4-offboard','P4 · Offboarding','Lifecycle',35,'once','',1);

INSERT OR REPLACE INTO sprint_template_tasks (id,template_id,notes,assigned_to_role,sort_order,tool_key) VALUES
('rt-p4-offboard-t01','rt-p4-offboard', 'SPEND OFF, SAME DAY: Google Ads every campaign paused + budgets to zero; LSA ads off + billing profile moved off the agency card; Meta every ad set ended. Note date/time here. (Guttermen spent for five weeks after offboarding; Floor Pro''s LSA ran an unpaid balance on our profile.)', 'Staff', 10, ''),
('rt-p4-offboard-t02','rt-p4-offboard', 'Scheduled things off, each ticked by hand: Apps Script triggers (script.google.com → Triggers), Looker Studio schedules, Clarity digests, GitHub Actions on their repos.', 'Staff', 20, ''),
('rt-p4-offboard-t03','rt-p4-offboard', 'Our own loops off: Routine tab → remove from routine + delete open routine tasks; adcheck offboarded:true in clients.json; vendasta-check + Vendasta modules paused; SEO agent roster; VaultLearn boards retired; AudienceLab pixel + audience deleted; lead recap + weekly email send:false. (Blythewood: 32 tasks still generating nine days after; still in the ad pulse eighteen days after.)', 'Staff', 30, 'services'),
('rt-p4-offboard-t04','rt-p4-offboard', 'Inbound repointed: site form destination to their own inbox or the next vendor; lead-mailbox rules removed; tracking numbers released or forwarded. (Guttermen''s form posted 35 inquiries to our Formspree for three weeks; only Robbie saw them.)', 'Staff', 40, ''),
('rt-p4-offboard-t05','rt-p4-offboard', 'Records ARCHIVED, never deleted: portal row inactive (reports stay); OFFBOARDED <date> atop _activity.md; D1 status Former; clients.json send:false + offboarded:true; Credentials Index heading bannered FORMER (IDs stay); /clients former table; one Second Brain entry. (Blythewood''s portal record was deleted with its reports.)', 'Staff', 50, 'register'),
('rt-p4-offboard-t06','rt-p4-offboard', 'Last deliverable: final monthly report if due, both places + portal shelf. Documents are frozen after this.', 'Staff', 60, 'mpgstyle'),
('rt-p4-offboard-t07','rt-p4-offboard', 'Handback package within two weeks: Google Ads full export zip + the one-paragraph "bills to our manager account, cannot transfer, only rebuild" note; Meta partner access removed, they keep the Business Manager; website credentials list + redirect map of every URL we built. From the office address, Robbie cc''d, saved to the vault folder.', 'Staff', 70, ''),
('rt-p4-offboard-t08','rt-p4-offboard', 'Account closure or handback: Google Ads account cancelled or unlinked from the MCC; Vendasta subaccount cancelled. Not before t01 and t07 are done.', 'Robbie', 80, ''),
('rt-p4-offboard-t09','rt-p4-offboard', 'VERIFY a week later: media-spend reconciliation shows zero for them; no email from any scheduled job bears their name; ad pulse does not list them; portal row inactive. Then close this job.', 'Staff', 90, 'adcheck');
