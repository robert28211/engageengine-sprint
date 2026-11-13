-- 2026-11-13 Client Success Process, build 1 seed: PunchList Pros.
-- Source: vault Clients/Punch List Pros/_activity.md, internal notes dated 2026-11-12.
-- Every number here was pulled live on 2026-11-12 and is POINT-IN-TIME. Re-pull before
-- repeating any of it. Idempotent: each insert is skipped if its live row already exists.

INSERT INTO client_success_line
  (client_id, scope, line_text, unit, per, start_value, start_per, start_basis, target_value, target_date,
   outcome_source, outcome_action, outcome_filter, cpl_bar, cpl_lead_def, cpl_actual, benchmark_value, benchmark_key,
   status, approved_by, approved_at, provenance, open_questions)
SELECT 'client-1779886732403-kjn1sl5yb', 'Google Ads, Columbia',
  'Google Ads closes five jobs a week in Columbia (one full truck) by 2027-03-31, at or under $45 per call or form lead.',
  'jobs', 'week', 14, 'month',
  'About 14 jobs a month, a little over 3 a week: Columbia ads, Apr-Sep 2026, from the 2026-10-14 truck report. Not re-pulled.',
  5, '2027-03-31',
  'Google Ads conversion action "Sale" only. Inspection, Quote and Sale count one job three times.', 'Sale', 'Columbia',
  45, 'Calls and forms: Phone Call + Calls From Ads + Form Capture', 43.37, 90.92, 'localiq_hhi_2026',
  'approved', 'Robbie', '2026-11-12',
  '{"gads_customer_id":"6952791370","direct_billed":true,"window":"2026-10-13..2026-11-11","spend":4857.11,"calls_and_forms":112,"sale_conversions":7,"pulled":"2026-11-12","source":"GAQL campaign + conversion_action_name"}',
  'Can Columbia take two more jobs a week today (client capacity). Line not yet told to the client. Decision-maker name not recorded.'
WHERE NOT EXISTS (SELECT 1 FROM client_success_line
                  WHERE client_id='client-1779886732403-kjn1sl5yb' AND scope='Google Ads, Columbia' AND status='approved');

INSERT INTO client_verdicts
  (client_id, period, subject_type, subject_key, subject_name, verdict, reason, action,
   window_start, window_end, metrics, provenance, recheck_date, status, approved_by, approved_at, note)
SELECT 'client-1779886732403-kjn1sl5yb','2026-11','campaign','gads:20814784940','PLP-Columbia-SC','fix',
  'Budget-bound, but over the approved $45 bar on calls and forms.',
  'No added budget. Cut the zero-conversion keywords the 2026-10-19 report flagged.',
  '2026-10-13','2026-11-11',
  '{"spend":3775.43,"conversions":89.5,"cost_per_conversion":42.18,"calls_and_forms":58.5,"cost_per_call_or_form":64.54,"lost_to_budget":0.46,"lost_to_rank":0.34,"prior_report_cost_per_conversion":52.01}',
  '{"gads_customer_id":"6952791370","direct_billed":true,"source":"GAQL campaign metrics + conversion_action_name","pulled":"2026-11-12"}',
  '2026-12-12','approved','Robbie','2026-11-12',
  'First logged as KEEP; moved to FIX the same day when Robbie approved the $45 bar.'
WHERE NOT EXISTS (SELECT 1 FROM client_verdicts WHERE client_id='client-1779886732403-kjn1sl5yb' AND period='2026-11' AND subject_key='gads:20814784940' AND status!='superseded');

INSERT INTO client_verdicts
  (client_id, period, subject_type, subject_key, subject_name, verdict, reason, action,
   window_start, window_end, metrics, provenance, recheck_date, status, approved_by, approved_at, note)
SELECT 'client-1779886732403-kjn1sl5yb','2026-11','campaign','gads:20316639540','PLP - Columbia - PMAX','fix',
  'Rank-bound: more budget buys nothing. Under the $45 bar.',
  'Hold budget. Fix ads and page.',
  '2026-10-13','2026-11-11',
  '{"spend":621.20,"conversions":59.5,"cost_per_conversion":10.44,"calls_and_forms":44.5,"cost_per_call_or_form":13.96,"lost_to_budget":0.24,"lost_to_rank":0.58,"prior_report_cost_per_conversion":7.10}',
  '{"gads_customer_id":"6952791370","direct_billed":true,"source":"GAQL campaign metrics + conversion_action_name","pulled":"2026-11-12"}',
  '2026-12-12','approved','Robbie','2026-11-12', NULL
WHERE NOT EXISTS (SELECT 1 FROM client_verdicts WHERE client_id='client-1779886732403-kjn1sl5yb' AND period='2026-11' AND subject_key='gads:20316639540' AND status!='superseded');

INSERT INTO client_verdicts
  (client_id, period, subject_type, subject_key, subject_name, verdict, reason, action,
   window_start, window_end, metrics, provenance, recheck_date, status, approved_by, approved_at, note)
SELECT 'client-1779886732403-kjn1sl5yb','2026-11','campaign','gads:23624876395','PLP - Aiken - Search','too_early',
  'Thirteen conversions, and the ads were repointed to the Aiken page (change undated in the record). Over the $45 bar on 9 calls and forms.',
  'Do not act on the 2026-10-19 "pull budget from Aiken" flag. Wait for a clean 30 days.',
  '2026-10-13','2026-11-11',
  '{"spend":460.48,"conversions":13,"cost_per_conversion":35.42,"calls_and_forms":9,"cost_per_call_or_form":51.16,"lost_to_budget":0.54,"lost_to_rank":0.32,"prior_report_cost_per_conversion":74.10}',
  '{"gads_customer_id":"6952791370","direct_billed":true,"source":"GAQL campaign metrics + conversion_action_name","pulled":"2026-11-12"}',
  '2026-11-25','approved','Robbie','2026-11-12', NULL
WHERE NOT EXISTS (SELECT 1 FROM client_verdicts WHERE client_id='client-1779886732403-kjn1sl5yb' AND period='2026-11' AND subject_key='gads:23624876395' AND status!='superseded');

INSERT INTO client_verdicts
  (client_id, period, subject_type, subject_key, subject_name, verdict, reason, action,
   window_start, window_end, metrics, provenance, recheck_date, status, note)
SELECT 'client-1779886732403-kjn1sl5yb','2026-11','service','gbp:locations/12396021211205817777','Google Business Profile (one pinned location)','fix',
  'Seen more, chosen less: views up, calls and website clicks down against the prior 30 days. Over 60 days calls are up.',
  'Find why fewer viewers act. Pin the other locations: the record names Columbia, Greenville and Gastonia profiles and only one is read.',
  '2026-10-10','2026-11-08',
  '{"calls":45,"calls_prior":53,"website_clicks":96,"website_clicks_prior":123,"directions":48,"directions_prior":57,"impressions":1810,"impressions_prior":1525,"calls_60d":98,"calls_60d_prior":70}',
  '{"source":"gbp-intelligence /internal/gbp-insights","location":"locations/12396021211205817777","days":[30,60],"pulled":"2026-11-12"}',
  '2026-12-12','proposed',
  'Not yet approved by Robbie. No same-month-last-year figure pulled.'
WHERE NOT EXISTS (SELECT 1 FROM client_verdicts WHERE client_id='client-1779886732403-kjn1sl5yb' AND period='2026-11' AND subject_key='gbp:locations/12396021211205817777' AND status!='superseded');

INSERT INTO client_verdicts
  (client_id, period, subject_type, subject_key, subject_name, verdict, reason, action,
   window_start, window_end, metrics, provenance, recheck_date, status, note)
SELECT 'client-1779886732403-kjn1sl5yb','2026-11','service','seo','SEO','fix',
  'Clicks on the homepage and location pages about halved since the week of the 2026-08-04 site move. Visibility has slid since June 2026, but about 60% of that is one article that never sent traffic.',
  'Establish why the homepage and location pages lost clicks. Check the Charleston Business Profile link. Compare Oct 2025 by page to separate season from loss.',
  '2026-10-10','2026-11-08',
  '{"impressions":33120,"impressions_prior_30d":33772,"impressions_same_30d_last_year":59547,"clicks":299,"clicks_prior_30d":332,"clicks_same_30d_last_year":440,"homepage_clicks":{"2026-05":115,"2026-07":111,"2026-10":54},"location_pages_clicks":{"2026-05":273,"2026-07":243,"2026-10":190}}',
  '{"source":"Search Console searchAnalytics, sc-domain:punchlistpros.com, property totals and by page","pulled":"2026-11-12"}',
  '2026-12-12','proposed',
  'Not yet approved by Robbie. Cause not established; the move is likely by timing only. Full SEO verdict recheck 2027-02-10 (90-day window).'
WHERE NOT EXISTS (SELECT 1 FROM client_verdicts WHERE client_id='client-1779886732403-kjn1sl5yb' AND period='2026-11' AND subject_key='seo' AND status!='superseded');
