-- 2026-11-13 Robbie's decision: the cost per lead bar is measured on ALL conversions
-- (calls and forms), which is what the full-report harness counts. The $45 number is
-- unchanged. The first PLP line recorded the bar against primary conversions ($43.37 on
-- 112); a line is never edited in place, so that row is superseded and a new one carries
-- the basis. Idempotent.

UPDATE client_success_line SET status = 'superseded'
 WHERE client_id = 'client-1779886732403-kjn1sl5yb' AND scope = 'Google Ads, Columbia'
   AND status = 'approved' AND cpl_lead_def NOT LIKE '%all conversions%';

INSERT INTO client_success_line
  (client_id, scope, line_text, unit, per, start_value, start_per, start_basis, target_value, target_date,
   outcome_source, outcome_action, outcome_filter, cpl_bar, cpl_lead_def, cpl_actual, benchmark_value,
   benchmark_key, status, approved_by, approved_at, provenance, open_questions, supersedes_id)
SELECT client_id, scope, line_text, unit, per, start_value, start_per, start_basis, target_value, target_date,
   outcome_source, outcome_action, outcome_filter, 45,
   'Calls and forms, ALL conversions basis (Phone Call + Calls From Ads + Form Capture), as the full-report harness counts them',
   38.90, benchmark_value, benchmark_key, 'approved', 'Robbie', approved_at,
   '{"gads_customer_id":"6952791370","direct_billed":true,"window":"2026-10-14..2026-11-12","spend":4862.94,"calls_and_forms_all_conversions":125.0,"pulled":"2026-11-13","source":"full-report harness, STEP 4 block","basis_decided":"2026-11-13","earlier_basis":"primary conversions: $43.37 on 112, window 2026-10-13..2026-11-11"}',
   open_questions, id
  FROM client_success_line
 WHERE client_id = 'client-1779886732403-kjn1sl5yb' AND scope = 'Google Ads, Columbia' AND status = 'superseded'
   AND NOT EXISTS (SELECT 1 FROM client_success_line
                    WHERE client_id = 'client-1779886732403-kjn1sl5yb' AND scope = 'Google Ads, Columbia'
                      AND status = 'approved')
 ORDER BY id DESC LIMIT 1;
