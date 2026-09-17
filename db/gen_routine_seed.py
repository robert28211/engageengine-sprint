#!/usr/bin/env python3
import os
# Generates the EngageEngine client-operating-routine seed for the Sprint Tracker.
# Emits idempotent SQL: clears prior routine rows (id prefix 'rt-') then re-inserts.

# Each template: (id, name, cadence, applies_when, sort_order, [tasks])
# cadence: once | daily | weekly | monthly | 45day
# applies_when: comma list of client_services keys, or '' = all clients
# task: (notes, role, tool_key)
TEMPLATES = [
 ("rt-p0-onboard", "P0 · Onboarding", "once", "", 10, [
   ("Send onboarding wizard link + intake form to client", "Staff", ""),
   ("Request/verify GA4 + Google Ads access (goes to marketingperformancemcc@gmail.com)", "Staff", ""),
   ("Verify Google Search Console access (add user or DNS TXT) — REQUIRED before SEO baseline", "Staff", ""),
   ("Verify Google Business Profile manager access", "Staff", ""),
   ("Verify Meta ad account + Page access", "Staff", ""),
   ("Set up client in Vendasta + run the Snapshot Report (feeds Phase 1 baseline)", "Staff", ""),
   ("Add paid Vendasta modules per the client's retainer tier", "Staff", ""),
   ("Add client to the 30-Day Sprint (status Active)", "Staff", ""),
   ("Add client to Services page canonical list + set service flags on", "Staff", ""),
   ("Write ALL new IDs/keys to the Credentials Index (same session)", "Robbie", ""),
   ("Register client in clients.json, CLAUDE.md registry, and Second Brain", "Robbie", ""),
   ("GATE: confirm every access box is green before starting Phase 1", "Robbie", ""),
 ]),
 ("rt-p1-baseline", "P1 · Baseline & Diagnose", "once", "", 20, [
   ("Read the Vendasta Snapshot first — it frames the whole diagnosis", "Robbie", ""),
   ("Run GBP baseline analysis (profile health, calls/directions/website-clicks, review velocity)", "Staff", "gbp"),
   ("Run DVS — Demand Visibility Score (AI-era visibility + retrievability)", "Staff", "dvs"),
   ("Run /demand-collapse-diagnostic — core 'what's broken' read", "Robbie", "dcd"),
   ("Run /ads-audit if inheriting an existing Google Ads account", "Staff", "ads-audit"),
   ("Run /toprank:seo-analysis — SEO baseline (needs GSC connected)", "Staff", "seo_analysis"),
   ("Run /page-cro on the money/landing pages", "Staff", "page-analyzer"),
   ("Assemble the internal diagnostic doc → the campaign plan comes from THIS", "Robbie", ""),
 ]),
 ("rt-p2-build", "P2 · Build & Launch", "once", "", 30, [
   ("Build campaigns (Google/Meta) per the plan", "Staff", ""),
   ("Install/verify pixel + conversion tracking", "Staff", ""),
   ("Wire form → conversion event — DO NOT launch until it fires", "Staff", ""),
   ("Turn on the intent pipeline (audience → Meta targeting + Vendasta CRM)", "Staff", ""),
   ("Stand up Vendasta social calendar; connect profiles; enable auto-post to client GBP", "Creative", ""),
   ("Provision portal / deliverables hub if the client gets one", "Staff", ""),
   ("GATE: confirm the conversion fires before any spend goes live", "Robbie", ""),
 ]),
 ("rt-seo", "SEO Track", "monthly", "seo", 40, [
   ("Re-pull GSC + rankings; diff vs baseline (what moved, what's stuck)", "Staff", "seo_analysis"),
   ("Check & pull new articles/reports from the desktop SEO tool", "Staff", ""),
   ("Send SEO article/deliverable for client approval", "Staff", ""),
   ("On approval → post to the client website", "Staff", ""),
   ("Report SEO progress to client (what published + ranking impact)", "Staff", ""),
   ("Extract recommendations → ticket the implementation work", "Staff", ""),
   ("Implement fixes; verify they landed next cycle (Implementation Rule)", "Staff", ""),
 ]),
 ("rt-social", "Social Track", "weekly", "social", 50, [
   ("Build/refresh the social calendar in Vendasta", "Creative", ""),
   ("Route the calendar for CLIENT approval (Robbie approves too, depending on client)", "Robbie", ""),
   ("Publish approved posts (including to client GBP)", "Creative", ""),
   ("Verify GBP posting actually succeeded", "Staff", ""),
   ("Log reviews / reputation activity for the weekly check", "Staff", ""),
 ]),
 ("rt-cro", "CRO · 45-Day Pass", "45day", "website", 60, [
   ("Run /page-cro on the primary money pages", "Staff", "page-analyzer"),
   ("Run /form-cro on the lead forms", "Staff", ""),
   ("Ticket + implement the CRO fixes", "Staff", ""),
   ("Verify changes are live + measure the lift", "Staff", ""),
 ]),
 ("rt-ads", "Ads Management", "monthly", "gads,meta", 70, [
   ("Run /ads-audit (30-day + MoM comparison)", "Staff", "ads-audit"),
   ("Action quick wins the same week (negatives, budget, bids)", "Staff", ""),
   ("Ticket the bigger structural changes", "Staff", ""),
   ("Verify no conversion-tracking regressions after changes", "Staff", ""),
 ]),
 ("rt-daily", "Daily Ops (all clients)", "daily", "", 80, [
   ("Run `/adcheck top` daily (top-spender Google Ads pulse); full `/adcheck` sweep (all clients + Meta + GA4) Mon/Wed/Fri — act on flags only", "Staff", "adcheck"),
   ("Run /morning inbox sweep → today's action items", "Staff", ""),
   ("Lead-recap → Neo Drafts (never auto-sends)", "Staff", ""),
   ("Verify the intent pipeline ran today", "Staff", ""),
 ]),
 ("rt-weekly", "Weekly Ops (all clients)", "weekly", "", 90, [
   ("Vendasta check: social calendar + reviews + citations (pull via API)", "Staff", ""),
   ("Weekly LEADS recap (leads + pixel + Top-5 prospects + calls)", "Staff", ""),
 ]),
 ("rt-weeklyemail", "Weekly Recap Email", "weekly", "weekly_email", 95, [
   ("Run /weekly-emails harness (roster = client_services)", "Robbie", "weekly_email"),
   ("Review/elevate drafts; gate on a sample before push", "Robbie", ""),
 ]),
 ("rt-monthly-report", "Monthly Report", "monthly", "", 100, [
   ("Run /full_report for the client", "Staff", "full_report"),
   ("Run /contact_events ledger for the period", "Staff", "contact_events"),
   ("Attach Vendasta premium reports (Reviews + Social Usage + Web Chat) — Vendasta clients", "Staff", ""),
   ("GBP monthly pulse (calls/directions/clicks trend, reviews, completeness)", "Staff", "gbp"),
   ("Apply /mpgstyle · NO dollar figures · EngageEngine™ tag · 'Powered by EngageEngine™'", "Robbie", ""),
   ("Deliver the report to the client", "Robbie", ""),
 ]),
 ("rt-rediagnose", "Re-Diagnose (loop back)", "monthly", "", 110, [
   ("Re-run /ads-audit + DVS + /demand-collapse-diagnostic", "Robbie", ""),
   ("Diff vs the Phase-1 baseline and last cycle", "Robbie", ""),
   ("Optimize (pause losers, reallocate, new creative) → feed the next build sprint", "Robbie", ""),
 ]),
]

def esc(s):
    return s.replace("'", "''")

lines = []
lines.append("-- EngageEngine Client Operating Routine — Sprint Tracker seed")
lines.append("DELETE FROM sprint_template_tasks WHERE template_id LIKE 'rt-%';")
lines.append("DELETE FROM sprint_templates WHERE id LIKE 'rt-%';")
for tid, name, cadence, applies, sort, tasks in TEMPLATES:
    cat = {"once":"Lifecycle","daily":"Daily","weekly":"Weekly","monthly":"Monthly","45day":"45-Day"}[cadence]
    lines.append(
      f"INSERT INTO sprint_templates (id,name,category,sort_order,cadence,applies_when,is_routine) "
      f"VALUES ('{tid}','{esc(name)}','{cat}',{sort},'{cadence}','{applies}',1);"
    )
    for i,(notes,role,tool) in enumerate(tasks):
        ttid = f"{tid}-t{i+1:02d}"
        lines.append(
          f"INSERT INTO sprint_template_tasks (id,template_id,notes,assigned_to_role,sort_order,tool_key) "
          f"VALUES ('{ttid}','{tid}','{esc(notes)}','{role}',{i+1},'{tool}');"
        )
sql = "\n".join(lines) + "\n"
open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"routine_seed.sql"),"w").write(sql)
n_t = len(TEMPLATES); n_tasks = sum(len(t[5]) for t in TEMPLATES)
print(f"Generated {n_t} templates, {n_tasks} tasks -> routine_seed.sql")
