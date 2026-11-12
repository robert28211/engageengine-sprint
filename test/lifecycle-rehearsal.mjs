import { getPlatformProxy } from "wrangler";
const S = process.argv[2];
const { env, dispose } = await getPlatformProxy({ configPath: new URL("../wrangler.toml", import.meta.url).pathname, persist: { path: S + "/d1/v3/v3" } });
const m = await import(S + "/w.mjs");  // copy of src/worker.js with test exports appended by run-lifecycle-rehearsal.sh
const q = async (sql, ...b) => (await env.DB.prepare(sql).bind(...b).all()).results;
const ok = (name, cond, extra = "") => console.log((cond ? "PASS " : "FAIL ") + name, extra);
// 1. dry-run generation
const dry = await m.G(env, { dry_run: true });
const would = dry.filter(r => r.action === "would_create");
const perT = {}; for (const r of would) perT[r.template] = (perT[r.template] || 0) + 1;
console.log("would_create by template:", JSON.stringify(perT));
ok("firm chores only once", (perT["Daily Ops (firm-wide)"] || 0) <= 1 && (perT["Weekly Ops (firm-wide)"] || 0) <= 1);
const hostOnly = would.filter(r => ["Howser Newman & Besley","803 Realty","Sharpe Customs","Genesis Pro Painting"].includes(r.client));
ok("hosting-only clients get nothing", hostOnly.length === 0, hostOnly.length);
// 2. real generation, idempotent
const g1 = await m.G(env, {}); const g2 = await m.G(env, {});
ok("generation idempotent", g2.filter(r => r.action === "created").length === 0, "created first run=" + g1.filter(r => r.action === "created").length);
// 3. board
const bj = await (await m.B(new Request("http://x/api/routine/board"), env)).json();
ok("board loads", Array.isArray(bj.clients), "clients=" + bj.clients.length + " uncovered=" + bj.uncovered.length + " missedTotal=" + bj.missedTotal);
ok("firm row first", bj.clients[0] && bj.clients[0].firm === true, bj.clients[0] && bj.clients[0].name);
// 4. reaper: make a fake superseded monthly job with 2 open + 1 blocked task, then a newer generation
const cid = (await q("SELECT id FROM sprint_clients WHERE on_routine=1 AND archived=0 AND name!='Marketing Performance' LIMIT 1"))[0].id;
await env.DB.batch([
  env.DB.prepare("INSERT INTO sprint_jobs (id, client_id, name, status, assigned_to, due_date, created_at, updated_at) VALUES ('job-old',?, 'Monthly Report — 2026-10','Active','','2026-10-30',date('now'),date('now'))").bind(cid),
  env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at) VALUES ('t-a','job-old',?, 'rt-monthly-report-t01','a','Not Started','','2026-10-30',date('now'),date('now'))").bind(cid),
  env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at) VALUES ('t-b','job-old',?, 'rt-monthly-report-t02','b','Not Started','','2026-10-30',date('now'),date('now'))").bind(cid),
  env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, blocked_by, created_at, updated_at) VALUES ('t-c','job-old',?, 'rt-monthly-report-t03','c','Not Started','','2026-10-30','Client',date('now'),date('now'))").bind(cid),
  env.DB.prepare("INSERT INTO routine_generation (rowid, template_id, client_id, period_key, job_id) VALUES (-5, 'rt-monthly-report', ?, '2026-10-TEST', 'job-old')").bind(cid),
]);
// newer generation for same template/client must exist (rowid higher): insert a marker
const rp = await m.R(env);
const left = await q("SELECT id FROM sprint_tasks WHERE job_id='job-old' ORDER BY id");
const missed = await q("SELECT summary FROM client_activity WHERE client_id=? AND kind='missed' AND tool='routine:rt-monthly-report'", cid);
ok("reaper keeps blocked, deletes open", left.map(r => r.id).join(",") === "t-c", JSON.stringify(left));
ok("reaper records missed row", missed.length === 1, missed[0] && missed[0].summary);
const rp2 = await m.R(env);
ok("reaper does not double-record", (await q("SELECT COUNT(*) n FROM client_activity WHERE client_id=? AND kind='missed'", cid))[0].n === 1, JSON.stringify(rp2));
// 5. ingest auto-close scoping
env.INTERNAL_AUDIT_SECRET = "s";
const post = async (body) => (await m.I(new Request("http://x", { method: "POST", headers: { "X-Internal-Secret": "s" }, body: JSON.stringify(body) }), env)).json();
const cur = (await q("SELECT st.id FROM sprint_tasks st JOIN routine_generation rg ON rg.job_id=st.job_id WHERE st.client_id=? AND rg.template_id='rt-monthly-report' AND st.task_id='rt-monthly-report-t01' AND st.status!='Complete' AND rg.period_key='2026-11'", cid))[0];
ok("current monthly full_report step exists", !!cur);
const r1 = await post({ client_id: cid, tool: "full_report", kind: "report", occurred_at: "2026-09-15" });
ok("backdated row closes nothing", r1.auto_completed === 0 && r1.auto_skipped === "occurred_at", JSON.stringify(r1));
const r2 = await post({ client_id: cid, tool: "full_report", kind: "error" });
ok("error row closes nothing", r2.auto_completed === 0 && r2.auto_skipped === "kind", JSON.stringify(r2));
await env.DB.prepare("UPDATE sprint_tasks SET blocked_by='Client' WHERE id=?").bind(cur.id).run();
const r3 = await post({ client_id: cid, tool: "full_report", kind: "report" });
const after = (await q("SELECT status, blocked_by FROM sprint_tasks WHERE id=?", cur.id))[0];
ok("fresh row closes current step + clears blocked", r3.auto_completed >= 1 && after.status === "Complete" && !after.blocked_by, JSON.stringify(r3) + JSON.stringify(after));
// firm daily adcheck step closes from a client adcheck post
const r4 = await post({ client_id: cid, tool: "adcheck", kind: "pulse" });
const firmDone = await q("SELECT st.status FROM sprint_tasks st JOIN routine_generation rg ON rg.job_id=st.job_id JOIN sprint_clients c ON c.id=st.client_id WHERE rg.template_id='rt-daily' AND c.name='Marketing Performance' AND st.task_id='rt-daily-t01' ORDER BY rg.rowid DESC LIMIT 1");
ok("client adcheck post ticks firm daily adcheck step", firmDone[0] && firmDone[0].status === "Complete", JSON.stringify(r4));
// 6. roster gads id coalesce
env.ROSTER_READ_SECRET = "s";
const ro = await (await m.RO(new Request("http://x", { headers: { "X-Internal-Secret": "s" } }), env)).json();
ok("roster returns gads ids from client_platform_ids", ro.clients.filter(c => c.google_ads_customer_id).length > 0, "with id=" + ro.clients.filter(c => c.google_ads_customer_id).length + "/" + ro.count);
// 7. archive cascade on a test client
const tc = "client-test-archive";
await env.DB.batch([
  env.DB.prepare("INSERT INTO sprint_clients (id, name, status, has_sprint, archived, notes, stage, on_routine, created_at, updated_at) VALUES (?, 'ZZ Test Client','Active',0,0,'','routine',1,date('now'),date('now'))").bind(tc),
  env.DB.prepare("INSERT INTO client_services (id, client_id, service, status) VALUES ('cs-zz-1', ?, 'gads','active')").bind(tc),
  env.DB.prepare("INSERT INTO client_services (id, client_id, service, status) VALUES ('cs-zz-2', ?, 'website','B')").bind(tc),
]);
await m.G(env, { client_id: tc });
const openBefore = (await q("SELECT COUNT(*) n FROM sprint_tasks WHERE client_id=? AND status='Not Started'", tc))[0].n;
const aj = await (await m.A(new Request("http://x", { method: "POST" }), env, tc)).json();
const cl = (await q("SELECT archived, on_routine, stage FROM sprint_clients WHERE id=?", tc))[0];
const sv = await q("SELECT service, status FROM client_services WHERE client_id=? ORDER BY service", tc);
const openAfter = (await q("SELECT COUNT(*) n FROM sprint_tasks WHERE client_id=? AND status='Not Started'", tc))[0].n;
const p4 = await q("SELECT j.name, (SELECT COUNT(*) FROM sprint_tasks t WHERE t.job_id=j.id) n, (SELECT name FROM sprint_clients WHERE id=j.client_id) owner FROM sprint_jobs j WHERE j.id=?", aj.offboard_job_id || "");
ok("archive: flags", cl.archived === 1 && cl.on_routine === 0 && cl.stage === "former", JSON.stringify(cl));
ok("archive: services", JSON.stringify(sv) === JSON.stringify([{ service: "gads", status: "cancelled" }, { service: "website", status: "B" }]), JSON.stringify(sv));
ok("archive: routine steps cleared", openBefore > 0 && openAfter === 0, openBefore + "->" + openAfter);
ok("archive: P4 job on firm record", p4[0] && p4[0].n === 9 && p4[0].owner === "Marketing Performance", JSON.stringify(p4[0]));
const aj2 = await (await m.A(new Request("http://x", { method: "POST" }), env, tc)).json();
ok("archive twice is a no-op", aj2.already === true);
// 8. graduate -> routine
const gc = "client-test-grad";
await env.DB.batch([
  env.DB.prepare("INSERT INTO sprint_clients (id, name, status, has_sprint, archived, notes, stage, on_routine, created_at, updated_at) VALUES (?, 'ZZ Grad Client','Active',1,0,'','sprint',0,date('now'),date('now'))").bind(gc),
  env.DB.prepare("INSERT INTO client_services (id, client_id, service, status) VALUES ('cs-zg-1', ?, 'seo','active')").bind(gc),
]);
const dj = await (await m.D(new Request("http://x", { method: "POST", body: JSON.stringify({ client_id: gc }) }), env)).json();
const g = (await q("SELECT has_sprint, on_routine, stage FROM sprint_clients WHERE id=?", gc))[0];
ok("graduate moves onto Routine + generates", g.on_routine === 1 && g.stage === "routine" && g.has_sprint === 0 && dj.routine_cycles_created > 0, JSON.stringify(dj));
await dispose();
