var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
async function makeToken(secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("ee-sprint-session"));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
__name(makeToken, "makeToken");
async function isValidToken(secret, token) {
  try {
    const expected = await makeToken(secret);
    return token === expected;
  } catch {
    return false;
  }
}
__name(isValidToken, "isValidToken");
function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}
__name(getCookie, "getCookie");
async function authMiddleware(request, env) {
  const token = getCookie(request, "session");
  if (!token)
    return false;
  try {
    return await isValidToken(env.APP_PASSWORD, token);
  } catch {
    return false;
  }
}
__name(authMiddleware, "authMiddleware");
function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
__name(genId, "genId");
function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra }
  });
}
__name(json, "json");
function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location } });
}
__name(redirect, "redirect");
var ROUTES = [
  { method: "POST", re: /^\/api\/auth\/login$/, handler: handleLogin, public: true },
  { method: "GET", re: /^\/api\/dashboard$/, handler: handleDashboard },
  { method: "GET", re: /^\/api\/clients$/, handler: handleClientsList },
  { method: "POST", re: /^\/api\/clients$/, handler: handleClientCreate },
  { method: "GET", re: /^\/api\/clients\/([^/]+)$/, handler: (r, e, m) => handleClientGet(r, e, m[1]) },
  { method: "PUT", re: /^\/api\/clients\/([^/]+)$/, handler: (r, e, m) => handleClientUpdate(r, e, m[1]) },
  { method: "POST", re: /^\/api\/clients\/([^/]+)\/archive$/, handler: (r, e, m) => handleClientArchive(r, e, m[1]) },
  { method: "PUT", re: /^\/api\/clients\/([^/]+)\/notes$/, handler: (r, e, m) => handleClientNotes(r, e, m[1]) },
  { method: "GET", re: /^\/api\/team$/, handler: handleTeamList },
  { method: "POST", re: /^\/api\/team$/, handler: handleTeamCreate },
  { method: "DELETE", re: /^\/api\/team\/([^/]+)$/, handler: (r, e, m) => handleTeamDelete(r, e, m[1]) },
  { method: "GET", re: /^\/api\/team\/([^/]+)$/, handler: (r, e, m) => handleTeamMember(r, e, m[1]) },
  { method: "POST", re: /^\/api\/logs$/, handler: handleLogCreate },
  { method: "DELETE", re: /^\/api\/logs\/([^/]+)$/, handler: (r, e, m) => handleLogDelete(r, e, m[1]) },
  { method: "GET", re: /^\/api\/templates$/, handler: handleTemplatesList },
  { method: "POST", re: /^\/api\/jobs$/, handler: handleJobCreate },
  { method: "POST", re: /^\/api\/jobs\/([^/]+)\/complete$/, handler: (r, e, m) => handleJobStatus(r, e, m[1], "Complete") },
  { method: "POST", re: /^\/api\/jobs\/([^/]+)\/reopen$/, handler: (r, e, m) => handleJobStatus(r, e, m[1], "Active") },
  { method: "POST", re: /^\/api\/jobs\/([^/]+)\/assign$/, handler: (r, e, m) => handleJobAssign(r, e, m[1]) },
  { method: "PUT", re: /^\/api\/jobs\/([^/]+)$/, handler: (r, e, m) => handleJobUpdate(r, e, m[1]) },
  { method: "POST", re: /^\/api\/tasks$/, handler: handleTaskCreate },
  { method: "PUT", re: /^\/api\/tasks\/([^/]+)$/, handler: (r, e, m) => handleTaskUpdate(r, e, m[1]) },
  { method: "DELETE", re: /^\/api\/tasks\/([^/]+)$/, handler: (r, e, m) => handleTaskDelete(r, e, m[1]) },
  { method: "POST", re: /^\/api\/tasks\/([^/]+)\/complete$/, handler: (r, e, m) => handleTaskStatus(r, e, m[1], "Complete") },
  { method: "POST", re: /^\/api\/tasks\/([^/]+)\/reopen$/, handler: (r, e, m) => handleTaskStatus(r, e, m[1], "Not Started") },
  { method: "GET", re: /^\/api\/sprint\/([^/]+)$/, handler: (r, e, m) => handleSprintGet(r, e, m[1]) },
  { method: "POST", re: /^\/api\/sprint\/toggle$/, handler: handleSprintToggle },
  { method: "POST", re: /^\/api\/sprint\/activate$/, handler: handleSprintActivate },
  { method: "POST", re: /^\/api\/sprint\/deactivate$/, handler: handleSprintDeactivate },
  // Routine engine — recurring per-client operating loop (cadence-driven)
  { method: "POST", re: /^\/api\/routine\/generate$/, handler: handleRoutineGenerate },
  { method: "GET", re: /^\/api\/routine\/status$/, handler: handleRoutineStatus },
  { method: "GET", re: /^\/api\/routine\/board$/, handler: handleRoutineBoard },
  { method: "GET", re: /^\/api\/routine\/job\/([^/]+)\/tasks$/, handler: (r, e, m) => handleRoutineJobTasks(r, e, m[1]) },
  { method: "POST", re: /^\/api\/routine\/client\/([^/]+)\/toggle$/, handler: (r, e, m) => handleRoutineClientToggle(r, e, m[1]) },
  // Gmail OAuth
  { method: "GET", re: /^\/api\/gmail\/auth$/, handler: handleGmailAuth },
  { method: "GET", re: /^\/api\/gmail\/callback$/, handler: handleGmailCallback, public: true },
  { method: "GET", re: /^\/api\/gmail\/status$/, handler: handleGmailStatus },
  { method: "POST", re: /^\/api\/gmail\/poll$/, handler: handleGmailPollNow },
  // AI Intake
  { method: "GET", re: /^\/api\/intake$/, handler: handleIntakeList },
  { method: "POST", re: /^\/api\/intake\/upload$/, handler: handleIntakeUpload },
  { method: "POST", re: /^\/api\/intake\/chat$/, handler: handleIntakeChat },
  { method: "POST", re: /^\/api\/intake\/([^/]+)\/confirm$/, handler: (r, e, m) => handleIntakeConfirm(r, e, m[1]) },
  { method: "POST", re: /^\/api\/intake\/([^/]+)\/dismiss$/, handler: (r, e, m) => handleIntakeDismiss(r, e, m[1]) },
  { method: "POST", re: /^\/api\/intake\/([^/]+)\/save-as-note$/, handler: (r, e, m) => handleIntakeSaveAsNote(r, e, m[1]) },
  { method: "POST", re: /^\/api\/intake\/bulk-dismiss$/, handler: handleIntakeBulkDismiss },
  { method: "POST", re: /^\/api\/assistant$/, handler: handleAssistant },
  // All Work
  { method: "GET", re: /^\/api\/allwork$/, handler: handleAllWork },
  // Client Ad Portal — public (token-authenticated)
  { method: "GET", re: /^\/api\/portal\/([a-zA-Z0-9-]+)\/data$/, handler: (r, e, m) => handlePortalData(r, e, m[1]), public: true },
  { method: "GET", re: /^\/api\/clients\/([^/]+)\/portal-token$/, handler: (r, e, m) => handlePortalTokenGet(r, e, m[1]) },
  { method: "POST", re: /^\/api\/clients\/([^/]+)\/portal-token$/, handler: (r, e, m) => handlePortalTokenCreate(r, e, m[1]) },
  { method: "DELETE", re: /^\/api\/clients\/([^/]+)\/portal-token$/, handler: (r, e, m) => handlePortalTokenRevoke(r, e, m[1]) },
  { method: "POST", re: /^\/api\/internal\/push-ad-data$/, handler: handlePushAdData, public: true },
  // Ads Audit engine (called by app-engageengine hub with X-Internal-Secret)
  { method: "GET", re: /^\/api\/internal\/audit\/clients$/, handler: handleAuditClients, public: true },
  { method: "GET", re: /^\/api\/internal\/audit\/([^/]+)\/latest$/, handler: (r, e, m) => handleAuditLatest(r, e, m[1]), public: true },
  { method: "POST", re: /^\/api\/internal\/audit\/([^/]+)$/, handler: (r, e, m) => handleAuditRun(r, e, m[1]), public: true },
  // Client roster (shared source for suppression + client pickers across the tool suite; X-Internal-Secret gated)
  { method: "GET", re: /^\/api\/internal\/roster$/, handler: handleRoster, public: true },
  // Client activity spine — ingest (X-Internal-Secret gated) + per-client timeline (session gated)
  { method: "POST", re: /^\/api\/internal\/activity$/, handler: handleActivityIngest, public: true },
  { method: "GET", re: /^\/api\/clients\/([^/]+)\/activity$/, handler: (r, e, m) => handleClientActivity(r, e, m[1]) },
  // Firm-wide cross-client activity feed (session gated)
  { method: "GET", re: /^\/api\/activity$/, handler: handleActivityFeed },
  // Cloud-agent status feed — reads agent_launches (shared command-center D1, written by engageengine-agents worker)
  { method: "GET", re: /^\/api\/agents$/, handler: handleAgentsFeed },
  // Outcome loop — activities due for review + record what actually happened (session gated)
  { method: "GET", re: /^\/api\/activity\/due$/, handler: handleActivityDue },
  { method: "POST", re: /^\/api\/activity\/([0-9]+)\/outcome$/, handler: (r, e, m) => handleActivityOutcome(r, e, m[1]) },
  // Services & Maintenance
  { method: "GET", re: /^\/api\/services$/, handler: handleServicesList, readKey: true },
  { method: "PATCH", re: /^\/api\/services\/([^/]+)\/([^/]+)$/, handler: (r, e, m) => handleServiceUpdate(r, e, m[1], m[2]) },
  { method: "GET", re: /^\/api\/maintenance$/, handler: handleMaintenanceList },
  { method: "GET", re: /^\/api\/maintenance\/wp\/([^/]+)$/, handler: (r, e, m) => handleMaintenanceWp(r, e, m[1]) },
  { method: "GET", re: /^\/api\/maintenance\/seo\/([^/]+)$/, handler: (r, e, m) => handleMaintenanceSeo(r, e, m[1]) },
  { method: "PATCH", re: /^\/api\/clients\/([^/]+)\/maintenance$/, handler: (r, e, m) => handleClientMaintenance(r, e, m[1]) },
  { method: "PATCH", re: /^\/api\/clients\/([^/]+)\/domain$/, handler: (r, e, m) => handleClientDomain(r, e, m[1]) },
  // Client Health
  { method: "GET", re: /^\/api\/client-health$/, handler: handleClientHealth }
];
async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!env.APP_PASSWORD || body.password !== env.APP_PASSWORD) {
    return json({ error: "Incorrect password" }, 401);
  }
  const token = await makeToken(env.APP_PASSWORD);
  const cookie = `session=${token}; HttpOnly; SameSite=Lax; Max-Age=604800; Path=/`;
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}
__name(handleLogin, "handleLogin");
async function handleDashboard(request, env) {
  const clients = await env.DB.prepare(`
    SELECT c.id, c.name, c.status, c.has_sprint, c.archived,
      COUNT(DISTINCT j.id) as active_jobs,
      COUNT(DISTINCT CASE WHEN t.status = 'Not Started' THEN t.id END) as open_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'Complete' THEN t.id END) as done_tasks,
      COUNT(DISTINCT CASE WHEN t.status='Not Started' AND t.due_date < date('now') THEN t.id END) +
        COUNT(DISTINCT CASE WHEN j.status='Active' AND j.due_date != '' AND j.due_date < date('now') THEN j.id END) as overdue_tasks,
      COUNT(DISTINCT CASE WHEN t.status='Not Started' AND t.due_date BETWEEN date('now') AND date('now','+3 days') THEN t.id END) +
        COUNT(DISTINCT CASE WHEN j.status='Active' AND j.due_date != '' AND j.due_date BETWEEN date('now') AND date('now','+3 days') THEN j.id END) as soon_tasks
    FROM sprint_clients c
    LEFT JOIN sprint_jobs j ON j.client_id = c.id AND j.status = 'Active'
    LEFT JOIN sprint_tasks t ON t.client_id = c.id
    WHERE c.archived = 0
    GROUP BY c.id
    ORDER BY active_jobs DESC, c.name
  `).all();
  const stats = await env.DB.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sprint_clients WHERE status='Active' AND archived=0) as active_clients,
      (SELECT COUNT(*) FROM sprint_jobs WHERE status='Active') as active_jobs,
      (SELECT COUNT(*) FROM sprint_tasks WHERE status='Not Started') as open_tasks,
      (SELECT COUNT(*) FROM sprint_tasks WHERE status='Complete') as done_tasks
  `).first();
  const team = await env.DB.prepare(`
    SELECT tm.id, tm.name, tm.role,
      COUNT(DISTINCT t.id) as assigned_tasks
    FROM sprint_team tm
    LEFT JOIN sprint_tasks t ON LOWER(t.assigned_to) = LOWER(tm.name) AND t.status = 'Not Started'
    GROUP BY tm.id
    ORDER BY tm.name
  `).all();
  const briefing = await env.DB.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN t.status='Not Started' AND t.due_date < date('now') THEN t.id END) +
        COUNT(DISTINCT CASE WHEN j.status='Active' AND j.due_date != '' AND j.due_date < date('now') THEN j.id END) as overdue,
      COUNT(DISTINCT CASE WHEN t.status='Not Started' AND t.due_date = date('now') THEN t.id END) +
        COUNT(DISTINCT CASE WHEN j.status='Active' AND j.due_date != '' AND j.due_date = date('now') THEN j.id END) as due_today
    FROM sprint_tasks t
    JOIN sprint_clients c ON c.id = t.client_id
    LEFT JOIN sprint_jobs j ON j.client_id = c.id
    WHERE c.archived = 0
  `).first();
  let intake_pending = 0;
  try {
    const ip = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM sprint_intake WHERE status='pending'`
    ).first();
    intake_pending = ip?.cnt || 0;
  } catch {
  }
  return json({ clients: clients.results, stats, team: team.results, briefing, intake_pending });
}
__name(handleDashboard, "handleDashboard");
async function handleAllWork(request, env) {
  const jobs = await env.DB.prepare(`
    SELECT j.id, j.name, j.status, j.created_at, j.assigned_to, j.due_date,
      c.id as client_id, c.name as client_name,
      COUNT(DISTINCT CASE WHEN t.status = 'Not Started' THEN t.id END) as open_tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'Complete' THEN t.id END) as done_tasks,
      COUNT(DISTINCT t.id) as total_tasks
    FROM sprint_jobs j
    JOIN sprint_clients c ON c.id = j.client_id
    LEFT JOIN sprint_tasks t ON t.job_id = j.id
    WHERE c.archived = 0 AND j.status = 'Active'
    GROUP BY j.id
    ORDER BY c.name, j.name
  `).all();
  const tasks = await env.DB.prepare(`
    SELECT t.id, t.notes as name, t.status, t.due_date, t.assigned_to,
      j.id as job_id, j.name as job_name,
      c.id as client_id, c.name as client_name
    FROM sprint_tasks t
    JOIN sprint_jobs j ON j.id = t.job_id
    JOIN sprint_clients c ON c.id = t.client_id
    WHERE t.status = 'Not Started' AND c.archived = 0
    ORDER BY t.due_date ASC, c.name, j.name, t.notes
  `).all();
  return json({ jobs: jobs.results, tasks: tasks.results });
}
__name(handleAllWork, "handleAllWork");
async function handleClientsList(request, env) {
  const clients = await env.DB.prepare(
    `SELECT * FROM sprint_clients WHERE archived=0 ORDER BY name`
  ).all();
  return json(clients.results);
}
__name(handleClientsList, "handleClientsList");
async function handleClientGet(request, env, clientId) {
  const client = await env.DB.prepare("SELECT * FROM sprint_clients WHERE id=?").bind(clientId).first();
  if (!client)
    return json({ error: "Not found" }, 404);
  const jobs = await env.DB.prepare(`
    SELECT j.*,
      COUNT(DISTINCT CASE WHEN t.status='Not Started' THEN t.id END) as open_tasks,
      COUNT(DISTINCT CASE WHEN t.status='Complete' THEN t.id END) as done_tasks,
      COUNT(DISTINCT t.id) as total_tasks
    FROM sprint_jobs j
    LEFT JOIN sprint_tasks t ON t.job_id = j.id
    WHERE j.client_id=?
    GROUP BY j.id
    ORDER BY CASE j.status WHEN 'Active' THEN 0 ELSE 1 END, j.name
  `).bind(clientId).all();
  const tasks = await env.DB.prepare(`
    SELECT t.*, j.name as job_name
    FROM sprint_tasks t
    LEFT JOIN sprint_jobs j ON j.id = t.job_id
    WHERE t.client_id=?
    ORDER BY CASE t.status WHEN 'Not Started' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END, t.due_date
  `).bind(clientId).all();
  return json({ client, jobs: jobs.results, tasks: tasks.results });
}
__name(handleClientGet, "handleClientGet");
async function handleClientCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name)
    return json({ error: "Name required" }, 400);
  const exists = await env.DB.prepare(
    `SELECT 1 FROM sprint_clients WHERE name=? AND archived=0`
  ).bind(name).first();
  if (exists)
    return json({ error: "Name already exists" }, 409);
  const id = genId("client");
  await env.DB.prepare(
    `INSERT INTO sprint_clients (id, name, status, has_sprint, archived, notes, created_at, updated_at)
     VALUES (?, ?, 'Active', 0, 0, '', date('now'), date('now'))`
  ).bind(id, name).run();
  return json({ success: true, id });
}
__name(handleClientCreate, "handleClientCreate");
async function handleClientUpdate(request, env, clientId) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name)
    return json({ error: "Name required" }, 400);
  const exists = await env.DB.prepare(
    `SELECT 1 FROM sprint_clients WHERE name=? AND archived=0 AND id!=?`
  ).bind(name, clientId).first();
  if (exists)
    return json({ error: "Name already exists" }, 409);
  await env.DB.prepare(
    `UPDATE sprint_clients SET name=?, updated_at=date('now') WHERE id=?`
  ).bind(name, clientId).run();
  return json({ success: true });
}
__name(handleClientUpdate, "handleClientUpdate");
async function handleClientArchive(request, env, clientId) {
  await env.DB.prepare(
    `UPDATE sprint_clients SET archived=1, updated_at=date('now') WHERE id=?`
  ).bind(clientId).run();
  return json({ success: true });
}
__name(handleClientArchive, "handleClientArchive");
async function handleClientNotes(request, env, clientId) {
  const body = await request.json().catch(() => ({}));
  const notes = body.notes || "";
  await env.DB.prepare(
    `UPDATE sprint_clients SET notes=?, updated_at=date('now') WHERE id=?`
  ).bind(notes, clientId).run();
  return json({ success: true });
}
__name(handleClientNotes, "handleClientNotes");
async function handleTeamList(request, env) {
  const team = await env.DB.prepare(`SELECT * FROM sprint_team ORDER BY name`).all();
  return json(team.results);
}
__name(handleTeamList, "handleTeamList");
async function handleTeamCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name)
    return json({ error: "Name required" }, 400);
  const exists = await env.DB.prepare(`SELECT 1 FROM sprint_team WHERE name=?`).bind(name).first();
  if (exists)
    return json({ error: "Name already exists" }, 409);
  const id = genId("tm");
  await env.DB.prepare(
    `INSERT INTO sprint_team (id, name, role, created_at) VALUES (?, ?, ?, date('now'))`
  ).bind(id, name, body.role || "").run();
  return json({ success: true, id });
}
__name(handleTeamCreate, "handleTeamCreate");
async function handleTeamDelete(request, env, id) {
  await env.DB.batch([
    env.DB.prepare(`UPDATE sprint_tasks SET assigned_to=NULL WHERE assigned_to=(SELECT name FROM sprint_team WHERE id=?)`).bind(id),
    env.DB.prepare(`DELETE FROM sprint_team WHERE id=?`).bind(id)
  ]);
  return json({ success: true });
}
__name(handleTeamDelete, "handleTeamDelete");
async function handleTeamMember(request, env, encodedName) {
  const name = decodeURIComponent(encodedName);
  const tasks = await env.DB.prepare(`
    SELECT t.*, c.name as client_name, j.name as job_name
    FROM sprint_tasks t
    LEFT JOIN sprint_clients c ON c.id = t.client_id
    LEFT JOIN sprint_jobs j ON j.id = t.job_id
    WHERE LOWER(t.assigned_to) = LOWER(?) AND t.status = 'Not Started'
    ORDER BY t.due_date, c.name
  `).bind(name).all();
  const logs = await env.DB.prepare(
    `SELECT * FROM sprint_logs WHERE LOWER(team_member_name) = LOWER(?) ORDER BY log_date DESC`
  ).bind(name).all();
  return json({ name, tasks: tasks.results, logs: logs.results });
}
__name(handleTeamMember, "handleTeamMember");
async function handleLogCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const { team_member_name, log_date, notes } = body;
  if (!team_member_name || !log_date) return json({ error: "Missing fields" }, { status: 400 });
  const id = genId("log");
  await env.DB.prepare(`
    INSERT INTO sprint_logs (id, team_member_name, log_date, notes)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(team_member_name, log_date) DO UPDATE SET notes = excluded.notes
  `).bind(id, team_member_name, log_date, notes || "").run();
  return json({ ok: true });
}
__name(handleLogCreate, "handleLogCreate");
async function handleLogDelete(request, env, logId) {
  await env.DB.prepare(`DELETE FROM sprint_logs WHERE id = ?`).bind(logId).run();
  return json({ ok: true });
}
__name(handleLogDelete, "handleLogDelete");
async function handleTemplatesList(request, env) {
  const templates = await env.DB.prepare(`SELECT * FROM sprint_templates ORDER BY sort_order, name`).all();
  const taskRows = await env.DB.prepare(`SELECT * FROM sprint_template_tasks ORDER BY sort_order`).all();
  const byTemplate = {};
  for (const t of taskRows.results) {
    if (!byTemplate[t.template_id])
      byTemplate[t.template_id] = [];
    byTemplate[t.template_id].push(t);
  }
  return json(templates.results.map((t) => ({ ...t, tasks: byTemplate[t.id] || [] })));
}
__name(handleTemplatesList, "handleTemplatesList");
async function handleJobCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const jobId = genId("job");
  const stmts = [
    env.DB.prepare(`INSERT INTO sprint_jobs (id, client_id, name, status, assigned_to, due_date, created_at, updated_at) VALUES (?, ?, ?, 'Active', ?, ?, date('now'), date('now'))`).bind(jobId, body.client_id, body.name, body.assigned_to || "", body.due_date || "")
  ];
  if (body.template_id) {
    const tmpl = await env.DB.prepare(`SELECT * FROM sprint_templates WHERE id=?`).bind(body.template_id).first();
    if (tmpl) {
      const tasks = await env.DB.prepare(`SELECT * FROM sprint_template_tasks WHERE template_id=? ORDER BY sort_order`).bind(body.template_id).all();
      for (const t of tasks.results) {
        const taskId = genId("task");
        stmts.push(
          env.DB.prepare(`INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Not Started', ?, '', date('now'), date('now'))`).bind(taskId, jobId, body.client_id, `tmpl-${t.id}`, t.notes, t.assigned_to_role || "")
        );
      }
    }
  }
  await env.DB.batch(stmts);
  return json({ success: true, id: jobId });
}
__name(handleJobCreate, "handleJobCreate");
async function handleJobStatus(request, env, jobId, status) {
  await env.DB.prepare(`UPDATE sprint_jobs SET status=?, updated_at=date('now') WHERE id=?`).bind(status, jobId).run();
  return json({ success: true });
}
__name(handleJobStatus, "handleJobStatus");
async function handleJobAssign(request, env, jobId) {
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare(`UPDATE sprint_jobs SET assigned_to=?, updated_at=date('now') WHERE id=?`).bind(body.assigned_to || "", jobId).run();
  return json({ success: true });
}
__name(handleJobAssign, "handleJobAssign");
async function handleJobUpdate(request, env, jobId) {
  const body = await request.json().catch(() => ({}));
  const fields = [];
  const vals = [];
  const name = (body.name || "").trim();
  if (name) { fields.push("name=?"); vals.push(name); }
  if (body.assigned_to !== void 0) { fields.push("assigned_to=?"); vals.push(body.assigned_to || ""); }
  if (body.due_date !== void 0) { fields.push("due_date=?"); vals.push(body.due_date || ""); }
  if (body.notes !== void 0) { fields.push("notes=?"); vals.push(body.notes || ""); }
  if (!fields.length) return json({ success: true });
  fields.push("updated_at=date('now')");
  vals.push(jobId);
  await env.DB.prepare(
    `UPDATE sprint_jobs SET ${fields.join(", ")} WHERE id=?`
  ).bind(...vals).run();
  return json({ success: true });
}
__name(handleJobUpdate, "handleJobUpdate");
async function handleTaskCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const id = genId("task");
  const taskId = `manual-${body.job_id}-${Date.now()}`;
  await env.DB.prepare(
    `INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Not Started', ?, ?, date('now'), date('now'))`
  ).bind(id, body.job_id, body.client_id, taskId, body.notes, body.assigned_to || "", body.due_date || "").run();
  return json({ success: true, id });
}
__name(handleTaskCreate, "handleTaskCreate");
async function handleTaskUpdate(request, env, taskId) {
  const body = await request.json().catch(() => ({}));
  await env.DB.prepare(
    `UPDATE sprint_tasks SET notes=?, assigned_to=?, due_date=?, updated_at=date('now') WHERE id=?`
  ).bind(body.notes || "", body.assigned_to || "", body.due_date || "", taskId).run();
  return json({ success: true });
}
__name(handleTaskUpdate, "handleTaskUpdate");
async function handleTaskDelete(request, env, taskId) {
  await env.DB.prepare(`DELETE FROM sprint_tasks WHERE id=?`).bind(taskId).run();
  return json({ success: true });
}
__name(handleTaskDelete, "handleTaskDelete");
async function handleTaskStatus(request, env, taskId, status) {
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (status === "Complete") {
    await env.DB.prepare(
      `UPDATE sprint_tasks SET status='Complete', completed_date=?, updated_at=date('now') WHERE id=?`
    ).bind(now, taskId).run();
  } else {
    await env.DB.prepare(
      `UPDATE sprint_tasks SET status='Not Started', completed_date=NULL, updated_at=date('now') WHERE id=?`
    ).bind(taskId).run();
  }
  return json({ success: true });
}
__name(handleTaskStatus, "handleTaskStatus");
async function handleSprintGet(request, env, clientId) {
  const items = await env.DB.prepare(
    `SELECT * FROM sprint_checklist WHERE client_id=?`
  ).bind(clientId).all();
  return json({ items: items.results });
}
__name(handleSprintGet, "handleSprintGet");
async function handleSprintToggle(request, env) {
  const body = await request.json().catch(() => ({}));
  const { client_id, task_id, completed_by } = body;
  const existing = await env.DB.prepare(
    `SELECT * FROM sprint_checklist WHERE client_id=? AND task_id=?`
  ).bind(client_id, task_id).first();
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  if (existing) {
    const newVal = existing.completed ? 0 : 1;
    await env.DB.prepare(
      `UPDATE sprint_checklist SET completed=?, completed_by=?, completed_date=? WHERE client_id=? AND task_id=?`
    ).bind(newVal, newVal ? completed_by || "" : "", newVal ? now : "", client_id, task_id).run();
  } else {
    const id = genId("sc");
    await env.DB.prepare(
      `INSERT INTO sprint_checklist (id, client_id, task_id, completed, completed_by, completed_date) VALUES (?, ?, ?, 1, ?, ?)`
    ).bind(id, client_id, task_id, completed_by || "", now).run();
  }
  return json({ success: true });
}
__name(handleSprintToggle, "handleSprintToggle");
async function handleSprintActivate(request, env) {
  const body = await request.json().catch(() => ({}));
  const { client_id, start_date } = body;
  const exists = await env.DB.prepare(
    `SELECT 1 FROM sprint_clients WHERE id=? AND has_sprint=1`
  ).bind(client_id).first();
  if (exists)
    return json({ error: "Already enrolled" }, 409);
  await env.DB.prepare(
    `UPDATE sprint_clients SET has_sprint=1, start_date=?, updated_at=date('now') WHERE id=?`
  ).bind(start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], client_id).run();
  return json({ success: true });
}
__name(handleSprintActivate, "handleSprintActivate");
async function handleSprintDeactivate(request, env) {
  const body = await request.json().catch(() => ({}));
  const clientId = body.client_id;
  if (!clientId) return json({ error: "client_id required" }, 400);
  // Graduate: leave the 30-Day Sprint but keep the client + their checklist history.
  await env.DB.prepare("UPDATE sprint_clients SET has_sprint=0, updated_at=date('now') WHERE id=?").bind(clientId).run();
  return json({ ok: true });
}
__name(handleSprintDeactivate, "handleSprintDeactivate");
// ── Routine engine ────────────────────────────────────────────────────────────
// Recurring per-client operating loop. Routine templates (is_routine=1) with a
// cadence auto-generate a Job + Tasks per eligible client, once per cadence period.
// Eligibility: applies_when empty = all sprint clients; otherwise the client must
// have at least one of the listed services active in client_services.
function routineAddDays(today, n) {
  const d = new Date(today + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split("T")[0];
}
__name(routineAddDays, "routineAddDays");
function routineIsoWeek(today) {
  const d = new Date(today + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
}
__name(routineIsoWeek, "routineIsoWeek");
function routinePeriodKey(cadence, today) {
  if (cadence === "weekly") return routineIsoWeek(today);
  if (cadence === "monthly") return today.slice(0, 7);
  if (cadence === "45day") return "45-" + Math.floor(new Date(today + "T00:00:00Z").getTime() / 864e5 / 45);
  return today;
}
__name(routinePeriodKey, "routinePeriodKey");
async function generateRoutineJobs(env, opts = {}) {
  const dryRun = !!opts.dry_run;
  const onlyClient = opts.client_id || null;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const dueDays = { daily: 1, weekly: 7, monthly: 30, "45day": 45 };
  const tmpls = (await env.DB.prepare(
    "SELECT * FROM sprint_templates WHERE is_routine=1 AND cadence IN ('daily','weekly','monthly','45day') ORDER BY sort_order"
  ).all()).results;
  let clientSql = "SELECT id, name FROM sprint_clients WHERE on_routine=1 AND archived=0";
  const cb = [];
  if (onlyClient) { clientSql += " AND id=?"; cb.push(onlyClient); }
  const clients = (await env.DB.prepare(clientSql).bind(...cb).all()).results;
  const svcRows = (await env.DB.prepare("SELECT client_id, service FROM client_services WHERE status NOT IN ('none','','pending')").all()).results;
  const svcByClient = {};
  for (const s of svcRows) { (svcByClient[s.client_id] = svcByClient[s.client_id] || /* @__PURE__ */ new Set()).add(s.service); }
  const report = [];
  for (const t of tmpls) {
    const period = routinePeriodKey(t.cadence, today);
    const dueDate = routineAddDays(today, dueDays[t.cadence] || 7);
    const applies = (t.applies_when || "").split(",").map((s) => s.trim()).filter(Boolean);
    const tasks = (await env.DB.prepare("SELECT * FROM sprint_template_tasks WHERE template_id=? ORDER BY sort_order").bind(t.id).all()).results;
    for (const c of clients) {
      if (applies.length) {
        const svc = svcByClient[c.id] || /* @__PURE__ */ new Set();
        if (!applies.some((a) => svc.has(a))) continue;
      }
      const existing = await env.DB.prepare(
        "SELECT job_id FROM routine_generation WHERE template_id=? AND client_id=? AND period_key=?"
      ).bind(t.id, c.id, period).first();
      if (existing) { report.push({ template: t.name, client: c.name, period, action: "exists" }); continue; }
      if (dryRun) { report.push({ template: t.name, client: c.name, period, action: "would_create" }); continue; }
      const jobId = genId("job");
      const stmts = [
        env.DB.prepare("INSERT INTO sprint_jobs (id, client_id, name, status, assigned_to, due_date, created_at, updated_at) VALUES (?, ?, ?, 'Active', ?, ?, date('now'), date('now'))").bind(jobId, c.id, `${t.name} — ${period}`, "", dueDate)
      ];
      for (const tt of tasks) {
        stmts.push(
          env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'Not Started', ?, ?, date('now'), date('now'))").bind(genId("task"), jobId, c.id, tt.id, tt.notes, tt.assigned_to_role || "", dueDate)
        );
      }
      stmts.push(
        env.DB.prepare("INSERT OR IGNORE INTO routine_generation (template_id, client_id, period_key, job_id) VALUES (?, ?, ?, ?)").bind(t.id, c.id, period, jobId)
      );
      await env.DB.batch(stmts);
      report.push({ template: t.name, client: c.name, period, action: "created", job_id: jobId });
    }
  }
  return report;
}
__name(generateRoutineJobs, "generateRoutineJobs");
async function reapSupersededRoutineTasks(env) {
  // A routine job is SUPERSEDED once a later generation exists for the same
  // (template, client) — the cadence rolled to a new period (daily every day,
  // weekly/monthly/45day each period). Its still-open tasks are moot: "run X
  // today" from yesterday, last month's audit, etc. Delete the Not-Started ones
  // and any job left empty; Completed tasks are kept as history. Uses rowid
  // ordering (insertion = generation order) so it's period-format agnostic —
  // string-comparing period_key would misorder the numeric 45day keys.
  const stale = (await env.DB.prepare(
    `SELECT DISTINCT rg.job_id FROM routine_generation rg
     WHERE EXISTS (
       SELECT 1 FROM routine_generation r2
       WHERE r2.template_id=rg.template_id AND r2.client_id=rg.client_id AND r2.rowid > rg.rowid
     )`
  ).all()).results || [];
  if (!stale.length) return 0;
  const ids = stale.map((r) => r.job_id);
  let removed = 0;
  for (let i = 0; i < ids.length; i += 40) {
    const chunk = ids.slice(i, i + 40);
    const ph = chunk.map(() => "?").join(",");
    const r = await env.DB.prepare(`DELETE FROM sprint_tasks WHERE status='Not Started' AND job_id IN (${ph})`).bind(...chunk).run();
    removed += r.meta?.changes || 0;
    await env.DB.prepare(`DELETE FROM sprint_jobs WHERE id IN (${ph}) AND NOT EXISTS (SELECT 1 FROM sprint_tasks st WHERE st.job_id=sprint_jobs.id)`).bind(...chunk).run();
  }
  return removed;
}
__name(reapSupersededRoutineTasks, "reapSupersededRoutineTasks");
async function handleRoutineGenerate(request, env) {
  const body = await request.json().catch(() => ({}));
  const report = await generateRoutineJobs(env, { client_id: body.client_id || null, dry_run: !!body.dry_run });
  return json({ ok: true, created: report.filter((r) => r.action === "created").length, count: report.length, report });
}
__name(handleRoutineGenerate, "handleRoutineGenerate");
async function handleRoutineStatus(request, env) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const tmpls = (await env.DB.prepare("SELECT id, name, cadence, applies_when, sort_order FROM sprint_templates WHERE is_routine=1 ORDER BY sort_order").all()).results;
  const gen = (await env.DB.prepare("SELECT template_id, COUNT(*) n, MAX(period_key) last_period, MAX(created_at) last_at FROM routine_generation GROUP BY template_id").all()).results;
  const byT = {};
  for (const g of gen) byT[g.template_id] = g;
  const out = tmpls.map((t) => ({ ...t, generated_total: byT[t.id]?.n || 0, last_period: byT[t.id]?.last_period || null, last_at: byT[t.id]?.last_at || null }));
  return json({ today, templates: out });
}
__name(handleRoutineStatus, "handleRoutineStatus");
async function handleRoutineBoard(request, env) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const tmpls = (await env.DB.prepare("SELECT id, name, cadence, applies_when, sort_order FROM sprint_templates WHERE is_routine=1 AND cadence IN ('daily','weekly','monthly','45day') ORDER BY sort_order").all()).results;
  const clients = (await env.DB.prepare("SELECT id, name FROM sprint_clients WHERE on_routine=1 AND archived=0 ORDER BY name").all()).results;
  const svcRows = (await env.DB.prepare("SELECT client_id, service FROM client_services WHERE status NOT IN ('none','','pending')").all()).results;
  const svcByClient = {};
  for (const s of svcRows) { (svcByClient[s.client_id] = svcByClient[s.client_id] || {})[s.service] = 1; }
  const periodByCadence = {
    daily: routinePeriodKey("daily", today),
    weekly: routinePeriodKey("weekly", today),
    monthly: routinePeriodKey("monthly", today),
    "45day": routinePeriodKey("45day", today)
  };
  const periods = [...new Set(Object.values(periodByCadence))];
  const genRows = periods.length ? (await env.DB.prepare(
    `SELECT template_id, client_id, period_key, job_id FROM routine_generation WHERE period_key IN (${periods.map(() => "?").join(",")})`
  ).bind(...periods).all()).results : [];
  const genMap = {};
  const jobIds = [];
  for (const g of genRows) { genMap[g.template_id + "|" + g.client_id + "|" + g.period_key] = g.job_id; if (g.job_id) jobIds.push(g.job_id); }
  const taskByJob = {};
  if (jobIds.length) {
    const trows = (await env.DB.prepare(
      `SELECT job_id, COUNT(*) total, SUM(CASE WHEN status='Complete' THEN 1 ELSE 0 END) done, MIN(due_date) due FROM sprint_tasks WHERE job_id IN (${jobIds.map(() => "?").join(",")}) GROUP BY job_id`
    ).bind(...jobIds).all()).results;
    for (const t of trows) taskByJob[t.job_id] = t;
  }
  const lastRows = (await env.DB.prepare("SELECT client_id, MAX(created_at) last_at FROM routine_generation GROUP BY client_id").all()).results;
  const lastByClient = {};
  for (const r of lastRows) lastByClient[r.client_id] = r.last_at;
  const availableClients = (await env.DB.prepare(
    "SELECT id, name FROM sprint_clients WHERE archived=0 AND status='Active' AND COALESCE(on_routine,0)=0 ORDER BY name"
  ).all()).results;
  const cells = {};
  const pulse = {};
  for (const cad of ["daily", "weekly", "monthly", "45day"]) pulse[cad] = { total: 0, done: 0, partial: 0, pending: 0, overdue: 0, none: 0 };
  for (const c of clients) {
    cells[c.id] = {};
    for (const t of tmpls) {
      const applies = (t.applies_when || "").split(",").map((s) => s.trim()).filter(Boolean);
      const applicable = !applies.length || applies.some((a) => (svcByClient[c.id] || {})[a]);
      const period = periodByCadence[t.cadence];
      const jobId = genMap[t.id + "|" + c.id + "|" + period] || null;
      let status = "na", total = 0, done = 0, due = null;
      if (applicable) {
        if (!jobId) status = "none";
        else {
          const tk = taskByJob[jobId] || { total: 0, done: 0, due: null };
          total = tk.total || 0; done = tk.done || 0; due = tk.due || null;
          if (total > 0 && done >= total) status = "done";
          else if (due && due < today) status = "overdue";
          else if (done > 0) status = "partial";
          else status = "pending";
        }
        pulse[t.cadence].total++;
        pulse[t.cadence][status] = (pulse[t.cadence][status] || 0) + 1;
      }
      cells[c.id][t.id] = { applicable, status, total, done, due, job_id: jobId };
    }
  }
  return json({ today, templates: tmpls, clients, cells, lastGenerated: lastByClient, pulse, availableClients });
}
__name(handleRoutineBoard, "handleRoutineBoard");
async function handleRoutineClientToggle(request, env, clientId) {
  const body = await request.json().catch(() => ({}));
  const on = body.on_routine ? 1 : 0;
  await env.DB.prepare("UPDATE sprint_clients SET on_routine=?, updated_at=date('now') WHERE id=?").bind(on, clientId).run();
  return json({ ok: true, on_routine: on });
}
__name(handleRoutineClientToggle, "handleRoutineClientToggle");
async function handleRoutineJobTasks(request, env, jobId) {
  const job = await env.DB.prepare(
    "SELECT j.id, j.name, j.client_id, j.due_date, (SELECT name FROM sprint_clients WHERE id=j.client_id) client_name FROM sprint_jobs j WHERE j.id=?"
  ).bind(jobId).first();
  if (!job) return json({ error: "not found" }, 404);
  const tasks = (await env.DB.prepare(
    "SELECT id, notes, status, assigned_to, due_date FROM sprint_tasks WHERE job_id=? ORDER BY created_at"
  ).bind(jobId).all()).results;
  return json({ job, tasks });
}
__name(handleRoutineJobTasks, "handleRoutineJobTasks");
async function callClaude(env, messages, model = "claude-sonnet-5", system = null) {
  if (!env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY not set");
  const body = { model, max_tokens: 2048, messages, thinking: { type: "disabled" } };
  if (system)
    body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock?.text || "";
}
__name(callClaude, "callClaude");
function validateExtraction(parsed) {
  if (!parsed || !Array.isArray(parsed.jobs))
    return false;
  return parsed.jobs.every((j) => typeof j.name === "string" && Array.isArray(j.tasks));
}
__name(validateExtraction, "validateExtraction");
function matchClient(extractedName, clients) {
  const normalize = /* @__PURE__ */ __name((s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\b(llc|inc|co|corp|ltd|group|solutions|services)\b/g, "").trim(), "normalize");
  const t = normalize(extractedName || "");
  if (!t)
    return null;
  return clients.find((c) => {
    const cn = normalize(c.name);
    return cn.includes(t) || t.includes(cn);
  }) || null;
}
__name(matchClient, "matchClient");
async function getValidGmailToken(env) {
  const row = await env.DB.prepare(
    "SELECT * FROM sprint_gmail_tokens WHERE id=?"
  ).bind("main").first();
  if (!row)
    return null;
  const expiry = new Date(row.token_expiry);
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1e3);
  if (expiry <= fiveMinFromNow) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok)
      return null;
    const data = await res.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1e3).toISOString();
    await env.DB.prepare(
      "UPDATE sprint_gmail_tokens SET access_token=?, token_expiry=? WHERE id=?"
    ).bind(data.access_token, newExpiry, "main").run();
    return data.access_token;
  }
  return row.access_token;
}
__name(getValidGmailToken, "getValidGmailToken");
async function handleGmailAuth(request, env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return json({ error: "GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI not configured" }, 500);
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    // select_account forces Google's account chooser (otherwise it silently
    // reuses whichever account is active — kept landing on robertlbutt@);
    // login_hint pre-selects the right one.
    prompt: "select_account consent",
    login_hint: "robertlbutt3@gmail.com"
  });
  return redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
__name(handleGmailAuth, "handleGmailAuth");
async function handleGmailCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code)
    return redirect("/?gmail_error=access_denied");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  if (!res.ok)
    return redirect("/?gmail_error=token_exchange_failed");
  const data = await res.json();
  const expiry = new Date(Date.now() + data.expires_in * 1e3).toISOString();
  await env.DB.prepare(`
    INSERT INTO sprint_gmail_tokens (id, access_token, refresh_token, token_expiry, last_checked)
    VALUES ('main', ?, ?, ?, NULL)
    ON CONFLICT(id) DO UPDATE SET
      access_token=excluded.access_token,
      refresh_token=excluded.refresh_token,
      token_expiry=excluded.token_expiry
  `).bind(data.access_token, data.refresh_token, expiry).run();
  return redirect("/?gmail_connected=1");
}
__name(handleGmailCallback, "handleGmailCallback");
async function handleGmailStatus(request, env) {
  try {
    const row = await env.DB.prepare(
      "SELECT last_checked, cron_last_run, cron_last_error FROM sprint_gmail_tokens WHERE id=?"
    ).bind("main").first();
    return json({
      connected: !!row,
      last_checked: row?.last_checked || null,
      cron_last_run: row?.cron_last_run || null,
      cron_last_error: row?.cron_last_error || null
    });
  } catch {
    return json({ connected: false, last_checked: null, cron_last_run: null, cron_last_error: null });
  }
}
__name(handleGmailStatus, "handleGmailStatus");
async function handleGmailPollNow(request, env) {
  try {
    const result = await runGmailPoll(env, true);
    if (result.error)
      return json({ ok: false, error: result.error, debug: result.debug });
    return json({ ok: true, processed: result.processed || 0, debug: result.debug });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
__name(handleGmailPollNow, "handleGmailPollNow");
var GMAIL_BATCH_LIMIT = 20;
async function runGmailPoll(env, debug = false) {
  const dbg = [];
  const token = await getValidGmailToken(env);
  if (!token)
    return { processed: 0, error: "Gmail not connected or token refresh failed" };
  const row = await env.DB.prepare(
    "SELECT last_checked FROM sprint_gmail_tokens WHERE id=?"
  ).bind("main").first();
  const since = row?.last_checked;
  dbg.push(`last_checked: ${since || "none"}`);
  let q = "-in:spam -in:trash -in:drafts";
  if (since) {
    q += ` after:${Math.floor(new Date(since).getTime() / 1e3)}`;
  } else {
    q += ` after:${Math.floor((Date.now() - 864e5) / 1e3)}`;
  }
  dbg.push(`query: ${q}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${GMAIL_BATCH_LIMIT}&q=${encodeURIComponent(q)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) {
    const errBody = await listRes.text();
    return { processed: 0, error: `Gmail list error: ${listRes.status}`, debug: dbg.concat([`list response: ${errBody.slice(0, 200)}`]) };
  }
  const listData = await listRes.json();
  const messages = listData.messages || [];
  dbg.push(`messages found: ${messages.length}`);
  const clientsRes = await env.DB.prepare(
    "SELECT id, name FROM sprint_clients WHERE archived=0"
  ).all();
  const clients = clientsRes.results;
  let processed = 0;
  for (const msg of messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!msgRes.ok) {
      dbg.push(`msg fetch failed: ${msgRes.status}`);
      continue;
    }
    const msgData = await msgRes.json();
    const headers = msgData.payload?.headers || [];
    const subject = headers.find((h) => h.name === "Subject")?.value || "(no subject)";
    const fromHeader = headers.find((h) => h.name === "From")?.value || "";
    dbg.push(`msg: "${subject}" from: ${fromHeader.slice(0, 40)}`);
    let body = "";
    const extractBody = /* @__PURE__ */ __name((part) => {
      if (part.mimeType === "text/plain" && part.body?.data) {
        try {
          body += atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
        } catch {
        }
      }
      if (part.parts)
        part.parts.forEach(extractBody);
    }, "extractBody");
    extractBody(msgData.payload || {});
    if (!body.trim()) {
      dbg.push(`  \u2192 skipped: no text body`);
      continue;
    }
    const rawText = `Subject: ${subject}
From: ${fromHeader}

${body.slice(0, 3e3)}`;
    let isWorkRequest = false;
    try {
      const classText = await callClaude(env, [{
        role: "user",
        content: `Is this email a client work request, project inquiry, or action item that needs project tracking? Reply with only "yes" or "no".

${rawText}`
      }], "claude-haiku-4-5-20251001");
      isWorkRequest = classText.trim().toLowerCase().startsWith("yes");
      dbg.push(`  \u2192 classified: ${isWorkRequest ? "YES" : "no"}`);
    } catch (e) {
      dbg.push(`  \u2192 classify error: ${e.message}`);
      continue;
    }
    if (!isWorkRequest)
      continue;
    let extracted = null;
    try {
      const extractText = await callClaude(env, [{
        role: "user",
        content: `Extract the client work request from this email. Return ONLY valid JSON: {"client_name": "string", "jobs": [{"name": "string", "tasks": [{"name": "string"}]}]}. If you cannot extract structured data, return {"client_name": "", "jobs": []}.

${rawText}`
      }], "claude-sonnet-5");
      const jsonMatch = extractText.match(/\{[\s\S]*\}/);
      if (jsonMatch)
        extracted = JSON.parse(jsonMatch[0]);
    } catch {
      extracted = null;
    }
    if (!extracted || !validateExtraction(extracted)) {
      extracted = { client_name: "", jobs: [] };
    }
    const matched = matchClient(extracted.client_name || "", clients);
    const id = genId("intake");
    await env.DB.prepare(`
      INSERT INTO sprint_intake (id, source, subject, raw_text, extracted_json, suggested_client_id, suggested_client_name, status)
      VALUES (?, 'email', ?, ?, ?, ?, ?, 'pending')
    `).bind(
      id,
      subject,
      rawText,
      JSON.stringify(extracted),
      matched?.id || null,
      extracted.client_name || fromHeader
    ).run();
    processed++;
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  await env.DB.prepare(
    "UPDATE sprint_gmail_tokens SET last_checked=?, cron_last_run=?, cron_last_error=NULL WHERE id=?"
  ).bind(now, now, "main").run();
  return { processed, debug: dbg };
}
__name(runGmailPoll, "runGmailPoll");
async function handleIntakeList(request, env) {
  try {
    const items = await env.DB.prepare(
      `SELECT * FROM sprint_intake WHERE status='pending' ORDER BY created_at DESC`
    ).all();
    return json(items.results);
  } catch {
    return json([]);
  }
}
__name(handleIntakeList, "handleIntakeList");
async function extractDocxText(bytes) {
  const view = new DataView(bytes);
  let offset = 0;
  while (offset < bytes.byteLength - 30) {
    if (view.getUint32(offset, true) !== 67324752)
      break;
    const compression = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const filenameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const filename = new TextDecoder().decode(new Uint8Array(bytes, offset + 30, filenameLen));
    const dataOffset = offset + 30 + filenameLen + extraLen;
    if (filename === "word/document.xml") {
      let data = new Uint8Array(bytes, dataOffset, compressedSize);
      if (compression === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(data);
        writer.close();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done)
            break;
          chunks.push(value);
        }
        const out = new Uint8Array(chunks.reduce((a, b) => a + b.length, 0));
        let pos = 0;
        for (const chunk of chunks) {
          out.set(chunk, pos);
          pos += chunk.length;
        }
        data = out;
      }
      const xml = new TextDecoder().decode(data);
      return xml.replace(/<w:t[^>]*>/g, "").replace(/<\/w:t>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 1e4);
    }
    offset = dataOffset + compressedSize;
  }
  return "";
}
__name(extractDocxText, "extractDocxText");
async function handleIntakeUpload(request, env) {
  let fileBytes, filename, mimeType;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file)
      return json({ error: "No file provided" }, 400);
    filename = file.name || "document";
    mimeType = file.type || "application/octet-stream";
    fileBytes = await file.arrayBuffer();
  } catch {
    return json({ error: "Invalid file upload" }, 400);
  }
  if (fileBytes.byteLength > 10 * 1024 * 1024) {
    return json({ error: "File too large (max 10MB)" }, 413);
  }
  const ext = filename.toLowerCase().split(".").pop();
  const supported = ["pdf", "txt", "doc", "docx"];
  if (!supported.includes(ext)) {
    return json({ error: "Unsupported file type. Please upload a PDF, DOCX, DOC, or TXT file." }, 400);
  }
  let extractText;
  const isPdf = ext === "pdf" || mimeType === "application/pdf";
  const isDocx = ext === "docx" || ext === "doc";
  if (isPdf) {
    const b64 = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));
    try {
      extractText = await callClaude(env, [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
          { type: "text", text: 'Extract all jobs, phases, milestones, and tasks from this proposal or document. Return ONLY valid JSON: {"client_name": "string", "jobs": [{"name": "string", "tasks": [{"name": "string", "notes": "string"}]}]}. Be thorough \u2014 capture every deliverable, phase, and task mentioned.' }
        ]
      }], "claude-sonnet-5");
    } catch (err) {
      return json({ error: `Extraction failed: ${err.message}` }, 500);
    }
  } else if (isDocx) {
    let rawText = "";
    try {
      rawText = await extractDocxText(fileBytes);
    } catch {
    }
    if (!rawText)
      return json({ error: "Could not read DOCX file. Try saving as PDF or TXT." }, 422);
    try {
      extractText = await callClaude(env, [{
        role: "user",
        content: `Extract all jobs, phases, milestones, and tasks from this proposal or document. Return ONLY valid JSON: {"client_name": "string", "jobs": [{"name": "string", "tasks": [{"name": "string", "notes": "string"}]}]}.

${rawText}`
      }], "claude-sonnet-5");
    } catch (err) {
      return json({ error: `Extraction failed: ${err.message}` }, 500);
    }
  } else {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const rawText = decoder.decode(fileBytes).slice(0, 1e4);
    try {
      extractText = await callClaude(env, [{
        role: "user",
        content: `Extract all jobs, phases, milestones, and tasks from this proposal or document. Return ONLY valid JSON: {"client_name": "string", "jobs": [{"name": "string", "tasks": [{"name": "string", "notes": "string"}]}]}.

${rawText}`
      }], "claude-sonnet-5");
    } catch (err) {
      return json({ error: `Extraction failed: ${err.message}` }, 500);
    }
  }
  let extracted = null;
  try {
    const jsonMatch = extractText.match(/\{[\s\S]*\}/);
    if (jsonMatch)
      extracted = JSON.parse(jsonMatch[0]);
  } catch {
    extracted = null;
  }
  if (!extracted || !validateExtraction(extracted)) {
    extracted = { client_name: "", jobs: [] };
  }
  const clientsRes = await env.DB.prepare(
    "SELECT id, name FROM sprint_clients WHERE archived=0"
  ).all();
  const matched = matchClient(extracted.client_name || "", clientsRes.results);
  const id = genId("intake");
  const rawTextForDb = isPdf ? `[PDF: ${filename}]` : new TextDecoder("utf-8", { fatal: false }).decode(fileBytes).slice(0, 5e3);
  await env.DB.prepare(`
    INSERT INTO sprint_intake (id, source, subject, raw_text, extracted_json, suggested_client_id, suggested_client_name, status)
    VALUES (?, 'proposal', ?, ?, ?, ?, ?, 'pending')
  `).bind(
    id,
    filename,
    rawTextForDb,
    JSON.stringify(extracted),
    matched?.id || null,
    extracted.client_name || filename
  ).run();
  const openingMsg = `I've analyzed **${filename}** and extracted the following structure:

${(extracted.jobs || []).map(
    (j) => `**${j.name}**
${(j.tasks || []).map((t) => `  - ${t.name}`).join("\n")}`
  ).join("\n\n") || "_(No structured content found \u2014 try uploading a cleaner version)_"}

You can ask me to add, remove, rename, or split any jobs or tasks. When you're happy with the structure, click **Add to Client**.`;
  const chatId = genId("chat");
  await env.DB.prepare(
    "INSERT INTO sprint_intake_chat (id, intake_id, role, content) VALUES (?, ?, ?, ?)"
  ).bind(chatId, id, "assistant", openingMsg).run();
  return json({ intake_id: id, extracted, suggested_client: matched, opening_message: openingMsg });
}
__name(handleIntakeUpload, "handleIntakeUpload");
async function handleIntakeChat(request, env) {
  const body = await request.json().catch(() => ({}));
  const { intake_id, message } = body;
  if (!intake_id || !message)
    return json({ error: "intake_id and message required" }, 400);
  const intake = await env.DB.prepare(
    "SELECT * FROM sprint_intake WHERE id=?"
  ).bind(intake_id).first();
  if (!intake)
    return json({ error: "Intake item not found" }, 404);
  const historyRes = await env.DB.prepare(
    "SELECT role, content FROM sprint_intake_chat WHERE intake_id=? ORDER BY created_at DESC LIMIT 20"
  ).bind(intake_id).all();
  const history = historyRes.results.reverse();
  await env.DB.prepare(
    "INSERT INTO sprint_intake_chat (id, intake_id, role, content) VALUES (?, ?, ?, ?)"
  ).bind(genId("chat"), intake_id, "user", message).run();
  const systemContext = `You are helping refine a project structure extracted from a proposal. Current extraction:
${intake.extracted_json}

When you modify the structure, include the full updated JSON in a markdown code block:
\`\`\`json
{"client_name": "...", "jobs": [...]}
\`\`\`

Be concise and helpful.`;
  const messages = [
    { role: "user", content: systemContext },
    { role: "assistant", content: "Understood. I'll help refine the extraction." },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: message }
  ];
  let reply;
  try {
    reply = await callClaude(env, messages, "claude-sonnet-5");
  } catch (err) {
    return json({ error: `Claude error: ${err.message}` }, 500);
  }
  await env.DB.prepare(
    "INSERT INTO sprint_intake_chat (id, intake_id, role, content) VALUES (?, ?, ?, ?)"
  ).bind(genId("chat"), intake_id, "assistant", reply).run();
  let updatedExtracted = null;
  const jsonBlock = reply.match(/```json\s*([\s\S]*?)```/);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock[1]);
      if (validateExtraction(parsed)) {
        updatedExtracted = parsed;
        await env.DB.prepare(
          "UPDATE sprint_intake SET extracted_json=? WHERE id=?"
        ).bind(JSON.stringify(parsed), intake_id).run();
      }
    } catch {
    }
  }
  return json({ reply, updated_extraction: updatedExtracted });
}
__name(handleIntakeChat, "handleIntakeChat");
async function handleIntakeConfirm(request, env, intakeId) {
  const body = await request.json().catch(() => ({}));
  const { client_id, create_client_name } = body;
  const intake = await env.DB.prepare(
    "SELECT * FROM sprint_intake WHERE id=?"
  ).bind(intakeId).first();
  if (!intake)
    return json({ error: "Not found" }, 404);
  let targetClientId = client_id;
  if (!targetClientId && create_client_name) {
    const cname = create_client_name.trim();
    const exists = await env.DB.prepare(
      "SELECT id FROM sprint_clients WHERE name=? AND archived=0"
    ).bind(cname).first();
    if (exists) {
      targetClientId = exists.id;
    } else {
      targetClientId = genId("client");
      await env.DB.prepare(
        `INSERT INTO sprint_clients (id, name, status, archived) VALUES (?, ?, 'Active', 0)`
      ).bind(targetClientId, cname).run();
    }
  }
  if (!targetClientId)
    return json({ error: "client_id or create_client_name required" }, 400);
  let extracted;
  try {
    extracted = JSON.parse(intake.extracted_json);
  } catch {
    extracted = { jobs: [] };
  }
  if (!validateExtraction(extracted))
    return json({ error: "Invalid extraction \u2014 refine before confirming" }, 400);
  const ops = [];
  for (const job of extracted.jobs) {
    const jobId = genId("job");
    ops.push(env.DB.prepare(
      `INSERT INTO sprint_jobs (id, client_id, name, status) VALUES (?, ?, ?, 'Active')`
    ).bind(jobId, targetClientId, job.name));
    for (const task of job.tasks || []) {
      ops.push(env.DB.prepare(
        `INSERT INTO sprint_tasks (id, job_id, client_id, notes, status) VALUES (?, ?, ?, ?, 'Not Started')`
      ).bind(genId("task"), jobId, targetClientId, task.name || task.notes || ""));
    }
  }
  ops.push(env.DB.prepare(
    `UPDATE sprint_intake SET status='confirmed' WHERE id=?`
  ).bind(intakeId));
  await env.DB.batch(ops);
  return json({ success: true, client_id: targetClientId, jobs_created: extracted.jobs.length });
}
__name(handleIntakeConfirm, "handleIntakeConfirm");
async function handleIntakeDismiss(request, env, intakeId) {
  await env.DB.prepare(
    `UPDATE sprint_intake SET status='dismissed' WHERE id=?`
  ).bind(intakeId).run();
  return json({ success: true });
}
__name(handleIntakeDismiss, "handleIntakeDismiss");
async function handleIntakeBulkDismiss(request, env) {
  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || !ids.length)
    return json({ error: "ids required" }, 400);
  const stmts = ids.map(
    (id) => env.DB.prepare(`UPDATE sprint_intake SET status='dismissed' WHERE id=?`).bind(id)
  );
  await env.DB.batch(stmts);
  return json({ success: true, dismissed: ids.length });
}
__name(handleIntakeBulkDismiss, "handleIntakeBulkDismiss");
async function handleAssistant(request, env) {
  const { message } = await request.json().catch(() => ({}));
  if (!message || !message.trim())
    return json({ error: "No message" }, 400);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const clients = await env.DB.prepare(
    `SELECT id, name FROM sprint_clients WHERE archived=0 ORDER BY name`
  ).all().then((r) => r.results || []);
  const allJobs = await env.DB.prepare(
    `SELECT id, client_id, name, status FROM sprint_jobs ORDER BY status='Active' DESC, name`
  ).all().then((r) => r.results || []);
  const clientList = clients.map((c) => {
    const cjobs = allJobs.filter((j) => j.client_id === c.id).map((j) => `    - "${j.name}" (id:${j.id}, status:${j.status})`).join("\n");
    return `- "${c.name}" (id:${c.id})${cjobs ? "\n  Jobs:\n" + cjobs : " [no jobs]"}`;
  }).join("\n");
  const systemPrompt = `You are a project tracker assistant. Today is ${today}.

Clients and their jobs:
${clientList}

Respond with JSON only (no markdown):
{
  "action": "create_job" | "create_task" | "none",
  "client_id": "<matched client id or null>",
  "job_id": "<matched job id or null \u2014 for create_task, prefer Active jobs>",
  "job_name": "<for create_job: the job name. For create_task with no matching job: a short new job name to create first>",
  "task_text": "<full task description for create_task>",
  "due_date": "<YYYY-MM-DD or null \u2014 compute from relative terms like 'tomorrow' using today=${today}>",
  "auto_create_job": <true if create_task needs a new job first, false otherwise>,
  "response": "<concise confirmation under 10 words>"
}

Rules:
- Fuzzy match client names ("Sheppard's" = "Sheppards Glass", "Robbie" or "Robbie To-Do" = "Robbie To-Do")
- For create_task: find the best matching job. If client has no matching job, set auto_create_job=true and provide job_name
- If client has no active jobs and no clear job is specified, set job_name to something sensible (e.g. "Tasks" or infer from the task)
- Parse due dates: "tomorrow"=${tomorrow}, "next week"=add 7 days, etc.
- Keep response short and confident`;
  const aiText = await callClaude(env, [{ role: "user", content: message }], "claude-haiku-4-5-20251001", systemPrompt);
  let parsed;
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
  } catch {
    return json({ response: aiText.slice(0, 200), action: "none" });
  }
  const { action, client_id, job_name, task_text, due_date, auto_create_job, response: aiResponse } = parsed;
  let { job_id } = parsed;
  if (action === "create_job" && client_id && job_name) {
    const jid = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO sprint_jobs (id, client_id, name, status, created_at, updated_at) VALUES (?, ?, ?, 'Active', datetime('now'), datetime('now'))`
    ).bind(jid, client_id, job_name).run();
    return json({ response: aiResponse || `Created job "${job_name}"`, action: "job_created", refresh: true });
  }
  if (action === "create_task" && client_id && task_text) {
    if (auto_create_job && job_name) {
      const jid = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO sprint_jobs (id, client_id, name, status, created_at, updated_at) VALUES (?, ?, ?, 'Active', datetime('now'), datetime('now'))`
      ).bind(jid, client_id, job_name).run();
      job_id = jid;
    }
    if (!job_id)
      return json({ response: "Which job should I add that to?", action: "none" });
    const targetJob = allJobs.find((j) => j.id === job_id);
    const tid = crypto.randomUUID();
    const dueBind = due_date || null;
    await env.DB.prepare(
      `INSERT INTO sprint_tasks (id, job_id, client_id, notes, status, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, 'Open', ?, datetime('now'), datetime('now'))`
    ).bind(tid, job_id, client_id, task_text, dueBind).run();
    const dueStr = due_date ? ` (due ${due_date})` : "";
    return json({ response: aiResponse || `Added task to ${targetJob ? targetJob.name : "job"}${dueStr}`, action: "task_created", refresh: true });
  }
  return json({ response: aiResponse || "Done.", action: "none" });
}
__name(handleAssistant, "handleAssistant");
async function handleIntakeSaveAsNote(request, env, intakeId) {
  const body = await request.json().catch(() => ({}));
  const { job_id } = body;
  if (!job_id)
    return json({ error: "job_id required" }, 400);
  const item = await env.DB.prepare("SELECT * FROM sprint_intake WHERE id=?").bind(intakeId).first();
  if (!item)
    return json({ error: "Not found" }, 404);
  const job = await env.DB.prepare("SELECT notes FROM sprint_jobs WHERE id=?").bind(job_id).first();
  if (!job)
    return json({ error: "Job not found" }, 404);
  const timestamp = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const noteText = `[${timestamp}] ${item.subject || "Email note"}
${(item.raw_text || "").slice(0, 2e3)}`.trim();
  const existing = job.notes || "";
  const newNotes = existing ? existing + "\n\n---\n\n" + noteText : noteText;
  await env.DB.batch([
    env.DB.prepare('UPDATE sprint_jobs SET notes=?, updated_at=datetime("now") WHERE id=?').bind(newNotes, job_id),
    env.DB.prepare('UPDATE sprint_intake SET status="dismissed" WHERE id=?').bind(intakeId)
  ]);
  return json({ success: true });
}
__name(handleIntakeSaveAsNote, "handleIntakeSaveAsNote");
async function handlePushAdData(request, env) {
  const secret = request.headers.get("X-Internal-Secret");
  if (!secret || secret !== env.INTERNAL_PUSH_SECRET) {
    return json({ error: "Forbidden" }, 403);
  }
  const body = await request.json().catch(() => null);
  if (!body || !body.client_id || !body.data_type || !Array.isArray(body.payload)) {
    return json({ error: "Missing fields: client_id, data_type, payload required" }, 400);
  }
  const client = await env.DB.prepare("SELECT id FROM sprint_clients WHERE id=?").bind(body.client_id).first();
  if (!client)
    return json({ error: "Client not found" }, 404);
  const id = genId("cac");
  await env.DB.prepare(`
    INSERT INTO client_ad_cache (id, client_id, data_type, payload_json, date_range, fetched_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(client_id, data_type) DO UPDATE SET
      id=excluded.id,
      payload_json=excluded.payload_json,
      date_range=excluded.date_range,
      fetched_at=excluded.fetched_at
  `).bind(id, body.client_id, body.data_type, JSON.stringify(body.payload), body.date_range || "").run();
  return json({ success: true, rows: body.payload.length });
}
__name(handlePushAdData, "handlePushAdData");
async function handlePortal(request, env, token) {
  if (!token || token.length < 8) {
    return new Response(getPortalNotFoundHTML(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  const row = await env.DB.prepare(
    `SELECT cpt.token, sc.name as client_name
     FROM client_portal_tokens cpt
     JOIN sprint_clients sc ON sc.id = cpt.client_id
     WHERE cpt.token=? AND cpt.revoked=0`
  ).bind(token).first();
  if (!row) {
    return new Response(getPortalNotFoundHTML(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  return new Response(getPortalHTML(token, row.client_name), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
__name(handlePortal, "handlePortal");
async function handlePortalData(request, env, token) {
  const row = await env.DB.prepare(
    "SELECT client_id FROM client_portal_tokens WHERE token=? AND revoked=0"
  ).bind(token).first();
  if (!row)
    return json({ error: "Invalid token" }, 403);
  const cache = await env.DB.prepare(
    "SELECT data_type, payload_json, date_range, fetched_at FROM client_ad_cache WHERE client_id=?"
  ).bind(row.client_id).all();
  const data = {};
  for (const r of cache.results) {
    data[r.data_type] = {
      payload: JSON.parse(r.payload_json),
      date_range: r.date_range,
      fetched_at: r.fetched_at
    };
  }
  return json({ ok: true, data });
}
__name(handlePortalData, "handlePortalData");
async function handlePortalTokenGet(request, env, clientId) {
  const token = await env.DB.prepare(
    "SELECT * FROM client_portal_tokens WHERE client_id=? AND revoked=0 ORDER BY created_at DESC LIMIT 1"
  ).bind(clientId).first();
  return json({ token: token || null });
}
__name(handlePortalTokenGet, "handlePortalTokenGet");
async function handlePortalTokenCreate(request, env, clientId) {
  const client = await env.DB.prepare("SELECT * FROM sprint_clients WHERE id=?").bind(clientId).first();
  if (!client)
    return json({ error: "Client not found" }, 404);
  await env.DB.prepare(
    "UPDATE client_portal_tokens SET revoked=1 WHERE client_id=? AND revoked=0"
  ).bind(clientId).run();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const token = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const id = genId("cpt");
  await env.DB.prepare(
    `INSERT INTO client_portal_tokens (id, client_id, token, label, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(id, clientId, token, client.name).run();
  return json({ success: true, token, url: `/portal/${token}` });
}
__name(handlePortalTokenCreate, "handlePortalTokenCreate");
async function handlePortalTokenRevoke(request, env, clientId) {
  await env.DB.prepare(
    "UPDATE client_portal_tokens SET revoked=1 WHERE client_id=? AND revoked=0"
  ).bind(clientId).run();
  return json({ success: true });
}
__name(handlePortalTokenRevoke, "handlePortalTokenRevoke");
async function writeSprintGmailHeartbeat(env, errorMessage) {
  try {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    if (errorMessage) {
      await env.DB.prepare(`
        INSERT INTO pipeline_heartbeats (pipeline, last_run, last_ok, last_error, expected_hours, meta)
        VALUES (?, ?, NULL, ?, ?, NULL)
        ON CONFLICT(pipeline) DO UPDATE SET
          last_run=excluded.last_run,
          last_error=excluded.last_error,
          expected_hours=excluded.expected_hours
      `).bind("sprint-gmail-poll", nowIso, errorMessage, 26).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO pipeline_heartbeats (pipeline, last_run, last_ok, last_error, expected_hours, meta)
        VALUES (?, ?, ?, NULL, ?, NULL)
        ON CONFLICT(pipeline) DO UPDATE SET
          last_run=excluded.last_run,
          last_ok=excluded.last_ok,
          last_error=NULL,
          expected_hours=excluded.expected_hours
      `).bind("sprint-gmail-poll", nowIso, nowIso, 26).run();
    }
  } catch (hbErr) {
    console.error("Failed to write sprint-gmail-poll heartbeat:", hbErr);
  }
}
__name(writeSprintGmailHeartbeat, "writeSprintGmailHeartbeat");
var worker_default = {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const result = await runGmailPoll(env);
        if (result.error) {
          await env.DB.prepare(
            "UPDATE sprint_gmail_tokens SET cron_last_error=? WHERE id=?"
          ).bind(result.error, "main").run().catch(() => {
          });
          await writeSprintGmailHeartbeat(env, result.error);
        } else {
          await writeSprintGmailHeartbeat(env, null);
        }
      } catch (err) {
        await env.DB.prepare(
          "UPDATE sprint_gmail_tokens SET cron_last_error=? WHERE id=?"
        ).bind(err.message, "main").run().catch(() => {
        });
        await writeSprintGmailHeartbeat(env, err.message);
      }
      // Routine engine: generate recurring per-client jobs once per day.
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const st = await env.DB.prepare("SELECT v FROM routine_state WHERE k='last_gen_date'").first().catch(() => null);
        if (!st || st.v !== today) {
          await reapSupersededRoutineTasks(env);
          await generateRoutineJobs(env, {});
          await env.DB.prepare("INSERT INTO routine_state (k, v) VALUES ('last_gen_date', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(today).run();
        }
      } catch (e) {
      }
    })());
  },
  async fetch(request, env) {
    if (!env.APP_PASSWORD) {
      return new Response("APP_PASSWORD not configured. Run: wrangler secret put APP_PASSWORD", {
        status: 500,
        headers: { "Content-Type": "text/plain" }
      });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    try {
      if (path.startsWith("/api/")) {
        for (const route of ROUTES) {
          if (route.method !== request.method)
            continue;
          const m = path.match(route.re);
          if (!m)
            continue;
          if (!route.public) {
            const authed2 = await authMiddleware(request, env);
            const readOk = route.readKey && request.method === "GET" && env.SERVICES_READ_KEY && request.headers.get("x-read-key") === env.SERVICES_READ_KEY;
            if (!authed2 && !readOk)
              return json({ error: "Unauthorized" }, 401);
          }
          return await route.handler(request, env, m);
        }
        return json({ error: "Not found" }, 404);
      }
      if (path.startsWith("/portal/")) {
        const token = path.slice("/portal/".length).replace(/\/$/, "");
        return handlePortal(request, env, token);
      }
      const auditViewMatch = path.match(/^\/audit\/([^/]+)$/);
      if (auditViewMatch) {
        const viewerAuthed = await authMiddleware(request, env);
        if (!viewerAuthed) return redirect("/");
        return await handleAuditViewPage(request, env, auditViewMatch[1]);
      }
      const authed = await authMiddleware(request, env);
      return new Response(getHTML(authed), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
function getPortalNotFoundHTML() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard Not Found</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#F8F7F4;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#fff;border:1px solid #E5E2DB;border-radius:12px;padding:40px;text-align:center;max-width:380px}h2{font-size:18px;margin-bottom:8px}p{color:#6B6963;font-size:14px;line-height:1.5}</style>
</head><body><div class="card"><h2>Dashboard Link Not Found</h2><p>This link is invalid or has been revoked. Please contact your account manager for an updated link.</p></div></body></html>`;
}
__name(getPortalNotFoundHTML, "getPortalNotFoundHTML");
function getPortalHTML(token, clientName) {
  const esc = /* @__PURE__ */ __name((s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"), "esc");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(clientName)} \u2014 Ads Dashboard</title>
<style>
:root{--bg:#F8F7F4;--surface:#FFFFFF;--border:#E5E2DB;--text:#1A1A18;--text-dim:#6B6963;--accent:#2563EB;--green:#16A34A;--amber:#D97706}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
.header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.header-left h1{font-size:16px;font-weight:600}.header-left .sub{font-size:12px;color:var(--text-dim);margin-top:2px}
.freshness{font-size:11px;color:var(--text-dim)}
.container{max-width:1100px;margin:0 auto;padding:24px 20px}
.section-label{font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--text-dim);margin-bottom:12px}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}
.metric{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px}
.metric .label{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px}
.metric .value{font-size:24px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}
.metric .value.green{color:var(--green)}.metric .value.amber{color:var(--amber)}
.bar-wrap{height:5px;background:#E5E7EB;border-radius:3px;margin-top:6px}
.bar-fill{height:100%;border-radius:3px;background:var(--accent)}
.tabs{display:flex;gap:3px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:3px;width:fit-content;margin-bottom:16px}
.tab{padding:6px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--text-dim);font-family:inherit}
.tab.active{background:var(--accent);color:#fff}
table{width:100%;border-collapse:collapse;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;font-size:13px}
thead th{background:#F3F2EF;text-align:left;padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--text-dim);font-weight:600;white-space:nowrap}
tbody td{padding:10px 14px;border-top:1px solid var(--border);vertical-align:middle}
tbody tr:hover{background:#FAFAF8}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600}
.badge.enabled,.badge.active{background:#DCFCE7;color:#15803D}
.badge.paused{background:#FEF9C3;color:#A16207}
.badge.removed{background:#FEE2E2;color:#B91C1C}
.badge.broad{background:#EFF6FF;color:#1D4ED8}
.badge.phrase{background:#F5F3FF;color:#6D28D9}
.badge.exact{background:#F0FDF4;color:#166534}
.loading,.empty{text-align:center;padding:60px;color:var(--text-dim);font-size:14px}
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>${esc(clientName)} \u2014 Google Ads Dashboard</h1>
    <div class="sub">Performance overview &middot; Read-only</div>
  </div>
  <div class="freshness" id="freshness">Loading&hellip;</div>
</div>
<div class="container" id="app"><div class="loading">Loading your data&hellip;</div></div>
<script>
var TOKEN='${esc(token)}';
var API='/api/portal/'+TOKEN+'/data';
var portalData=null;
var activeTab='campaigns';

function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmt(n){if(n==null||n==='')return'\u2014';n=parseFloat(n);return isNaN(n)?'\u2014':n.toLocaleString();}
function pct(n){if(n==null||n==='')return'\u2014';var v=parseFloat(n);return isNaN(v)?'\u2014':(v*100).toFixed(1)+'%';}
function statusBadge(s){var cls=(s||'').toLowerCase();return '<span class="badge '+cls+'">'+escHtml(s)+'</span>';}
function matchBadge(t){var cls=(t||'').toLowerCase().replace(/_type$/,'');var labels={broad:'BROAD',phrase:'PHRASE',exact:'EXACT'};return '<span class="badge '+cls+'">'+(labels[cls]||escHtml(t))+'</span>';}

function renderSummary(){
  if(!portalData||!portalData.summary)return'';
  var rows=portalData.summary.payload||[];
  var r=rows[0]||{};
  var impr=parseInt(r['metrics.impressions']||0)||0;
  var clicks=parseInt(r['metrics.clicks']||0)||0;
  var ctr=parseFloat(r['metrics.ctr']||0)||0;
  var is=parseFloat(r['metrics.search_impression_share']||0)||0;
  var convs=parseFloat(r['metrics.conversions']||0)||0;
  var d=portalData.summary;
  return '<div class="section-label">Last 7 Days &middot; as of '+escHtml(d.date_range)+'</div>'+
    '<div class="summary-grid">'+
    '<div class="metric"><div class="label">Impressions</div><div class="value">'+fmt(impr)+'</div></div>'+
    '<div class="metric"><div class="label">Clicks</div><div class="value">'+fmt(clicks)+'</div></div>'+
    '<div class="metric"><div class="label">Click-Through Rate</div><div class="value'+(ctr>0.05?' green':'')+'">'+pct(ctr)+'</div></div>'+
    '<div class="metric"><div class="label">Search Impr. Share</div><div class="value">'+pct(is)+'<div class="bar-wrap"><div class="bar-fill" style="width:'+Math.min(is*100,100)+'%"></div></div></div></div>'+
    '<div class="metric"><div class="label">Conversions</div><div class="value green">'+fmt(convs)+'</div></div>'+
    '</div>';
}

function renderCampaigns(){
  var d=portalData&&portalData.campaigns;
  if(!d||!d.payload.length)return'<div class="empty">No campaign data yet.</div>';
  var h='<table><thead><tr><th>Campaign</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Impr. Share</th><th>Conversions</th></tr></thead><tbody>';
  for(var i=0;i<d.payload.length;i++){var r=d.payload[i];
    h+='<tr><td>'+escHtml(r['campaign.name'])+'</td><td>'+statusBadge(r['campaign.status'])+'</td><td>'+fmt(r['metrics.impressions'])+'</td><td>'+fmt(r['metrics.clicks'])+'</td><td>'+pct(r['metrics.ctr'])+'</td><td>'+pct(r['metrics.search_impression_share'])+'</td><td>'+fmt(r['metrics.conversions'])+'</td></tr>';
  }
  return h+'</tbody></table>';
}

function renderAdGroups(){
  var d=portalData&&portalData.ad_groups;
  if(!d||!d.payload.length)return'<div class="empty">No ad group data yet.</div>';
  var h='<table><thead><tr><th>Campaign</th><th>Ad Group</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>';
  for(var i=0;i<d.payload.length;i++){var r=d.payload[i];
    h+='<tr><td>'+escHtml(r['campaign.name'])+'</td><td>'+escHtml(r['ad_group.name'])+'</td><td>'+statusBadge(r['ad_group.status'])+'</td><td>'+fmt(r['metrics.impressions'])+'</td><td>'+fmt(r['metrics.clicks'])+'</td><td>'+pct(r['metrics.ctr'])+'</td></tr>';
  }
  return h+'</tbody></table>';
}

function renderKeywords(){
  var d=portalData&&portalData.keywords;
  if(!d||!d.payload.length)return'<div class="empty">No keyword data yet.</div>';
  var h='<table><thead><tr><th>Keyword</th><th>Match</th><th>Ad Group</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th></tr></thead><tbody>';
  for(var i=0;i<d.payload.length;i++){var r=d.payload[i];
    h+='<tr><td><strong>'+escHtml(r['ad_group_criterion.keyword.text'])+'</strong></td><td>'+matchBadge(r['ad_group_criterion.keyword.match_type'])+'</td><td>'+escHtml(r['ad_group.name'])+'</td><td>'+statusBadge(r['ad_group_criterion.status'])+'</td><td>'+fmt(r['metrics.impressions'])+'</td><td>'+fmt(r['metrics.clicks'])+'</td><td>'+pct(r['metrics.ctr'])+'</td></tr>';
  }
  return h+'</tbody></table>';
}

function renderNegatives(){
  var d=portalData&&portalData.negatives;
  if(!d||!d.payload.length)return'<div class="empty">No negative keywords yet.</div>';
  var h='<table><thead><tr><th>Negative Keyword</th><th>Match</th><th>Campaign</th><th>Ad Group</th></tr></thead><tbody>';
  for(var i=0;i<d.payload.length;i++){var r=d.payload[i];
    h+='<tr><td>'+escHtml(r['ad_group_criterion.keyword.text'])+'</td><td>'+matchBadge(r['ad_group_criterion.keyword.match_type'])+'</td><td>'+escHtml(r['campaign.name'])+'</td><td>'+escHtml(r['ad_group.name']||'Account-level')+'</td></tr>';
  }
  return h+'</tbody></table>';
}

function renderTabs(){
  var defs=[{id:'campaigns',label:'Campaigns'},{id:'ad_groups',label:'Ad Groups'},{id:'keywords',label:'Keywords'},{id:'negatives',label:'Negatives'}];
  var h='<div class="tabs">';
  for(var i=0;i<defs.length;i++){var t=defs[i];h+='<button class="tab'+(activeTab===t.id?' active':'')+'" onclick="switchTab(\\''+t.id+'\\')">'+t.label+'</button>';}
  return h+'</div>';
}

function render(){
  if(!portalData)return;
  var content='';
  if(activeTab==='campaigns')content=renderCampaigns();
  else if(activeTab==='ad_groups')content=renderAdGroups();
  else if(activeTab==='keywords')content=renderKeywords();
  else if(activeTab==='negatives')content=renderNegatives();
  document.getElementById('app').innerHTML=renderSummary()+renderTabs()+content;
}

function switchTab(tab){activeTab=tab;render();}

async function load(){
  try{
    var res=await fetch(API);
    if(!res.ok)throw new Error('fetch failed');
    var json=await res.json();
    portalData=json.data||{};
    var dates=Object.values(portalData).map(function(d){return d&&d.fetched_at;}).filter(Boolean).sort();
    var latest=dates[dates.length-1];
    document.getElementById('freshness').textContent=latest?'Updated '+new Date(latest+' UTC').toLocaleString():'No data yet';
    render();
  }catch(e){
    document.getElementById('app').innerHTML='<div class="empty">Error loading data. Please try again.</div>';
  }
}

load();
<\/script>
</body>
</html>`;
}
__name(getPortalHTML, "getPortalHTML");
async function handleClientHealth(request, env) {
  const latest = await env.DB.prepare(
    `SELECT MAX(score_date) AS d FROM client_health_scores`
  ).first().catch(() => null);
  if (!latest || !latest.d) return json({ score_date: null, clients: [] });
  const rows = await env.DB.prepare(
    `SELECT client_id, client_name, composite_score, trend, signals_json, flags_json
     FROM client_health_scores WHERE score_date=? ORDER BY composite_score ASC`
  ).bind(latest.d).all();
  const clients = rows.results.map((r) => {
    let signals = {}, flags = [];
    try { signals = JSON.parse(r.signals_json || "{}"); } catch (e) {}
    try { flags = JSON.parse(r.flags_json || "[]"); } catch (e) {}
    return {
      client_id: r.client_id,
      client_name: r.client_name,
      composite_score: r.composite_score,
      trend: r.trend,
      signals,
      flags
    };
  });
  return json({ score_date: latest.d, clients });
}
__name(handleClientHealth, "handleClientHealth");
async function handleServicesList(request, env) {
  const clients = await env.DB.prepare(
    `SELECT id, name, domain FROM sprint_clients WHERE archived=0 ORDER BY name`
  ).all();
  const services = await env.DB.prepare(
    `SELECT client_id, service, status, notes, social_scheduled_through FROM client_services`
  ).all();
  const svcMap = {};
  for (const s of services.results) {
    if (!svcMap[s.client_id])
      svcMap[s.client_id] = {};
    svcMap[s.client_id][s.service] = {
      status: s.status,
      notes: s.notes,
      social_scheduled_through: s.social_scheduled_through
    };
  }
  const result = clients.results.map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain || "",
    services: svcMap[c.id] || {}
  }));
  return json(result);
}
__name(handleServicesList, "handleServicesList");
async function handleServiceUpdate(request, env, clientId, service) {
  const body = await request.json().catch(() => ({}));
  const status = body.status || "none";
  const notes = body.notes || null;
  const social_scheduled_through = body.social_scheduled_through || null;
  const id = `svc-${clientId}-${service}`;
  await env.DB.prepare(
    `INSERT INTO client_services (id, client_id, service, status, notes, social_scheduled_through, updated_at)
     VALUES (?,?,?,?,?,?,datetime('now'))
     ON CONFLICT(client_id, service) DO UPDATE SET
       status=excluded.status, notes=excluded.notes,
       social_scheduled_through=excluded.social_scheduled_through,
       updated_at=excluded.updated_at`
  ).bind(id, clientId, service, status, notes, social_scheduled_through).run();
  return json({ success: true });
}
__name(handleServiceUpdate, "handleServiceUpdate");
async function handleMaintenanceList(request, env) {
  const clients = await env.DB.prepare(
    `SELECT c.id, c.name, c.domain, c.last_report_date, c.last_audit_date, c.maint_notes,
       cs_social.status as social_status,
       cs_social.social_scheduled_through as social_through,
       cs_web.status as website_status
     FROM sprint_clients c
     LEFT JOIN client_services cs_social ON cs_social.client_id=c.id AND cs_social.service='social'
     LEFT JOIN client_services cs_web    ON cs_web.client_id=c.id    AND cs_web.service='website'
     WHERE c.archived=0
     ORDER BY c.name`
  ).all();
  return json(clients.results);
}
__name(handleMaintenanceList, "handleMaintenanceList");
async function handleMaintenanceWp(request, env, clientId) {
  const client = await env.DB.prepare(
    `SELECT domain FROM sprint_clients WHERE id=?`
  ).bind(clientId).first();
  if (!client || !client.domain)
    return json({ error: "No domain" }, 404);
  const domain = client.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    const res = await fetch(`https://${domain}/wp-json/wp/v2/posts?per_page=1&_fields=modified`, {
      headers: { "User-Agent": "EngageEngine-Maintenance/1.0" },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok)
      return json({ error: "WP API error", status: res.status });
    const posts = await res.json();
    const modified = posts?.[0]?.modified || null;
    return json({ modified });
  } catch (e) {
    return json({ error: String(e) });
  }
}
__name(handleMaintenanceWp, "handleMaintenanceWp");
async function handleMaintenanceSeo(request, env, clientId) {
  const client = await env.DB.prepare(
    `SELECT domain FROM sprint_clients WHERE id=?`
  ).bind(clientId).first();
  if (!client || !client.domain)
    return json({ error: "No domain" }, 404);
  const domain = client.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${domain}`;
  let score = null, hasMeta = null, noindex = false;
  try {
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance`;
    const psiRes = await fetch(psiUrl, { signal: AbortSignal.timeout(15e3) });
    if (psiRes.ok) {
      const psiData = await psiRes.json();
      const cat = psiData?.lighthouseResult?.categories?.performance;
      if (cat && typeof cat.score === "number")
        score = Math.round(cat.score * 100);
    }
  } catch {
  }
  try {
    const pageRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EngageEngine/1.0)" },
      signal: AbortSignal.timeout(8e3)
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      hasMeta = /<meta\s[^>]*name=["']description["'][^>]*content=["'][^"']{10,}/i.test(html);
      noindex = /<meta\s[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);
    }
  } catch {
  }
  return json({ score, hasMeta, noindex });
}
__name(handleMaintenanceSeo, "handleMaintenanceSeo");
async function handleClientMaintenance(request, env, clientId) {
  const body = await request.json().catch(() => ({}));
  const fields = [];
  const vals = [];
  if (body.last_report_date !== void 0) {
    fields.push("last_report_date=?");
    vals.push(body.last_report_date);
  }
  if (body.last_audit_date !== void 0) {
    fields.push("last_audit_date=?");
    vals.push(body.last_audit_date);
  }
  if (body.maint_notes !== void 0) {
    fields.push("maint_notes=?");
    vals.push(body.maint_notes);
  }
  if (fields.length === 0)
    return json({ error: "Nothing to update" }, 400);
  fields.push(`updated_at=datetime('now')`);
  vals.push(clientId);
  await env.DB.prepare(
    `UPDATE sprint_clients SET ${fields.join(",")} WHERE id=?`
  ).bind(...vals).run();
  return json({ success: true });
}
__name(handleClientMaintenance, "handleClientMaintenance");
async function handleClientDomain(request, env, clientId) {
  const body = await request.json().catch(() => ({}));
  const domain = (body.domain || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  await env.DB.prepare(
    `UPDATE sprint_clients SET domain=?, updated_at=datetime('now') WHERE id=?`
  ).bind(domain || null, clientId).run();
  return json({ success: true, domain });
}
__name(handleClientDomain, "handleClientDomain");
function getHTML(authed) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EngageEngine Sprint Tracker</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#F5F3EE;--surface:#FFFFFF;--surface2:#EDEAE3;--border:#E2DED5;--text:#1C1917;--text-dim:#78716C;--text-muted:#A8A29E;--accent:#CF6344;--accent-glow:rgba(207,99,68,0.08);--green:#16A34A;--green-bg:rgba(22,163,74,0.08);--amber:#D97706;--amber-bg:rgba(217,119,6,0.08);--red:#DC2626;--red-bg:rgba(220,38,38,0.08);--snackbar-bg:#292524}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"DM Sans",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}
/* \u2500\u2500 Login \u2500\u2500 */
.login-bg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg)}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:40px 36px;width:360px;max-width:90vw;box-shadow:0 4px 24px rgba(28,25,23,0.10)}
.login-card h1{font-size:22px;font-weight:700;margin-bottom:6px}.login-card h1 span{color:var(--accent)}
.login-card .sub{font-size:13px;color:var(--text-dim);margin-bottom:28px}
.login-field{margin-bottom:16px}
.login-field label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px}
.login-field input{width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:14px;outline:none}
.login-field input:focus{border-color:var(--accent)}
.login-btn{width:100%;background:var(--accent);color:#fff;border:none;padding:11px;border-radius:8px;font-family:"DM Sans",sans-serif;font-weight:700;font-size:14px;cursor:pointer;margin-top:4px}
.login-btn:hover{opacity:0.9}
.login-error{color:var(--red);font-size:13px;margin-top:10px;min-height:18px}
/* \u2500\u2500 App layout \u2500\u2500 */
.header{padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:rgba(245,243,238,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:100}
.header-left{display:flex;align-items:center;gap:16px}
.header h1{font-size:17px;font-weight:700;letter-spacing:-0.5px}.header h1 span{color:var(--accent)}
.mode-tabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:3px}
.mode-tab{padding:5px 14px;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--text-dim);transition:all 0.15s}
.mode-link{text-decoration:none;display:inline-block;line-height:1.4}.mode-link:hover{color:var(--text)}
.mode-tab.active{background:var(--accent);color:#fff}
.header-right{display:flex;align-items:center;gap:16px}
.header-stats{display:flex;gap:16px;font-size:13px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}
.header-stats .sv{color:var(--text);font-weight:500}
.nav-back{display:none;align-items:center;gap:8px;color:var(--accent);cursor:pointer;font-size:13px;font-weight:500;padding:6px 0}
.nav-back:hover{text-decoration:underline}
.container{max-width:1200px;margin:0 auto;padding:24px}
/* \u2500\u2500 Briefing banner \u2500\u2500 */
.briefing-banner{border-left:3px solid var(--amber);background:var(--amber-bg);padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;font-size:14px}
.briefing-clear{border-left:3px solid var(--green);background:var(--green-bg);padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;font-size:14px;color:var(--green)}
.briefing-dismiss{background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:18px;line-height:1;padding:0 4px}
.briefing-dismiss:hover{color:var(--text)}
/* \u2500\u2500 Stats \u2500\u2500 */
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;box-shadow:0 1px 3px rgba(28,25,23,0.06)}
.stat-card .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px}
.stat-card .value{font-size:28px;font-weight:700;font-family:"JetBrains Mono",monospace}
.stat-card .value.green{color:var(--green)}.stat-card .value.amber{color:var(--amber)}.stat-card .value.accent{color:var(--accent)}
.section-title{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:12px;padding-left:2px}
/* \u2500\u2500 Team \u2500\u2500 */
.team-section-header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.team-section-header .section-title{margin-bottom:0}
.gear-btn{background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:16px;padding:2px 6px;border-radius:4px;transition:all 0.15s}
.gear-btn:hover{color:var(--accent);background:var(--accent-glow)}
.team-row{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.team-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 20px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:12px;box-shadow:0 1px 3px rgba(28,25,23,0.06)}
.team-card:hover{border-color:var(--accent);background:var(--accent-glow)}
.team-avatar{width:36px;height:36px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--accent)}
.team-name{font-weight:600;font-size:14px}.team-tasks{font-size:12px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}
.gear-panel{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:20px;display:none}
.gear-panel.show{display:block}
.gear-panel-title{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:12px}
.gear-member-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.gear-member-row:last-child{border-bottom:none}
.gear-member-name{font-size:14px;font-weight:500}
.remove-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:12px;transition:all 0.15s}
.remove-btn:hover{border-color:var(--red);color:var(--red)}
.gear-add-form{display:flex;gap:8px;margin-top:12px}
.gear-add-form input{flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none}
.gear-add-form input:focus{border-color:var(--accent)}
.gear-add-form button{background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;font-family:"DM Sans",sans-serif}
/* \u2500\u2500 Client grid \u2500\u2500 */
.clients-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.add-client-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.add-client-btn:hover{border-color:var(--accent);color:var(--accent)}
.add-client-form{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px;display:none}
.add-client-form.show{display:flex;gap:8px;align-items:center}
.add-client-form input{flex:1;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:14px;outline:none}
.add-client-form input:focus{border-color:var(--accent)}
.add-client-form button{background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px;font-family:"DM Sans",sans-serif}
.add-client-form .cancel-btn{background:none;border:1px solid var(--border);color:var(--text-dim)}
.add-client-error{color:var(--red);font-size:12px;margin-top:6px}
.client-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px;margin-bottom:32px}
.client-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:space-between;box-shadow:0 1px 3px rgba(28,25,23,0.06)}
.client-card:hover{border-color:var(--accent);background:var(--accent-glow)}
.client-card.health-red{border-left:3px solid var(--red)}
.client-card.health-amber{border-left:3px solid var(--amber)}
.client-card.health-green{border-left:3px solid var(--green)}
.client-name{font-weight:600;font-size:15px}
.client-meta{display:flex;gap:14px;font-size:12px;font-family:"JetBrains Mono",monospace;color:var(--text-dim)}
.client-meta .jobs{color:var(--accent)}.client-meta .open{color:var(--amber)}.client-meta .done{color:var(--green)}
/* \u2500\u2500 Client detail \u2500\u2500 */
.detail-header{margin-bottom:20px;display:flex;align-items:flex-start;justify-content:space-between}
.detail-header h2{font-size:22px;font-weight:700;margin-bottom:4px}
.detail-header .sub{color:var(--text-dim);font-size:14px}
.detail-header-actions{display:flex;gap:8px;align-items:center;flex-shrink:0;margin-left:16px}
.edit-btn,.archive-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.edit-btn:hover{border-color:var(--accent);color:var(--accent)}
.archive-btn:hover{border-color:var(--red);color:var(--red)}
/* \u2500\u2500 Client notes \u2500\u2500 */
.client-notes-wrap{margin-bottom:20px}
.client-notes{min-height:40px;padding:10px 14px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:14px;color:var(--text-dim);line-height:1.6;outline:none;border:1px solid transparent;transition:all 0.2s;cursor:text;white-space:pre-wrap}
.client-notes:hover{border-color:var(--border)}
.client-notes:focus{border-color:var(--accent);color:var(--text);background:var(--surface2)}
.notes-saved{font-size:11px;color:var(--green);margin-top:4px;opacity:0;transition:opacity 0.3s}
.notes-saved.show{opacity:1}
.notes-error{font-size:11px;color:var(--red);margin-top:4px;opacity:0;transition:opacity 0.3s}
.notes-error.show{opacity:1}
/* \u2500\u2500 Jobs \u2500\u2500 */
.job-section{margin-bottom:24px}
.job-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:8px 8px 0 0}
.job-header.collapsed{border-radius:8px}
.job-title{font-weight:600;font-size:14px;cursor:pointer;flex:1}
.job-badge{font-size:11px;padding:2px 8px;border-radius:4px;font-family:"JetBrains Mono",monospace}
.job-badge.active{background:var(--green-bg);color:var(--green)}.job-badge.complete{background:var(--surface2);color:var(--text-dim)}
.job-actions{display:flex;gap:6px;align-items:center;margin-left:8px}
.job-complete-btn{font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-family:"JetBrains Mono",monospace;transition:all 0.15s}
.job-complete-btn:hover{border-color:var(--green);color:var(--green);background:var(--green-bg)}
.job-complete-btn.reopen:hover{border-color:var(--amber);color:var(--amber);background:var(--amber-bg)}
.job-assign-select{background:var(--surface2);border:1px solid var(--border);color:var(--text-dim);padding:3px 8px;border-radius:4px;font-family:"JetBrains Mono",monospace;font-size:11px;cursor:pointer;outline:none;transition:border-color 0.15s}
.job-assign-select:hover,.job-assign-select:focus{border-color:var(--accent)}
.job-assign-select.has-assignee{color:var(--accent);border-color:var(--accent)}
.job-notes-btn{font-size:11px;padding:3px 10px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-family:"JetBrains Mono",monospace;transition:all 0.15s}
.job-notes-btn:hover{border-color:var(--accent);color:var(--accent)}
.job-notes-btn.has-notes{color:var(--accent);border-color:var(--accent);background:var(--surface2)}
.job-notes-panel{background:var(--surface);border:1px solid var(--border);border-top:none;padding:12px 16px}
.job-notes-panel.hidden{display:none}
.job-notes-input{width:100%;min-height:70px;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:10px 12px;color:var(--text);font-family:"DM Sans",sans-serif;font-size:13px;line-height:1.6;resize:vertical;outline:none;transition:border-color 0.15s}
.job-notes-input:focus{border-color:var(--accent)}
.job-notes-actions{display:flex;align-items:center;gap:8px;margin-top:8px}
.job-notes-save{font-size:11px;padding:4px 14px;border-radius:4px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-family:"JetBrains Mono",monospace}
.job-notes-cancel{font-size:11px;padding:4px 12px;border-radius:4px;border:1px solid var(--border);background:none;color:var(--text-dim);cursor:pointer;font-family:"JetBrains Mono",monospace}
.job-notes-cancel:hover{border-color:var(--text-dim);color:var(--text)}
.job-notes-saved{font-size:11px;color:var(--green);opacity:0;transition:opacity 0.3s}
.job-notes-saved.show{opacity:1}
/* \u2500\u2500 Tasks \u2500\u2500 */
.task-list{border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;overflow:hidden}
.task-item{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);font-size:14px;transition:background 0.1s;position:relative}
.task-item:last-child{border-bottom:none}.task-item:hover{background:var(--surface2)}
.task-check{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;role:checkbox;tabindex:0}
.task-check:hover{border-color:var(--green);background:var(--green-bg)}
.task-check.done{border-color:var(--green);background:var(--green)}
.task-check.done::after{content:"\u2713";color:var(--bg);font-size:11px;font-weight:700}
.task-notes{flex:1;cursor:pointer}.task-notes.completed{text-decoration:line-through;color:var(--text-dim)}
.task-assignee{font-size:11px;padding:2px 8px;background:var(--surface2);border-radius:4px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}
.task-due{font-size:11px;font-family:"JetBrains Mono",monospace;color:var(--text-dim)}
.task-due.overdue{color:var(--red)}.task-due.soon{color:var(--amber)}
.task-edit-btn{opacity:0;background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:2px 6px;transition:all 0.15s;flex-shrink:0}
.task-item:hover .task-edit-btn{opacity:1}
.task-edit-btn:hover{color:var(--accent)}
.task-delete-btn{opacity:0;background:none;border:none;cursor:pointer;color:var(--text-dim);font-size:14px;padding:2px 6px;transition:all 0.15s;flex-shrink:0}
.task-item:hover .task-delete-btn{opacity:1}
.task-delete-btn:hover{color:var(--red)}
/* \u2500\u2500 Task edit row \u2500\u2500 */
.task-edit-row{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px;background:var(--surface2);border-bottom:1px solid var(--border);align-items:center}
.task-edit-row input,.task-edit-row select{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none}
.task-edit-row input:focus,.task-edit-row select:focus{border-color:var(--accent)}
.task-edit-notes{flex:1;min-width:180px}
.task-edit-row .save-btn{background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600;font-size:13px}
.task-edit-row .cancel-edit-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px}
/* \u2500\u2500 Add forms \u2500\u2500 */
.add-btn{background:none;border:1px dashed var(--border);color:var(--text-dim);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-family:"DM Sans",sans-serif;transition:all 0.15s;margin-top:8px}
.add-btn:hover{border-color:var(--accent);color:var(--accent)}
.inline-form{display:none;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap}
.inline-form.show{display:flex}
.inline-form input,.inline-form select{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none}
.inline-form input:focus,.inline-form select:focus{border-color:var(--accent)}
.inline-form input{flex:1}
.inline-form button{background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600;font-size:13px}
/* \u2500\u2500 Template pills \u2500\u2500 */
.template-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.template-pill{background:none;border:1px solid var(--border);color:var(--text-dim);padding:4px 12px;border-radius:20px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.template-pill:hover,.template-pill.selected{border-color:var(--accent);color:var(--accent);background:var(--accent-glow)}
.template-hint{font-size:12px;color:var(--text-dim);margin-bottom:6px}
/* \u2500\u2500 Assistant bar \u2500\u2500 */
.assistant-bar{position:fixed;bottom:0;left:0;right:0;z-index:150;padding:10px 24px 14px;background:rgba(245,243,238,0.95);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid var(--border)}
.assistant-input-row{display:flex;align-items:center;gap:10px;max-width:860px;margin:0 auto}
.assistant-icon{font-size:16px;color:var(--accent);flex-shrink:0;line-height:1;padding-bottom:1px}
.assistant-input{flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:10px 14px;border-radius:10px;font-family:"DM Sans",sans-serif;font-size:14px;outline:none;transition:border-color 0.15s;box-shadow:0 1px 4px rgba(28,25,23,0.07)}
.assistant-input:focus{border-color:var(--accent)}
.assistant-input::placeholder{color:var(--text-muted)}
.assistant-send{background:var(--accent);color:#fff;border:none;width:36px;height:36px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s}
.assistant-send:hover{opacity:0.85}
.assistant-send:disabled{opacity:0.4;cursor:default}
.assistant-response{max-width:860px;margin:0 auto 8px;font-size:13px;color:var(--text-dim);min-height:0;transition:all 0.2s;overflow:hidden}
.assistant-response:empty{display:none}
.assistant-response.thinking{color:var(--text-muted);font-style:italic}
.assistant-response.success{color:var(--green);font-weight:500}
.assistant-response.error{color:var(--red)}
/* push page content above assistant bar */
body{padding-bottom:80px}
/* \u2500\u2500 Snackbar \u2500\u2500 */
.snackbar{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--snackbar-bg);border:1px solid var(--border);border-radius:10px;padding:12px 20px;display:flex;align-items:center;gap:14px;z-index:200;font-size:14px;opacity:0;transition:opacity 0.25s;pointer-events:none;width:280px}
.snackbar.show{opacity:1;pointer-events:auto}
.snackbar-undo{background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;font-weight:600;padding:0;flex-shrink:0}
/* \u2500\u2500 Sprint \u2500\u2500 */
.sprint-client-bar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;align-items:center}
.sprint-client-btn{background:var(--surface);border:1px solid var(--border);color:var(--text-dim);padding:6px 16px;border-radius:20px;cursor:pointer;font-size:13px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.sprint-client-btn:hover{border-color:var(--accent);color:var(--accent)}
.sprint-client-btn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.sprint-activate-btn{background:none;border:1px dashed var(--border);color:var(--text-dim);padding:6px 14px;border-radius:20px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.sprint-activate-btn:hover{border-color:var(--accent);color:var(--accent)}
.sprint-progress-wrap{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:20px}
.sprint-progress-header{display:flex;align-items:baseline;gap:12px;margin-bottom:10px}
.sprint-progress-header .pct{font-size:32px;font-weight:700;font-family:"JetBrains Mono",monospace;color:var(--accent)}
.sprint-progress-header .counts{font-size:13px;color:var(--text-dim)}
.sprint-progress-bar{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.sprint-progress-fill{height:100%;background:var(--accent);border-radius:3px;transition:width 0.4s ease}
.phase-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
.phase-btn{background:var(--surface);border:1px solid var(--border);color:var(--text-dim);padding:10px 16px;border-radius:10px;cursor:pointer;font-family:"DM Sans",sans-serif;text-align:left;transition:all 0.15s;min-width:130px}
.phase-btn:hover{border-color:var(--accent)}
.phase-btn.active{border-color:var(--accent);background:var(--accent-glow)}
.phase-name{display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px}
.phase-sub{display:block;font-size:11px;color:var(--text-dim);margin-bottom:4px}
.phase-pct{display:block;font-size:11px;font-family:"JetBrains Mono",monospace;color:var(--accent)}
.sprint-section{margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.sprint-section-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;font-weight:600;font-size:14px;user-select:none}
.sprint-section-header:hover{background:var(--surface2)}
.sprint-section-count{font-size:12px;font-family:"JetBrains Mono",monospace;color:var(--text-dim)}
.sprint-section-count .done-count{color:var(--green);font-weight:600}
.sprint-section-items{border-top:1px solid var(--border)}
.checklist-item{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.1s}
.checklist-item:last-child{border-bottom:none}.checklist-item:hover{background:var(--surface2)}
.checklist-circle{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s}
.checklist-circle.done{border-color:var(--green);background:var(--green)}
.checklist-circle.done::after{content:"\u2713";color:var(--bg);font-size:10px;font-weight:700}
.checklist-label{flex:1;font-size:14px}.checklist-label.done{text-decoration:line-through;color:var(--text-dim)}
.checklist-badge{font-size:10px;padding:1px 6px;border-radius:3px}
.checklist-badge.critical{background:var(--red-bg);color:var(--red)}
.checklist-by{font-size:11px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}
/* \u2500\u2500 Sprint Activate Modal \u2500\u2500 */
.activate-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:300;display:flex;align-items:center;justify-content:center}
.activate-modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:28px 32px;width:340px;max-width:90vw}
.activate-modal h3{font-size:18px;font-weight:700;margin-bottom:20px}
.activate-modal label{display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px;margin-top:14px}
.activate-modal select,.activate-modal input{width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:7px;font-family:"DM Sans",sans-serif;font-size:14px;outline:none}
.activate-modal select:focus,.activate-modal input:focus{border-color:var(--accent)}
.activate-modal-actions{display:flex;gap:10px;margin-top:24px}
.activate-modal-actions .cancel-btn{flex:1;background:none;border:1px solid var(--border);color:var(--text-dim);padding:9px;border-radius:7px;cursor:pointer;font-family:"DM Sans",sans-serif}
.activate-modal-actions .confirm-btn{flex:1;background:var(--accent);color:#fff;border:none;padding:9px;border-radius:7px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600}
/* \u2500\u2500 Loading / misc \u2500\u2500 */
.loading{text-align:center;padding:60px;color:var(--text-dim);font-size:14px}
.hidden{display:none!important}
@media(max-width:768px){
  .stats-row{grid-template-columns:repeat(2,1fr)}
  .client-grid{grid-template-columns:1fr}
  .header-stats{display:none}
  .container{padding:16px}
  .team-row{flex-direction:column}
  .phase-nav{flex-direction:column}
  .snackbar{width:90vw}
  .task-edit-row{flex-direction:column}
  .task-edit-notes{width:100%}
}
/* \u2500\u2500 Intake section \u2500\u2500 */
.intake-section{margin-bottom:28px}
.intake-section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.intake-badge{background:var(--amber-bg);color:var(--amber);font-size:11px;padding:2px 8px;border-radius:10px;font-family:"JetBrains Mono",monospace;margin-left:8px;font-weight:700}
.intake-list{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.intake-item{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:12px;transition:border-color 0.15s;box-shadow:0 1px 3px rgba(28,25,23,0.06)}
.intake-item:hover{border-color:var(--accent)}
.intake-item-icon{font-size:18px;flex-shrink:0;width:28px;text-align:center}
.intake-item-body{flex:1;min-width:0}
.intake-item-subject{font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.intake-item-meta{font-size:12px;color:var(--text-dim);margin-top:2px;display:flex;gap:12px;font-family:"JetBrains Mono",monospace}
.intake-item-client{color:var(--accent)}
.intake-item-actions{display:flex;gap:6px;flex-shrink:0}
.intake-confirm-btn{background:var(--green-bg);color:var(--green);border:1px solid var(--green);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;transition:all 0.15s}
.intake-confirm-btn:hover{background:var(--green);color:var(--bg)}
.intake-review-btn{background:var(--accent-glow);color:var(--accent);border:1px solid var(--accent);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;transition:all 0.15s}
.intake-review-btn:hover{background:var(--accent);color:#fff}
.intake-dismiss-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.intake-dismiss-btn:hover{border-color:var(--red);color:var(--red)}
.intake-note-btn{background:none;border:1px solid var(--border);color:var(--text-dim);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;transition:all 0.15s}
.intake-note-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-glow)}
.intake-item-check{width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0}
.intake-bulk-bar{display:none;align-items:center;gap:10px;margin-bottom:10px;padding:8px 12px;background:var(--amber-bg);border:1px solid var(--amber);border-radius:8px}
.intake-bulk-bar.show{display:flex}
.intake-bulk-count{font-size:13px;font-weight:600;color:var(--amber);flex:1}
.intake-bulk-delete-btn{background:var(--red);color:#fff;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;font-weight:600;transition:opacity 0.15s}
.intake-bulk-delete-btn:hover{opacity:0.85}
.intake-select-all-wrap{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-dim);cursor:pointer;user-select:none}
/* \u2500\u2500 Note modal \u2500\u2500 */
.note-modal-overlay{position:fixed;inset:0;background:rgba(28,25,23,0.5);z-index:200;display:flex;align-items:center;justify-content:center}
.note-modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px 28px;width:480px;max-width:92vw;box-shadow:0 8px 32px rgba(28,25,23,0.12)}
.note-modal h3{font-size:16px;font-weight:700;margin-bottom:4px;color:var(--text)}
.note-modal .sub{font-size:13px;color:var(--text-dim);margin-bottom:18px}
.note-modal label{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-muted);margin-bottom:5px;margin-top:12px}
.note-modal select{width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none;margin-bottom:4px}
.note-modal select:focus{border-color:var(--accent)}
.note-preview{background:var(--surface2);border-radius:8px;padding:10px 14px;font-size:12px;color:var(--text-dim);max-height:80px;overflow:hidden;line-height:1.5;margin-top:4px;white-space:pre-wrap;border:1px solid var(--border)}
.note-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
.note-modal-actions button{padding:8px 18px;border-radius:8px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600;font-size:13px;transition:all 0.15s}
.note-modal-actions .save-btn{background:var(--accent);color:#fff;border:none}
.note-modal-actions .save-btn:hover{opacity:0.88}
.note-modal-actions .cancel-btn{background:none;border:1px solid var(--border);color:var(--text-dim)}
.note-modal-actions .cancel-btn:hover{border-color:var(--text-dim);color:var(--text)}
.intake-upload-row{display:flex;align-items:center;gap:10px;margin-top:6px}
.intake-upload-btn{background:none;border:1px dashed var(--border);color:var(--text-dim);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-family:"DM Sans",sans-serif;transition:all 0.15s}
.intake-upload-btn:hover{border-color:var(--accent);color:var(--accent)}
/* \u2500\u2500 Intake confirm modal \u2500\u2500 */
.intake-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:200;display:flex;align-items:center;justify-content:center}
.intake-modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px 28px;width:460px;max-width:92vw;box-shadow:0 8px 32px rgba(28,25,23,0.12)}
.intake-modal h3{font-size:17px;font-weight:700;margin-bottom:6px}
.intake-modal .sub{font-size:13px;color:var(--text-dim);margin-bottom:16px}
.intake-job-preview{background:var(--surface2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;max-height:150px;overflow-y:auto;line-height:1.5}
.intake-job-preview .ijob{font-weight:600;color:var(--accent);margin-top:6px}
.intake-job-preview .ijob:first-child{margin-top:0}
.intake-job-preview .itask{padding-left:14px;color:var(--text-dim)}
.intake-modal select,.intake-modal input{width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none;margin-bottom:8px}
.intake-modal select:focus,.intake-modal input:focus{border-color:var(--accent)}
.intake-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.intake-modal-actions button{padding:8px 18px;border-radius:8px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600;font-size:13px}
.intake-modal-actions .confirm-btn{background:var(--accent);color:#fff;border:none}
.intake-modal-actions .confirm-btn:hover{opacity:0.9}
.intake-modal-actions .cancel-btn{background:none;border:1px solid var(--border);color:var(--text-dim)}
/* \u2500\u2500 Gmail settings \u2500\u2500 */
.gmail-settings{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-top:8px}
.gmail-settings-title{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:10px;font-weight:600}
.gmail-status-row{display:flex;align-items:center;gap:10px}
.gmail-dot{width:8px;height:8px;border-radius:50%;background:var(--red);flex-shrink:0;transition:background 0.2s}
.gmail-dot.connected{background:var(--green)}
.gmail-status-text{font-size:13px;flex:1}
.gmail-connect-btn{background:none;border:1px solid var(--accent);color:var(--accent);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s;flex-shrink:0}
.gmail-connect-btn:hover{background:var(--accent);color:#fff}
.gmail-checknow-btn{background:none;border:1px solid var(--border);color:var(--text-muted);padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:"DM Sans",sans-serif;transition:all 0.15s;flex-shrink:0}
.gmail-checknow-btn:hover{background:var(--surface2);color:var(--text)}
.gmail-checknow-btn:disabled{opacity:0.5;cursor:default}
.gmail-last-checked{font-size:11px;color:var(--text-dim);font-family:"JetBrains Mono",monospace;margin-top:6px}
.gmail-error-msg{font-size:11px;color:var(--red);margin-top:4px}
/* \u2500\u2500 Intake proposal split-panel page \u2500\u2500 */
.intake-split{display:grid;grid-template-columns:1fr 360px;height:calc(100vh - 90px);overflow:hidden;margin:-24px;border-top:1px solid var(--border)}
.intake-preview-panel{padding:24px;overflow-y:auto;border-right:1px solid var(--border)}
.intake-preview-panel h2{font-size:18px;font-weight:700;margin-bottom:4px}
.intake-preview-panel .intake-file-meta{font-size:13px;color:var(--text-dim);margin-bottom:20px}
.intake-client-row{display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.intake-client-row select,.intake-client-row input{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:7px 10px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none;flex:1;min-width:120px}
.intake-client-row select:focus,.intake-client-row input:focus{border-color:var(--accent)}
.add-to-client-btn{background:var(--green);color:var(--bg);border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:700;font-size:13px;white-space:nowrap;transition:opacity 0.15s}
.add-to-client-btn:hover{opacity:0.85}
.intake-jobs-list{display:flex;flex-direction:column;gap:10px}
.intake-job-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px}
.intake-job-card .ijob-name{font-weight:600;font-size:14px;color:var(--accent);margin-bottom:6px}
.intake-job-card .itask-sm{font-size:13px;color:var(--text-dim);padding:3px 0;border-bottom:1px solid var(--border);line-height:1.4}
.intake-job-card .itask-sm:last-child{border-bottom:none}
.intake-chat-panel{display:flex;flex-direction:column;background:var(--surface2)}
.intake-chat-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.chat-msg{max-width:88%;padding:9px 13px;border-radius:10px;font-size:13px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.chat-msg.user{align-self:flex-end;background:var(--accent);color:#fff;border-radius:10px 10px 2px 10px}
.chat-msg.assistant{align-self:flex-start;background:var(--surface);border:1px solid var(--border);color:var(--text);border-radius:10px 10px 10px 2px}
.intake-chat-form{padding:12px 14px;border-top:1px solid var(--border);display:flex;gap:8px;align-items:flex-end}
.intake-chat-form textarea{flex:1;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:8px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none;resize:none;min-height:38px;max-height:100px;line-height:1.4}
.intake-chat-form textarea:focus{border-color:var(--accent)}
.intake-chat-send{background:var(--accent);color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:16px;font-weight:700;transition:opacity 0.15s;flex-shrink:0}
.intake-chat-send:hover{opacity:0.85}
.intake-chat-send:disabled{opacity:0.4;cursor:default}
.intake-empty{color:var(--text-dim);font-size:13px;padding:8px 0}
@media(max-width:768px){
  .intake-split{grid-template-columns:1fr;height:auto;margin:-16px}
  .intake-preview-panel{border-right:none;border-bottom:1px solid var(--border)}
  .intake-chat-panel{height:50vh}
  .intake-item-actions{flex-direction:column}
}
/* \u2500\u2500 All Work view \u2500\u2500 */
.allwork-subtabs{display:flex;gap:4px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:3px;margin-bottom:20px;width:fit-content}
.allwork-subtab{padding:5px 18px;border-radius:5px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;color:var(--text-dim);transition:all 0.15s}
.allwork-subtab.active{background:var(--surface2);color:var(--text);border:1px solid var(--border)}
.allwork-table{width:100%;border-collapse:collapse;font-size:13px}
.allwork-table th{text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-dim);border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
.allwork-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.allwork-table tr:last-child td{border-bottom:none}
.allwork-table tr:hover td{background:var(--surface)}
.allwork-client-link{color:var(--accent);cursor:pointer;font-weight:600;text-decoration:none}
.allwork-client-link:hover{text-decoration:underline}
.allwork-progress{display:flex;align-items:center;gap:8px;white-space:nowrap}
.allwork-bar{height:4px;border-radius:2px;background:var(--surface2);flex:1;min-width:40px;overflow:hidden}
.allwork-bar-fill{height:100%;border-radius:2px;background:var(--green);transition:width 0.3s}
.allwork-progress-text{font-family:"JetBrains Mono",monospace;font-size:11px;color:var(--text-dim)}
.allwork-due{font-family:"JetBrains Mono",monospace;font-size:12px}
.allwork-due.overdue{color:var(--red)}
.allwork-due.soon{color:var(--amber)}
.allwork-due.ok{color:var(--text-dim)}
.allwork-assignee{font-size:12px;color:var(--text-dim)}
.allwork-editable-cell{cursor:pointer}
.allwork-editable-cell:hover{background:var(--surface2)!important}
.allwork-badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600}
.allwork-badge.active{background:var(--green-bg);color:var(--green)}
.allwork-count-bar{display:flex;align-items:center;padding:16px 0 20px;gap:20px;border-bottom:1px solid var(--border);margin-bottom:20px}
.allwork-count{font-size:28px;font-weight:700;font-family:"JetBrains Mono",monospace;color:var(--accent)}
.allwork-count-label{font-size:12px;color:var(--text-dim);margin-top:2px}
.allwork-count-item{text-align:center}
.allwork-empty{color:var(--text-dim);padding:40px 0;text-align:center;font-size:14px}
@media(max-width:768px){
  .allwork-table th:nth-child(n+4),.allwork-table td:nth-child(n+4){display:none}
}
/* ── Services table ── */
.services-wrap{overflow:hidden}
.services-legend{display:flex;gap:16px;align-items:center;margin-bottom:14px;font-size:12px;color:var(--text-dim);flex-wrap:wrap}
.services-table-wrap{overflow:auto;max-height:calc(100vh - 220px);border:1px solid var(--border);border-radius:10px}
.services-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--surface)}
.services-table thead tr{position:sticky;top:0;z-index:4}
.services-table th{background:var(--surface);padding:8px 10px;text-align:center;font-size:11px;font-weight:600;color:var(--text-dim);border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0;z-index:4}
.services-table th.svc-client-col,.services-table th.svc-domain-col{text-align:left}
.services-table td{padding:6px 10px;border-bottom:1px solid var(--border);text-align:center;vertical-align:middle}
.services-table tbody tr:last-child td{border-bottom:none}
.svc-client-name{font-weight:600;font-size:13px;white-space:nowrap;text-align:left!important;position:sticky;left:0;background:var(--surface);z-index:2;border-right:1px solid var(--border)}
.services-table tbody tr:nth-child(even) .svc-client-name{background:rgba(0,0,0,0.015)}
.svc-domain-cell{text-align:left!important}
.svc-domain-input{width:100%;background:transparent;border:none;border-bottom:1px solid transparent;color:var(--text-dim);font-size:11px;font-family:inherit;padding:2px 4px;outline:none;min-width:120px}
.svc-domain-input:hover{border-bottom-color:var(--border)}
.svc-domain-input:focus{border-bottom-color:var(--accent)}
.svc-cell{cursor:pointer;min-width:52px}
.svc-cell:hover{background:var(--accent-glow)}
.svc-badge{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:700}
.svc-active{background:var(--green-bg);color:var(--green)}
.svc-paused{background:var(--amber-bg);color:var(--amber)}
.svc-cancelled{background:var(--red-bg);color:var(--red)}
.svc-pending{background:var(--accent-glow);color:var(--accent);border:1px dashed var(--accent)}
.svc-website{background:var(--accent-glow);color:var(--accent)}
.svc-none{color:var(--text-muted);font-size:16px;line-height:1}
.svc-thru{display:block;font-size:9px;color:var(--text-muted);font-family:"JetBrains Mono",monospace;margin-top:1px;white-space:nowrap}
/* ── Maintenance table ── */
.maint-table-wrap{overflow:auto;max-height:calc(100vh - 220px);border:1px solid var(--border);border-radius:10px}
.maint-table{width:100%;border-collapse:collapse;font-size:12px;background:var(--surface)}
.maint-table thead tr{position:sticky;top:0;z-index:4}
.maint-table th{background:var(--surface);padding:8px 10px;text-align:left;font-size:11px;font-weight:600;color:var(--text-dim);border-bottom:1px solid var(--border);white-space:nowrap;position:sticky;top:0;z-index:4}
.maint-table td{padding:7px 10px;border-bottom:1px solid var(--border);vertical-align:middle}
.maint-table tbody tr:last-child td{border-bottom:none}
.maint-client{font-weight:600;font-size:13px;white-space:nowrap;position:sticky;left:0;background:var(--surface);z-index:2;border-right:1px solid var(--border)}
.maint-flag-red{color:var(--red);font-size:12px;white-space:nowrap}
.maint-flag-warn{color:var(--amber);font-size:12px;white-space:nowrap}
.maint-flag-ok{color:var(--green);font-size:12px;white-space:nowrap}
.maint-dim{color:var(--text-muted);font-size:12px}
.maint-loading{color:var(--text-dim);font-size:11px;font-style:italic}
.maint-date-btn{background:var(--surface2);border:1px solid var(--border);border-radius:4px;font-size:11px;padding:2px 7px;cursor:pointer;color:var(--text-dim);font-family:inherit;transition:background .15s}
.maint-date-btn:hover{background:var(--accent-glow);color:var(--accent);border-color:var(--accent)}
.maint-notes-input{background:transparent;border:none;border-bottom:1px solid transparent;color:var(--text);font-size:12px;font-family:inherit;padding:2px 4px;outline:none;width:140px}
.maint-notes-input:hover{border-bottom-color:var(--border)}
.maint-notes-input:focus{border-bottom-color:var(--accent)}
.seo-check-btn{background:var(--surface2);border:1px solid var(--border);border-radius:4px;font-size:11px;padding:2px 8px;cursor:pointer;color:var(--text-dim);font-family:inherit;transition:background .15s}
.seo-check-btn:hover{background:var(--accent-glow);color:var(--accent);border-color:var(--accent)}
.seo-score-g{color:var(--green);font-weight:700;font-size:12px}
.seo-score-y{color:var(--amber);font-weight:700;font-size:12px}
.seo-score-r{color:var(--red);font-weight:700;font-size:12px}
/* Routine board */
.rt-pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
.rt-pulse-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.rt-pulse-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.rt-pulse-label{font-size:12px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--text-dim)}
.rt-pulse-ok{font-size:11px;font-weight:600;color:var(--green);background:var(--green-bg);padding:2px 8px;border-radius:20px}
.rt-pulse-behind{font-size:11px;font-weight:700;color:var(--red);background:var(--red-bg);padding:2px 8px;border-radius:20px}
.rt-pulse-count{font-size:24px;font-weight:800;letter-spacing:-.5px}
.rt-pulse-count span{font-size:13px;font-weight:600;color:var(--text-muted)}
.rt-pulse-bar{height:5px;background:var(--surface2);border-radius:3px;margin-top:8px;overflow:hidden}
.rt-pulse-fill{height:100%;background:var(--accent);border-radius:3px;transition:width .3s}
.rt-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px}
.rt-title{font-size:16px;font-weight:700}
.rt-title .rt-sub{font-size:12px;font-weight:500;color:var(--text-muted);margin-left:8px}
.rt-gen-all{background:var(--accent);color:#fff;border:none;padding:8px 14px;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.rt-gen-all:hover{filter:brightness(1.05)}
.rt-toolbar-actions{display:flex;align-items:center;gap:8px}
.rt-add-select{font-family:inherit;font-size:13px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);cursor:pointer;max-width:220px}
.rt-add-select:focus{outline:none;border-color:var(--accent)}
.rt-remove{background:var(--surface2);border:1px solid var(--border);color:var(--text-muted);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:15px;line-height:1;padding:0}
.rt-remove:hover{color:var(--red);border-color:var(--red)}
.sprint-graduate-btn{margin-left:auto;background:var(--surface);border:1px solid var(--border);color:var(--text-dim);padding:7px 14px;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
.sprint-graduate-btn:hover{color:var(--accent);border-color:var(--accent)}
.rt-board-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.rt-board{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.rt-board thead th{background:var(--surface2);padding:8px 6px;text-align:center;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:2}
.rt-colname{font-weight:700;font-size:12px}
.rt-colcad{font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.3px}
.rt-csticky{position:sticky;left:0;z-index:3;background:var(--surface);text-align:left!important;padding:10px 14px;min-width:170px;border-right:1px solid var(--border)}
.rt-board thead th.rt-csticky{z-index:4;background:var(--surface2)}
.rt-cname{font-weight:700;font-size:13px}
.rt-cmeta{display:flex;align-items:center;gap:6px;margin-top:3px}
.rt-gen{background:var(--surface2);border:1px solid var(--border);color:var(--text-dim);width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:13px;line-height:1;padding:0}
.rt-gen:hover{color:var(--accent);border-color:var(--accent)}
.rt-last{font-size:11px;color:var(--text-muted)}
.rt-cell{text-align:center;border-top:1px solid var(--border);padding:7px 6px}
.rt-pill{display:inline-block;min-width:42px;padding:4px 8px;border-radius:20px;font-size:12px;font-weight:700;cursor:default}
.rt-pill.done{background:var(--green-bg);color:var(--green);cursor:pointer}
.rt-pill.partial{background:var(--amber-bg);color:var(--amber);cursor:pointer}
.rt-pill.pending{background:var(--surface2);color:var(--text-dim);cursor:pointer}
.rt-pill.overdue{background:var(--red-bg);color:var(--red);cursor:pointer}
.rt-pill.none{background:transparent;color:var(--text-muted);border:1px dashed var(--border);min-width:auto;padding:4px 10px}
.rt-pill.na{background:transparent;color:var(--text-muted);min-width:auto}
.rt-pill.done:hover,.rt-pill.partial:hover,.rt-pill.pending:hover,.rt-pill.overdue:hover{filter:brightness(.96);outline:2px solid var(--accent-glow)}
.rt-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--text-dim)}
.rt-legend span{display:flex;align-items:center;gap:5px}
.rt-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.rt-dot.done{background:var(--green)}.rt-dot.partial{background:var(--amber)}.rt-dot.pending{background:var(--text-muted)}.rt-dot.overdue{background:var(--red)}.rt-dot.none{background:transparent;border:1px dashed var(--text-muted)}.rt-dot.na{background:var(--surface2);border:1px solid var(--border)}
.rt-spin{animation:rtspin .7s linear infinite}@keyframes rtspin{to{transform:rotate(360deg)}}
.rt-drawer{position:fixed;top:0;right:0;bottom:0;width:420px;max-width:92vw;background:var(--surface);border-left:1px solid var(--border);box-shadow:-8px 0 32px rgba(28,25,23,.14);z-index:500;overflow-y:auto}
.rt-drawer-head{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface)}
.rt-drawer-title{font-size:15px;font-weight:700}
.rt-drawer-sub{font-size:12px;color:var(--text-muted);margin-top:2px}
.rt-drawer-close{background:none;border:none;font-size:24px;color:var(--text-dim);cursor:pointer;line-height:1}
.rt-tasklist{padding:10px 12px}
.rt-task{display:flex;align-items:flex-start;gap:10px;padding:10px 8px;border-radius:8px;cursor:pointer}
.rt-task:hover{background:var(--surface2)}
.rt-task input{margin-top:2px;width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0}
.rt-task-notes{font-size:13px;line-height:1.4;flex:1}
.rt-task.done .rt-task-notes{color:var(--text-muted);text-decoration:line-through}
.rt-task-who{font-size:11px;font-weight:700;color:var(--accent);background:var(--accent-glow);padding:2px 7px;border-radius:20px;flex-shrink:0}
</style>
</head>
<body>

<!-- \u2500\u2500 Login screen (shown when not authed) \u2500\u2500 -->
<div id="loginScreen" class="${authed ? "hidden" : ""}">
<div class="login-bg">
<div class="login-card">
  <h1>Engage<span>Engine</span> Sprint</h1>
  <div class="sub">Agency ops command center</div>
  <div class="login-field">
    <label for="pwInput">Password</label>
    <input type="password" id="pwInput" autocomplete="current-password" placeholder="Enter password..." onkeydown="if(event.key==='Enter')doLogin()">
  </div>
  <button class="login-btn" onclick="doLogin()">Enter &rarr;</button>
  <div class="login-error" id="loginError"></div>
</div>
</div>
</div>

<!-- \u2500\u2500 App (shown when authed) \u2500\u2500 -->
<div id="appShell" class="${authed ? "" : "hidden"}">

<div class="header">
  <div class="header-left">
    <div class="nav-back" id="navBack" data-action="nav-back">&#8592; Back</div>
    <h1>Engage<span>Engine</span> Sprint</h1>
    <div class="mode-tabs">
      <button class="mode-tab active" id="modeJobBtn" data-action="mode-jobs">Jobs</button>
      <button class="mode-tab" id="modeSprintBtn" data-action="mode-sprint">30-Day Sprint</button>
      <button class="mode-tab" id="modeRoutineBtn" data-action="mode-routine">Routine</button>
      <button class="mode-tab" id="modeAllWorkBtn" data-action="mode-allwork">All Work</button>
      <button class="mode-tab" id="modeServicesBtn" data-action="mode-services">Services</button>
      <button class="mode-tab" id="modeMaintenanceBtn" data-action="mode-maintenance">Maintenance</button>
      <button class="mode-tab" id="modeHealthBtn" data-action="mode-health">Health</button>
      <button class="mode-tab" id="modeActivityBtn" data-action="mode-activity">Activity</button>
      <button class="mode-tab" id="modeAgentsBtn" data-action="mode-agents">Agents</button>
      <a class="mode-tab mode-link" href="https://command-center.robertlbutt.workers.dev/attention" target="_blank" rel="noopener" title="Who is owed a reply / no personal touch — Operations Hub">Attention ↗</a>
    </div>
  </div>
  <div class="header-right">
    <div class="header-stats" id="headerStats"></div>
  </div>
</div>

<div class="container">

<!-- Jobs mode -->
<div id="jobsMode">
  <div id="briefingBanner"></div>
  <div id="dashboard">
    <div class="stats-row" id="statsRow"></div>
    <div id="intakeSection" class="intake-section hidden"></div>
    <div class="team-section-header">
      <div class="section-title" style="margin-bottom:0">Team</div>
      <button class="gear-btn" id="gearBtn" onclick="toggleGearPanel()" title="Manage team">&#9881;</button>
    </div>
    <div class="team-row" id="teamRow"></div>
    <div class="gear-panel" id="gearPanel">
      <div class="gear-panel-title">Manage Team</div>
      <div id="gearMemberList"></div>
      <div class="gear-add-form">
        <input type="text" id="newMemberName" placeholder="Member name..." onkeydown="if(event.key==='Enter')addTeamMember()">
        <button onclick="addTeamMember()">Add</button>
      </div>
    </div>
    <div class="clients-section-header">
      <div class="section-title" style="margin-bottom:0">Clients</div>
      <button class="add-client-btn" onclick="toggleAddClientForm()">+ Add Client</button>
    </div>
    <div class="add-client-form" id="addClientForm">
      <input type="text" id="newClientName" placeholder="Client name..." onkeydown="if(event.key==='Enter')addClient()">
      <button onclick="addClient()">Add</button>
      <button class="cancel-btn" onclick="toggleAddClientForm()">Cancel</button>
    </div>
    <div class="add-client-error hidden" id="addClientError"></div>
    <div class="client-grid" id="clientGrid"></div>
  </div>
  <div id="detail" class="hidden"></div>
  <div id="teamDetail" class="hidden"></div>
  <div id="intakeDetail" class="hidden"></div>
</div>

<!-- Sprint mode -->
<div id="sprintMode" class="hidden">
  <div class="sprint-client-bar" id="sprintClientBar"></div>
  <div id="sprintContent"><div class="loading">Select a client to view their sprint checklist.</div></div>
</div>

<!-- Routine mode -->
<div id="routineMode" class="hidden">
  <div id="routineContent"><div class="loading">Loading routine board...</div></div>
</div>
<div id="routineDrawer" class="rt-drawer hidden"><div class="rt-drawer-inner" id="routineDrawerInner"></div></div>

<!-- All Work mode -->
<div id="allWorkMode" class="hidden">
  <div id="allworkContent"><div class="loading">Loading...</div></div>
</div>

<!-- Services mode -->
<div id="servicesMode" class="hidden">
  <div id="servicesContent"><div class="loading">Loading...</div></div>
</div>

<!-- Maintenance mode -->
<div id="maintenanceMode" class="hidden">
  <div id="maintenanceContent"><div class="loading">Loading...</div></div>
</div>

<!-- Health mode -->
<div id="healthMode" class="hidden">
  <div id="healthContent"><div class="loading">Loading...</div></div>
</div>

<!-- Activity mode -->
<div id="activityMode" class="hidden">
  <div id="activityContent"><div class="loading">Loading...</div></div>
</div>

<!-- Agents mode -->
<div id="agentsMode" class="hidden">
  <div id="agentsContent"><div class="loading">Loading...</div></div>
</div>

</div><!-- /container -->
</div><!-- /appShell -->

<!-- Hidden file input for proposal upload -->
<input type="file" id="proposalFileInput" accept=".pdf,.txt,.doc,.docx" style="display:none" onchange="handleProposalFile(this.files[0])">

<!-- Assistant bar -->
<div class="assistant-bar" id="assistantBar">
  <div class="assistant-response" id="assistantResponse"></div>
  <div class="assistant-input-row">
    <div class="assistant-icon">\u2726</div>
    <input type="text" id="assistantInput" class="assistant-input" placeholder="Create a job, add a task, ask anything\u2026" autocomplete="off">
    <button class="assistant-send" id="assistantSend" data-action="assistant-send">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L14 8M14 8L9 3M14 8L9 13" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</div>

<!-- Snackbar -->
<div class="snackbar" id="snackbar" role="status" aria-live="polite">
  <span id="snackbarMsg">Task deleted</span>
  <button class="snackbar-undo" onclick="undoDelete()">Undo</button>
</div>

<script>
var API = '';
var dashboardData = null;
var currentClientId = null;
var currentTeamName = null;
var currentMode = 'jobs';
var teamMembers = [];

// Snackbar / optimistic delete state
var deleteTimer = null;
var deletePendingId = null;
var deletePendingEl = null;
var deletePendingJobId = null;

// Sprint state
var sprintClientId = null;
var sprintItems = {};
var sprintPhase = 'preSprint';

// Intake state
var currentIntakeId = null;
var intakeConfirmData = null;

// Activity feed state
var activityFeedData = null;
var activityToolFilter = '';
var activityDueData = null;
var activityScoreboard = null;

// \u2500\u2500 Utilities \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function esc(s){if(!s)return'';return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')}
function formatDate(d){if(!d)return'';var p=d.split('-');return p[1]+'/'+p[2]}
function daysDiff(a,b){return Math.ceil((new Date(b)-new Date(a))/86400000)}

// \u2500\u2500 Login \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function doLogin() {
  var pw = document.getElementById('pwInput').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  var res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw })
  });
  if (res.ok) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    loadDashboard();
  } else {
    err.textContent = 'Incorrect password';
  }
}

// \u2500\u2500 Event delegation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var act = el.getAttribute('data-action');
  var id = el.getAttribute('data-id') || '';
  var val = el.getAttribute('data-val') || '';
  if (act === 'mode-jobs') { switchMode('jobs'); }
  else if (act === 'mode-sprint') { switchMode('sprint'); }
  else if (act === 'mode-routine') { switchMode('routine'); }
  else if (act === 'mode-allwork') { switchMode('allwork'); }
  else if (act === 'mode-services') { switchMode('services'); }
  else if (act === 'mode-maintenance') { switchMode('maintenance'); }
  else if (act === 'mode-health') { switchMode('health'); }
  else if (act === 'mode-activity') { switchMode('activity'); }
  else if (act === 'mode-agents') { switchMode('agents'); }
  else if (act === 'allwork-tab') { switchAllWorkTab(val); }
  else if (act === 'allwork-goto-client') { switchMode('jobs'); loadClient(id); }
  else if (act === 'allwork-job-complete') { completeAllWorkJob(id); }
  else if (act === 'allwork-job-edit') { openAllWorkJobEdit(el); }
  else if (act === 'allwork-job-save') { saveAllWorkJobEdit(id); }
  else if (act === 'allwork-job-cancel') { renderAllWork(); }
  else if (act === 'nav-back') { showDashboard(); }
  else if (act === 'load-client') { loadClient(id); }
  else if (act === 'load-team') { loadTeam(val); }
  else if (act === 'toggle-tasks') { el.classList.toggle('collapsed'); var tl = el.nextElementSibling; if (tl) tl.classList.toggle('hidden'); }
  else if (act === 'task-toggle') { toggleTask(id, val === '1', currentClientId, currentTeamName); }
  else if (act === 'task-edit') { openTaskEdit(id); }
  else if (act === 'task-save') { saveTaskEdit(id, val); }
  else if (act === 'task-cancel-edit') { cancelTaskEdit(id); }
  else if (act === 'task-delete') { deleteTask(id, val); }
  else if (act === 'job-complete') { completeJob(id, currentClientId); }
  else if (act === 'job-reopen') { reopenJob(id, currentClientId); }
  else if (act === 'job-edit') { openJobEdit(id); }
  else if (act === 'job-save') { saveJobEdit(id); }
  else if (act === 'job-cancel-edit') { cancelJobEdit(id); }
  else if (act === 'job-notes') { toggleJobNotes(id); }
  else if (act === 'job-notes-save') { saveJobNotes(id); }
  else if (act === 'job-notes-cancel') { cancelJobNotes(id); }
  else if (act === 'toggle-add-job') { toggleAddJob(id); }
  else if (act === 'create-job') { createJob(id); }
  else if (act === 'toggle-add-task') { toggleAddTask(id); }
  else if (act === 'create-task') { createTask(id, val); }
  else if (act === 'log-save-today') { saveLogToday(val); }
  else if (act === 'log-delete') { deleteLog(id, val); }
  else if (act === 'client-rename') { renameClient(id); }
  else if (act === 'client-archive') { archiveClient(id, val); }
  else if (act === 'team-remove') { removeTeamMember(id); }
  else if (act === 'sprint-select-client') { loadSprintClient(id); }
  else if (act === 'sprint-phase') { sprintPhase = id; renderSprintChecklist(); }
  else if (act === 'sprint-toggle-item') { toggleSprintItem(id); }
  else if (act === 'sprint-toggle-section') { var items = el.parentElement.querySelector('.sprint-section-items'); if (items) items.classList.toggle('hidden'); }
  else if (act === 'sprint-activate') { showActivateModal(); }
  else if (act === 'sprint-activate-confirm') { activateSprintClient(); }
  else if (act === 'sprint-activate-cancel') { closeActivateModal(); }
  else if (act === 'dismiss-briefing') { document.getElementById('briefingBanner').innerHTML = ''; }
  else if (act === 'select-template') { selectTemplate(id, val, el.getAttribute('data-name') || '', parseInt(el.getAttribute('data-count') || '0')); }
  else if (act === 'intake-confirm') { showIntakeConfirmModal(id); }
  else if (act === 'intake-save-note') { showIntakeNoteModal(id); }
  else if (act === 'assistant-send') { sendAssistantMessage(); }
  else if (act === 'note-modal-cancel') { closeNoteModal(); }
  else if (act === 'note-modal-save') { saveIntakeNote(id); }
  else if (act === 'intake-dismiss') { dismissIntakeItem(id); }
  else if (act === 'intake-review') { loadIntakeDetail(id); }
  else if (act === 'intake-modal-cancel') { closeIntakeModal(); }
  else if (act === 'intake-modal-confirm') { confirmIntakeFromModal(); }
  else if (act === 'gmail-connect') { window.location.href = '/api/gmail/auth'; }
  else if (act === 'intake-chat-send') { sendIntakeChat(); }
  else if (act === 'intake-add-to-client') { confirmIntakeProposal(id); }
  else if (act === 'upload-proposal') { document.getElementById('proposalFileInput').click(); }
  else if (act === 'portal-create') { portalCreate(id); }
  else if (act === 'portal-revoke') { portalRevoke(id); }
  else if (act === 'portal-copy') { navigator.clipboard.writeText(val).then(function(){ showSnackbar('Link copied!'); }); }
  else if (act === 'loop-outcome') { recordLoopOutcome(id, val); }
});

document.addEventListener('change', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var act = el.getAttribute('data-action');
  if (act === 'note-client-change') { loadNoteJobSelect(el.value); }
  else if (act === 'activity-filter-tool') { activityToolFilter = el.value; loadActivityFeed(); }
});

// \u2500\u2500 Mode switching \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function switchMode(mode) {
  currentMode = mode;
  document.getElementById('modeJobBtn').classList.toggle('active', mode === 'jobs');
  document.getElementById('modeSprintBtn').classList.toggle('active', mode === 'sprint');
  document.getElementById('modeRoutineBtn').classList.toggle('active', mode === 'routine');
  document.getElementById('modeAllWorkBtn').classList.toggle('active', mode === 'allwork');
  document.getElementById('modeServicesBtn').classList.toggle('active', mode === 'services');
  document.getElementById('modeMaintenanceBtn').classList.toggle('active', mode === 'maintenance');
  document.getElementById('modeHealthBtn').classList.toggle('active', mode === 'health');
  document.getElementById('modeActivityBtn').classList.toggle('active', mode === 'activity');
  document.getElementById('modeAgentsBtn').classList.toggle('active', mode === 'agents');
  document.getElementById('jobsMode').classList.toggle('hidden', mode !== 'jobs');
  document.getElementById('sprintMode').classList.toggle('hidden', mode !== 'sprint');
  document.getElementById('routineMode').classList.toggle('hidden', mode !== 'routine');
  document.getElementById('allWorkMode').classList.toggle('hidden', mode !== 'allwork');
  document.getElementById('servicesMode').classList.toggle('hidden', mode !== 'services');
  document.getElementById('maintenanceMode').classList.toggle('hidden', mode !== 'maintenance');
  document.getElementById('healthMode').classList.toggle('hidden', mode !== 'health');
  document.getElementById('activityMode').classList.toggle('hidden', mode !== 'activity');
  document.getElementById('agentsMode').classList.toggle('hidden', mode !== 'agents');
  document.getElementById('navBack').style.display = 'none';
  if (mode === 'jobs') {
    document.getElementById('headerStats').style.display = '';
    if (dashboardData) renderDashboard(); else loadDashboard();
  } else if (mode === 'sprint') {
    document.getElementById('headerStats').style.display = 'none';
    renderSprintClientBar();
  } else if (mode === 'routine') {
    document.getElementById('headerStats').style.display = 'none';
    loadRoutine();
  } else if (mode === 'allwork') {
    document.getElementById('headerStats').style.display = 'none';
    loadAllWork();
  } else if (mode === 'services') {
    document.getElementById('headerStats').style.display = 'none';
    loadServices();
  } else if (mode === 'maintenance') {
    document.getElementById('headerStats').style.display = 'none';
    loadMaintenance();
  } else if (mode === 'health') {
    document.getElementById('headerStats').style.display = 'none';
    loadClientHealth();
  } else if (mode === 'activity') {
    document.getElementById('headerStats').style.display = 'none';
    loadActivityFeed();
  } else if (mode === 'agents') {
    document.getElementById('headerStats').style.display = 'none';
    loadAgentsFeed();
  }
}

// \u2500\u2500 All Work \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

// ── Routine board ──────────────────────────────────────────────────────────
var routineData = null;
var ROUTINE_SHORT = {'rt-seo':'SEO','rt-social':'Social','rt-cro':'CRO','rt-ads':'Ads','rt-daily':'Daily','rt-weekly':'Weekly','rt-weeklyemail':'W-Email','rt-monthly-report':'Report','rt-rediagnose':'Re-Dx'};

async function loadRoutine() {
  document.getElementById('routineContent').innerHTML = '<div class="loading">Loading routine board...</div>';
  var res = await fetch(API + '/api/routine/board');
  if (res.status === 401) { showLoginScreen(); return; }
  routineData = await res.json();
  renderRoutine();
}

function rtRelative(iso) {
  if (!iso) return 'never';
  var d = new Date(iso.replace(' ', 'T') + 'Z');
  var days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + 'd ago';
}

function renderRoutine() {
  var d = routineData;
  if (!d || !d.templates) { document.getElementById('routineContent').innerHTML = '<div class="loading">No data.</div>'; return; }
  var cadLabel = {daily:'Daily', weekly:'Weekly', monthly:'Monthly', '45day':'45-Day'};
  // Pulse strip
  var pulse = '<div class="rt-pulse">';
  var order = ['daily','weekly','monthly','45day'];
  for (var pi=0; pi<order.length; pi++) {
    var cad = order[pi]; var p = d.pulse[cad] || {total:0,done:0,overdue:0};
    var pct = p.total ? Math.round(p.done / p.total * 100) : 0;
    var behind = (p.overdue||0);
    pulse += '<div class="rt-pulse-card">'
      + '<div class="rt-pulse-top"><span class="rt-pulse-label">' + cadLabel[cad] + '</span>'
      + (behind ? '<span class="rt-pulse-behind">' + behind + ' overdue</span>' : '<span class="rt-pulse-ok">on track</span>') + '</div>'
      + '<div class="rt-pulse-count">' + p.done + '<span>/' + p.total + ' done</span></div>'
      + '<div class="rt-pulse-bar"><div class="rt-pulse-fill" style="width:' + pct + '%"></div></div>'
      + '</div>';
  }
  pulse += '</div>';
  // Toolbar
  var avail = d.availableClients || [];
  var addCtl = '';
  if (avail.length) {
    addCtl = '<select id="rtAddSelect" class="rt-add-select" onchange="addClientToRoutine(this.value)"><option value="">+ Add client to routine\\u2026</option>';
    for (var ai=0; ai<avail.length; ai++) addCtl += '<option value="' + avail[ai].id + '">' + esc(avail[ai].name) + '</option>';
    addCtl += '</select>';
  }
  var bar = '<div class="rt-toolbar">'
    + '<div class="rt-title">Client Operating Routine <span class="rt-sub">' + d.clients.length + ' on routine &middot; ' + d.templates.length + ' tracks &middot; ' + d.today + '</span></div>'
    + '<div class="rt-toolbar-actions">' + addCtl
    + '<button class="rt-gen-all" onclick="generateRoutine(null,this)">&#8635; Generate all due</button>'
    + '</div></div>';
  // Matrix
  var t = '<div class="rt-board-wrap"><table class="rt-board"><thead><tr><th class="rt-csticky">Client</th>';
  for (var ti=0; ti<d.templates.length; ti++) {
    var tm = d.templates[ti];
    t += '<th title="' + esc(tm.name) + '"><div class="rt-colname">' + (ROUTINE_SHORT[tm.id] || esc(tm.name)) + '</div><div class="rt-colcad">' + (cadLabel[tm.cadence]||tm.cadence) + '</div></th>';
  }
  t += '</tr></thead><tbody>';
  for (var ci=0; ci<d.clients.length; ci++) {
    var c = d.clients[ci];
    t += '<tr><td class="rt-csticky"><div class="rt-cname">' + esc(c.name) + '</div>'
      + '<div class="rt-cmeta"><button class="rt-gen" title="Generate this client\\'s cycle" onclick="generateRoutine(\\'' + c.id + '\\',this)">&#8635;</button>'
      + '<button class="rt-remove" title="Remove from routine" onclick="removeClientFromRoutine(\\'' + c.id + '\\',\\'' + esc(c.name).split("\\'").join("") + '\\')">&times;</button>'
      + '<span class="rt-last">gen ' + rtRelative(d.lastGenerated[c.id]) + '</span></div></td>';
    for (var ki=0; ki<d.templates.length; ki++) {
      var tmid = d.templates[ki].id;
      var cell = (d.cells[c.id] && d.cells[c.id][tmid]) || {status:'na'};
      t += renderRoutineCell(c.id, tmid, cell);
    }
    t += '</tr>';
  }
  t += '</tbody></table></div>';
  var legend = '<div class="rt-legend">'
    + '<span><i class="rt-dot done"></i>Done</span>'
    + '<span><i class="rt-dot partial"></i>In progress</span>'
    + '<span><i class="rt-dot pending"></i>Not started</span>'
    + '<span><i class="rt-dot overdue"></i>Overdue</span>'
    + '<span><i class="rt-dot none"></i>Not generated</span>'
    + '<span><i class="rt-dot na"></i>N/A (no service)</span>'
    + '</div>';
  document.getElementById('routineContent').innerHTML = pulse + bar + t + legend;
}

function renderRoutineCell(clientId, tmid, cell) {
  if (!cell.applicable) return '<td class="rt-cell"><span class="rt-pill na">&mdash;</span></td>';
  if (cell.status === 'none') return '<td class="rt-cell"><span class="rt-pill none" title="Not generated this cycle">&middot;</span></td>';
  var label = (cell.status === 'done') ? '&#10003; ' + cell.done + '/' + cell.total : cell.done + '/' + cell.total;
  var click = cell.job_id ? ' onclick="openRoutineDrawer(\\'' + cell.job_id + '\\')"' : '';
  return '<td class="rt-cell"><span class="rt-pill ' + cell.status + '"' + click + '>' + label + '</span></td>';
}

async function generateRoutine(clientId, btn) {
  if (btn) { btn.disabled = true; btn.classList.add('rt-spin'); }
  var body = clientId ? JSON.stringify({client_id: clientId}) : '{}';
  var res = await fetch(API + '/api/routine/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: body});
  var j = await res.json().catch(function(){ return {}; });
  showSnackbar(j.created != null ? (j.created + ' cycle' + (j.created===1?'':'s') + ' generated') : 'Generated');
  await loadRoutine();
}

async function addClientToRoutine(clientId) {
  if (!clientId) return;
  await fetch(API + '/api/routine/client/' + clientId + '/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on_routine: 1 }) });
  showSnackbar('Added to routine');
  await loadRoutine();
}

async function removeClientFromRoutine(clientId, name) {
  if (!clientId) return;
  if (!confirm('Remove ' + (name || 'this client') + ' from the operating routine?\\n\\nThey stop getting new routine cycles. Existing jobs stay. Reversible.')) return;
  await fetch(API + '/api/routine/client/' + clientId + '/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ on_routine: 0 }) });
  showSnackbar('Removed from routine');
  await loadRoutine();
}

async function openRoutineDrawer(jobId) {
  var drawer = document.getElementById('routineDrawer');
  var inner = document.getElementById('routineDrawerInner');
  inner.innerHTML = '<div class="loading">Loading...</div>';
  drawer.classList.remove('hidden');
  var res = await fetch(API + '/api/routine/job/' + jobId + '/tasks');
  var j = await res.json();
  var job = j.job || {}; var tasks = j.tasks || [];
  var doneN = tasks.filter(function(x){ return x.status === 'Complete'; }).length;
  var h = '<div class="rt-drawer-head"><div><div class="rt-drawer-title">' + esc(job.name || 'Routine') + '</div>'
    + '<div class="rt-drawer-sub">' + esc(job.client_name || '') + ' &middot; ' + doneN + '/' + tasks.length + ' done</div></div>'
    + '<button class="rt-drawer-close" onclick="closeRoutineDrawer()">&times;</button></div><div class="rt-tasklist">';
  for (var i=0; i<tasks.length; i++) {
    var tk = tasks[i]; var done = tk.status === 'Complete';
    h += '<label class="rt-task' + (done?' done':'') + '"><input type="checkbox" ' + (done?'checked':'') + ' onchange="toggleRoutineTask(\\'' + tk.id + '\\', this.checked)">'
      + '<span class="rt-task-notes">' + esc(tk.notes) + '</span>'
      + (tk.assigned_to ? '<span class="rt-task-who">' + esc(tk.assigned_to) + '</span>' : '') + '</label>';
  }
  h += '</div>';
  inner.innerHTML = h;
}

function closeRoutineDrawer() {
  document.getElementById('routineDrawer').classList.add('hidden');
  loadRoutine();
}

async function toggleRoutineTask(taskId, checked) {
  var ep = checked ? '/api/tasks/' + taskId + '/complete' : '/api/tasks/' + taskId + '/reopen';
  await fetch(API + ep, {method:'POST'});
}

var allWorkData = null;
var allWorkTab = 'jobs';

async function loadAllWork() {
  document.getElementById('allworkContent').innerHTML = '<div class="loading">Loading...</div>';
  var res = await fetch(API + '/api/allwork');
  if (res.status === 401) { showLoginScreen(); return; }
  allWorkData = await res.json();
  if (!teamMembers.length) {
    var tr = await fetch(API + '/api/team');
    if (tr.ok) teamMembers = await tr.json();
  }
  renderAllWork();
}

function switchAllWorkTab(tab) {
  allWorkTab = tab;
  renderAllWork();
}

function renderAllWork() {
  var d = allWorkData;
  if (!d) return;
  var today = new Date(); today.setHours(0,0,0,0);
  var soon = new Date(today); soon.setDate(today.getDate() + 3);

  var openTasks = d.tasks.length;
  var totalJobs = d.jobs.length;

  var html = '<div class="allwork-count-bar">';
  html += '<div class="allwork-count-item"><div class="allwork-count">' + totalJobs + '</div><div class="allwork-count-label">Active Jobs</div></div>';
  html += '<div class="allwork-count-item"><div class="allwork-count">' + openTasks + '</div><div class="allwork-count-label">Open Tasks</div></div>';
  html += '</div>';

  html += '<div class="allwork-subtabs">';
  html += '<button class="allwork-subtab' + (allWorkTab === 'jobs' ? ' active' : '') + '" data-action="allwork-tab" data-val="jobs">Jobs (' + totalJobs + ')</button>';
  html += '<button class="allwork-subtab' + (allWorkTab === 'tasks' ? ' active' : '') + '" data-action="allwork-tab" data-val="tasks">Open Tasks (' + openTasks + ')</button>';
  html += '</div>';

  if (allWorkTab === 'jobs') {
    if (!d.jobs.length) {
      html += '<div class="allwork-empty">No active jobs across any client.</div>';
    } else {
      html += '<table class="allwork-table"><thead><tr>';
      html += '<th>Client</th><th>Job</th><th>Open/Total</th><th>Assigned</th><th>Due</th><th></th>';
      html += '</tr></thead><tbody>';
      for (var i = 0; i < d.jobs.length; i++) {
        var j = d.jobs[i];
        var jDueClass = 'ok', jDueLabel = j.due_date ? formatDate(j.due_date) : '\u2014';
        if (j.due_date) {
          var jDue = new Date(j.due_date + 'T00:00:00');
          if (jDue < today) { jDueClass = 'overdue'; jDueLabel = '\u26A0 ' + formatDate(j.due_date); }
          else if (jDue <= soon) { jDueClass = 'soon'; }
        }
        html += '<tr id="allwork-job-row-' + j.id + '">';
        html += '<td><a class="allwork-client-link" data-action="allwork-goto-client" data-id="' + esc(j.client_id) + '">' + esc(j.client_name) + '</a></td>';
        html += '<td>' + esc(j.name) + '</td>';
        html += '<td><span class="allwork-progress-text">' + j.open_tasks + ' / ' + j.total_tasks + '</span></td>';
        html += '<td id="allwork-job-assign-' + j.id + '" class="allwork-editable-cell" data-action="allwork-job-edit" data-id="' + j.id + '" title="Click to edit"><span class="allwork-assignee">' + esc(j.assigned_to || '\u2014') + '</span></td>';
        html += '<td id="allwork-job-due-' + j.id + '" class="allwork-editable-cell" data-action="allwork-job-edit" data-id="' + j.id + '" title="Click to edit"><span class="allwork-due ' + jDueClass + '">' + esc(jDueLabel) + '</span></td>';
        html += '<td id="allwork-job-btns-' + j.id + '" style="white-space:nowrap">';
        html += '<button class="job-complete-btn" data-action="allwork-job-complete" data-id="' + j.id + '" style="font-size:11px;padding:3px 8px">Complete</button>';
        html += '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
  } else {
    if (!d.tasks.length) {
      html += '<div class="allwork-empty">No open tasks \u2014 all caught up!</div>';
    } else {
      html += '<table class="allwork-table"><thead><tr>';
      html += '<th>Client</th><th>Job</th><th>Task</th><th>Assignee</th><th>Due</th>';
      html += '</tr></thead><tbody>';
      for (var k = 0; k < d.tasks.length; k++) {
        var t = d.tasks[k];
        var dueClass = 'ok', dueLabel = t.due_date ? formatDate(t.due_date) : '\u2014';
        if (t.due_date) {
          var due = new Date(t.due_date + 'T00:00:00');
          if (due < today) { dueClass = 'overdue'; dueLabel = '\u26A0 ' + formatDate(t.due_date); }
          else if (due <= soon) { dueClass = 'soon'; }
        }
        html += '<tr>';
        html += '<td><a class="allwork-client-link" data-action="allwork-goto-client" data-id="' + esc(t.client_id) + '">' + esc(t.client_name) + '</a></td>';
        html += '<td>' + esc(t.job_name) + '</td>';
        html += '<td>' + esc(t.name) + '</td>';
        html += '<td><span class="allwork-assignee">' + esc(t.assigned_to || '\u2014') + '</span></td>';
        html += '<td><span class="allwork-due ' + dueClass + '">' + esc(dueLabel) + '</span></td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
    }
  }

  document.getElementById('allworkContent').innerHTML = html;
}

function openAllWorkJobEdit(el) {
  var jobId = el.getAttribute('data-id');
  var assignCell = document.getElementById('allwork-job-assign-' + jobId);
  if (!assignCell) return;
  // Already in edit mode \u2014 don't re-open
  if (assignCell.querySelector('select')) return;
  var jobData = allWorkData ? (allWorkData.jobs || []).find(function(j) { return j.id === jobId; }) : null;
  var currentAssign = jobData ? (jobData.assigned_to || '') : '';
  var currentDue = jobData ? (jobData.due_date || '') : '';
  var dueCell = document.getElementById('allwork-job-due-' + jobId);
  var btnsCell = document.getElementById('allwork-job-btns-' + jobId);
  var inputStyle = 'font-size:12px;padding:3px 6px;background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px';
  assignCell.innerHTML = '<select id="awJobAssign-' + jobId + '" style="' + inputStyle + '"><option value="">Unassigned</option>' + teamOptionsSelected(currentAssign) + '</select>';
  dueCell.innerHTML = '<input type="date" id="awJobDue-' + jobId + '" value="' + currentDue + '" style="' + inputStyle + '">';
  btnsCell.innerHTML = '<button class="save-btn" data-action="allwork-job-save" data-id="' + jobId + '" style="font-size:11px;padding:3px 8px">Save</button> <button class="cancel-edit-btn" data-action="allwork-job-cancel" style="font-size:11px;padding:3px 8px">Cancel</button>';
}

async function saveAllWorkJobEdit(jobId) {
  var assign = document.getElementById('awJobAssign-' + jobId);
  var due = document.getElementById('awJobDue-' + jobId);
  var jobData = allWorkData ? (allWorkData.jobs || []).find(function(j) { return j.id === jobId; }) : null;
  var name = jobData ? (jobData.name || '') : '';
  var res = await fetch(API + '/api/jobs/' + jobId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name, assigned_to: assign ? assign.value : '', due_date: due ? due.value : '' })
  });
  if (!res.ok) { alert('Save failed \u2014 please try again'); return; }
  await loadAllWork();
}

async function completeAllWorkJob(jobId) {
  await fetch(API + '/api/jobs/' + jobId + '/complete', { method: 'POST' });
  loadAllWork();
}

// \u2500\u2500 Dashboard \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function loadDashboard() {
  document.getElementById('clientGrid').innerHTML = '<div class="loading">Loading...</div>';
  var res = await fetch(API + '/api/dashboard');
  if (res.status === 401) { showLoginScreen(); return; }
  dashboardData = await res.json();
  // Load team members for dropdowns
  var tr = await fetch(API + '/api/team');
  if (tr.ok) teamMembers = await tr.json();
  renderDashboard();
  loadIntakeSection();
  // Handle Gmail OAuth return params
  var searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('gmail_connected')) {
    history.replaceState(null, '', '/');
    setTimeout(loadIntakeSection, 500);
  } else if (searchParams.get('gmail_error')) {
    history.replaceState(null, '', '/');
    alert('Gmail connection failed: ' + searchParams.get('gmail_error'));
  }
}

function renderDashboard() {
  var d = dashboardData;
  var clients = d.clients, stats = d.stats, team = d.team, briefing = d.briefing;
  // Briefing banner
  var bb = document.getElementById('briefingBanner');
  if (briefing && (briefing.overdue > 0 || briefing.due_today > 0)) {
    var parts = [];
    if (briefing.overdue > 0) parts.push('<strong>' + briefing.overdue + ' overdue</strong>');
    if (briefing.due_today > 0) parts.push('<strong>' + briefing.due_today + ' due today</strong>');
    bb.innerHTML = '<div class="briefing-banner"><span>&#9888; ' + parts.join(', ') + ' \u2014 check client cards below</span><button class="briefing-dismiss" data-action="dismiss-briefing" title="Dismiss">&times;</button></div>';
  } else if (briefing) {
    bb.innerHTML = '<div class="briefing-clear"><span>&#10003; All clear \u2014 no overdue or due-today tasks</span><button class="briefing-dismiss" data-action="dismiss-briefing" title="Dismiss">&times;</button></div>';
  }
  // Header stats
  document.getElementById('headerStats').innerHTML = '<div><span class="sv">' + stats.active_clients + '</span> clients</div><div><span class="sv">' + stats.active_jobs + '</span> jobs</div><div><span class="sv">' + stats.open_tasks + '</span> open</div>';
  // Stats row
  document.getElementById('statsRow').innerHTML =
    statCard('Active Clients', stats.active_clients, 'accent') +
    statCard('Active Jobs', stats.active_jobs, '') +
    statCard('Open Tasks', stats.open_tasks, 'amber') +
    statCard('Completed', stats.done_tasks, 'green');
  // Team row
  var teamHtml = '';
  for (var i = 0; i < team.length; i++) {
    var t = team[i];
    teamHtml += '<div class="team-card" data-action="load-team" data-val="' + encodeURIComponent(t.name) + '"><div class="team-avatar">' + t.name.charAt(0).toUpperCase() + '</div><div><div class="team-name">' + esc(t.name) + '</div><div class="team-tasks">' + t.assigned_tasks + ' tasks</div></div></div>';
  }
  document.getElementById('teamRow').innerHTML = teamHtml;
  // Gear panel member list
  var gml = document.getElementById('gearMemberList');
  if (gml) {
    var gmHtml = '';
    for (var i = 0; i < teamMembers.length; i++) {
      var m = teamMembers[i];
      gmHtml += '<div class="gear-member-row"><span class="gear-member-name">' + esc(m.name) + '</span><button class="remove-btn" data-action="team-remove" data-id="' + m.id + '">Remove</button></div>';
    }
    if (!teamMembers.length) gmHtml = '<div style="font-size:13px;color:var(--text-dim);padding:8px 0">No team members yet \u2014 add one below</div>';
    gml.innerHTML = gmHtml;
  }
  // Client grid with health scoring
  var active = clients.filter(function(c) { return c.active_jobs > 0 || c.open_tasks > 0 });
  var inactive = clients.filter(function(c) { return c.active_jobs === 0 && c.open_tasks === 0 });
  var grid = '';
  for (var i = 0; i < active.length; i++) grid += clientCard(active[i]);
  if (inactive.length) grid += '<div style="grid-column:1/-1;margin-top:24px;padding-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px"><span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">No Active Work</span><span style="flex:1;height:1px;background:var(--border)"></span></div>';
  for (var i = 0; i < inactive.length; i++) grid += clientCard(inactive[i], true);
  document.getElementById('clientGrid').innerHTML = grid;
  // Show dashboard, hide detail
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('detail').classList.add('hidden');
  document.getElementById('teamDetail').classList.add('hidden');
  document.getElementById('navBack').style.display = 'none';
  currentClientId = null;
  currentTeamName = null;
}

function statCard(label, value, color) {
  return '<div class="stat-card"><div class="label">' + label + '</div><div class="value ' + color + '">' + value + '</div></div>';
}

function clientCard(c, inactive) {
  var health = '';
  if (c.overdue_tasks > 0) health = ' health-red';
  else if (c.soon_tasks > 0) health = ' health-amber';
  else if (c.active_jobs > 0) health = ' health-green';
  var inactiveStyle = inactive ? ' style="background:var(--surface2);box-shadow:none;opacity:0.75"' : '';
  return '<div class="client-card' + health + '"' + inactiveStyle + ' data-action="load-client" data-id="' + c.id + '"><div class="client-name">' + esc(c.name) + '</div><div class="client-meta"><span class="jobs">' + c.active_jobs + ' jobs</span><span class="open">' + c.open_tasks + ' open</span><span class="done">' + c.done_tasks + ' done</span></div></div>';
}

// \u2500\u2500 Client detail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function loadClient(id) {
  currentClientId = id;
  currentTeamName = null;
  document.getElementById('detail').innerHTML = '<div class="loading">Loading...</div>';
  document.getElementById('detail').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('navBack').style.display = 'flex';
  var res = await fetch(API + '/api/clients/' + id);
  if (res.status === 401) { showLoginScreen(); return; }
  var data = await res.json();
  renderClientDetail(data);
}

function renderClientDetail(data) {
  var client = data.client, jobs = data.jobs, tasks = data.tasks;
  var today = new Date().toISOString().split('T')[0];
  var openCount = tasks.filter(function(t) { return t.status !== 'Complete' }).length;
  var html = '<div class="detail-header">';
  html += '<div><h2 id="clientNameDisplay">' + esc(client.name) + '</h2><div class="sub">' + jobs.length + ' jobs &middot; ' + openCount + ' open tasks</div></div>';
  html += '<div class="detail-header-actions">';
  html += '<button class="edit-btn" data-action="client-rename" data-id="' + client.id + '">&#9998; Rename</button>';
  html += '<button class="archive-btn" data-action="client-archive" data-id="' + client.id + '" data-val="' + client.active_jobs + '">Archive</button>';
  html += '</div></div>';
  // Client notes
  html += '<div class="client-notes-wrap">';
  html += '<div class="client-notes" id="clientNotes" contenteditable="true" aria-label="Client notes" data-client-id="' + client.id + '" data-placeholder="Add client context...">' + esc(client.notes || '') + '</div>';
  html += '<div class="notes-saved" id="notesSaved">Saved</div>';
  html += '<div class="notes-error" id="notesError">Save failed</div>';
  html += '</div>';
  // Google Ads Portal
  html += '<div id="portalSection" style="margin:16px 0 8px"></div>';
  // Active jobs
  var activeJobs = jobs.filter(function(j) { return j.status === 'Active'; });
  var completeJobs = jobs.filter(function(j) { return j.status === 'Complete'; });
  for (var i = 0; i < activeJobs.length; i++) {
    html += renderJobSection(activeJobs[i], tasks.filter(function(t) { return t.job_id === activeJobs[i].id; }), client.id, today, false);
  }
  // Add job with template pills
  html += renderAddJobForm(client.id);
  if (completeJobs.length) {
    html += '<div class="section-title" style="margin-top:24px">Completed Jobs</div>';
    for (var i = 0; i < completeJobs.length; i++) {
      html += renderJobSection(completeJobs[i], tasks.filter(function(t) { return t.job_id === completeJobs[i].id; }), client.id, today, true);
    }
  }
  html += '<div id="clientActivity" style="margin-top:8px"></div>';
  document.getElementById('detail').innerHTML = html;
  // Wire up notes save on blur
  var notesEl = document.getElementById('clientNotes');
  if (notesEl) {
    // Show placeholder behavior
    if (!notesEl.textContent.trim()) notesEl.style.color = 'var(--text-dim)';
    notesEl.addEventListener('focus', function() { this.style.color = ''; });
    notesEl.addEventListener('blur', function() {
      saveClientNotes(client.id, this.textContent);
      if (!this.textContent.trim()) this.style.color = 'var(--text-dim)';
    });
    notesEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.blur(); }
    });
  }
  // Load templates for add job form
  loadTemplatesForForm(client.id);
  // Load portal section
  loadPortalSection(client.id);
  // Load activity spine timeline
  loadClientActivity(client.id);
}

function renderJobSection(job, tasks, clientId, today, collapsed) {
  var isActive = job.status === 'Active';
  var dueClass = '';
  if (isActive && job.due_date) { dueClass = job.due_date < today ? 'overdue' : (daysDiff(today, job.due_date) <= 3 ? 'soon' : ''); }
  var btnHtml = isActive
    ? '<button class="job-complete-btn" data-action="job-complete" data-id="' + job.id + '">Complete</button>'
    : '<button class="job-complete-btn reopen" data-action="job-reopen" data-id="' + job.id + '">Reopen</button>';
  var html = '<div class="job-section" id="job-row-' + job.id + '"><div class="job-header' + (collapsed ? ' collapsed' : '') + '">';
  html += '<div class="job-title" data-action="toggle-tasks">' + esc(job.name) + ' <span style="color:var(--text-dim);font-weight:400;font-size:12px">' + job.open_tasks + '/' + job.total_tasks + '</span></div>';
  html += '<div class="job-actions">';
  var jaClass = 'job-assign-select' + (job.assigned_to ? ' has-assignee' : '');
  html += '<select class="' + jaClass + '" onchange="quickAssignJob(this, \\'' + job.id + '\\')">';
  html += '<option value="">Assign...</option>' + teamOptionsSelected(job.assigned_to || '');
  html += '</select>';
  if (job.due_date) html += '<span class="task-due ' + dueClass + '">' + formatDate(job.due_date) + '</span>';
  var hasNotes = job.notes && String(job.notes).trim();
  html += '<button class="job-notes-btn' + (hasNotes ? ' has-notes' : '') + '" data-action="job-notes" data-id="' + job.id + '" title="' + (hasNotes ? 'View / edit notes' : 'Add notes') + '">&#128221; Notes</button>';
  if (isActive) html += '<button class="task-edit-btn" data-action="job-edit" data-id="' + job.id + '" title="Edit job">&#9998;</button>';
  html += btnHtml + '<span class="job-badge ' + (isActive ? 'active' : 'complete') + '">' + job.status + '</span>';
  html += '</div></div>';
  html += '<div class="job-notes-panel hidden" id="jobNotes-' + job.id + '">';
  html += '<textarea class="job-notes-input" id="jobNotesInput-' + job.id + '" placeholder="What is this job? Scope, context, key details...">' + esc(job.notes || '') + '</textarea>';
  html += '<div class="job-notes-actions">';
  html += '<button class="job-notes-save" data-action="job-notes-save" data-id="' + job.id + '">Save</button>';
  html += '<button class="job-notes-cancel" data-action="job-notes-cancel" data-id="' + job.id + '">Cancel</button>';
  html += '<span class="job-notes-saved" id="jobNotesSaved-' + job.id + '">Saved</span>';
  html += '</div></div>';
  html += '<div class="task-list' + (collapsed ? ' hidden' : '') + '">';
  for (var i = 0; i < tasks.length; i++) {
    html += renderTaskItem(tasks[i], today);
  }
  html += '<div class="task-item" style="padding:6px 16px"><button class="add-btn" style="margin:0;padding:4px 12px;font-size:12px" data-action="toggle-add-task" data-id="' + job.id + '">+ task</button></div>';
  html += '<div id="addTaskForm-' + job.id + '" class="inline-form" style="padding:8px 16px">';
  html += '<input type="text" id="newTaskNotes-' + job.id + '" placeholder="Task description...">';
  html += '<select id="newTaskAssign-' + job.id + '"><option value="">Assign</option>' + teamOptionsSelected(job.assigned_to || '') + '</select>';
  html += '<input type="date" id="newTaskDue-' + job.id + '" style="width:140px">';
  html += '<button data-action="create-task" data-id="' + job.id + '" data-val="' + clientId + '">Add</button></div>';
  html += '</div></div>';
  return html;
}

function renderTaskItem(t, today) {
  var isDone = t.status === 'Complete';
  var dueClass = '';
  if (!isDone && t.due_date) { dueClass = t.due_date < today ? 'overdue' : (daysDiff(today, t.due_date) <= 3 ? 'soon' : ''); }
  var html = '<div class="task-item" id="task-row-' + t.id + '">';
  html += '<div class="task-check' + (isDone ? ' done' : '') + '" role="checkbox" aria-checked="' + (isDone ? 'true' : 'false') + '" tabindex="0" data-action="task-toggle" data-id="' + t.id + '" data-val="' + (isDone ? '0' : '1') + '"></div>';
  html += '<div class="task-notes' + (isDone ? ' completed' : '') + '">' + esc(t.notes || 'Untitled task') + '</div>';
  if (t.assigned_to) html += '<span class="task-assignee">' + esc(t.assigned_to) + '</span>';
  if (t.due_date) html += '<span class="task-due ' + dueClass + '">' + formatDate(t.due_date) + '</span>';
  if (!isDone) {
    html += '<button class="task-edit-btn" data-action="task-edit" data-id="' + t.id + '" title="Edit">&#9998;</button>';
    html += '<button class="task-delete-btn" data-action="task-delete" data-id="' + t.id + '" data-val="' + (t.job_id || '') + '" title="Delete">&times;</button>';
  }
  html += '</div>';
  return html;
}

function renderAddJobForm(clientId) {
  var html = '<button class="add-btn" data-action="toggle-add-job" data-id="' + clientId + '">+ Add Job</button>';
  html += '<div id="addJobForm-' + clientId + '" class="inline-form" style="flex-direction:column;align-items:stretch">';
  html += '<div id="templatePills-' + clientId + '" class="template-pills" style="display:none"></div>';
  html += '<div id="templateHint-' + clientId + '" class="template-hint" style="display:none"></div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  html += '<input type="text" id="newJobName-' + clientId + '" placeholder="Job name..." style="flex:1;min-width:160px">';
  html += '<input type="hidden" id="newJobTemplate-' + clientId + '" value="">';
  html += '<select id="newJobAssign-' + clientId + '"><option value="">Assign...</option>' + teamOptions() + '</select>';
  html += '<input type="date" id="newJobDue-' + clientId + '" style="width:140px">';
  html += '<button data-action="create-job" data-id="' + clientId + '">Add</button></div>';
  html += '</div>';
  return html;
}

var _templates = [];

async function loadTemplatesForForm(clientId) {
  if (!_templates.length) {
    var res = await fetch(API + '/api/templates');
    if (res.ok) _templates = await res.json();
  }
  if (!_templates.length) return;
  var pillsEl = document.getElementById('templatePills-' + clientId);
  if (!pillsEl) return;
  var html = '';
  for (var i = 0; i < _templates.length; i++) {
    var t = _templates[i];
    html += '<button class="template-pill" data-action="select-template" data-id="' + clientId + '" data-val="' + t.id + '" data-name="' + esc(t.name) + '" data-count="' + t.tasks.length + '">' + esc(t.name) + '</button>';
  }
  pillsEl.innerHTML = html;
  pillsEl.style.display = 'flex';
}

function selectTemplate(clientId, templateId, templateName, taskCount) {
  document.getElementById('newJobTemplate-' + clientId).value = templateId;
  document.getElementById('newJobName-' + clientId).value = templateName;
  // Update pill selection
  var pills = document.querySelectorAll('#templatePills-' + clientId + ' .template-pill');
  for (var i = 0; i < pills.length; i++) {
    pills[i].classList.toggle('selected', pills[i].getAttribute('data-template-id') === templateId);
  }
  var hint = document.getElementById('templateHint-' + clientId);
  if (hint) { hint.textContent = taskCount + ' tasks will be added'; hint.style.display = 'block'; }
}

async function saveClientNotes(clientId, text) {
  var saved = document.getElementById('notesSaved');
  var errEl = document.getElementById('notesError');
  try {
    var res = await fetch(API + '/api/clients/' + clientId + '/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: text })
    });
    if (res.ok) {
      if (saved) { saved.classList.add('show'); setTimeout(function() { saved.classList.remove('show'); }, 2000); }
    } else { throw new Error('save failed'); }
  } catch (e) {
    if (errEl) { errEl.classList.add('show'); setTimeout(function() { errEl.classList.remove('show'); }, 3000); }
  }
}

// \u2500\u2500 Task inline edit \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function openTaskEdit(taskId) {
  var row = document.getElementById('task-row-' + taskId);
  if (!row) return;
  // Extract current values from DOM
  var notesEl = row.querySelector('.task-notes');
  var assignEl = row.querySelector('.task-assignee');
  var dueEl = row.querySelector('.task-due');
  var currentNotes = notesEl ? notesEl.textContent : '';
  var currentAssign = assignEl ? assignEl.textContent : '';
  var currentDue = '';
  if (dueEl) {
    // Reconstruct YYYY-MM-DD from MM/DD display
    var parts = dueEl.textContent.split('/');
    if (parts.length === 2) {
      var today = new Date();
      currentDue = today.getFullYear() + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0');
    }
  }
  var editHtml = '<div class="task-edit-row" id="task-edit-' + taskId + '">';
  editHtml += '<input class="task-edit-notes" type="text" id="editNotes-' + taskId + '" value="' + esc(currentNotes) + '" placeholder="Task description...">';
  editHtml += '<select id="editAssign-' + taskId + '"><option value="">Unassigned</option>' + teamOptionsSelected(currentAssign) + '</select>';
  editHtml += '<input type="date" id="editDue-' + taskId + '" value="' + currentDue + '">';
  editHtml += '<button class="save-btn" data-action="task-save" data-id="' + taskId + '">Save</button>';
  editHtml += '<button class="cancel-edit-btn" data-action="task-cancel-edit" data-id="' + taskId + '">Cancel</button>';
  editHtml += '</div>';
  row.insertAdjacentHTML('afterend', editHtml);
  row.classList.add('hidden');
  var inp = document.getElementById('editNotes-' + taskId);
  if (inp) { inp.focus(); inp.select(); }
  // Enter to save
  if (inp) inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveTaskEdit(taskId); }
    if (e.key === 'Escape') { cancelTaskEdit(taskId); }
  });
}

async function saveTaskEdit(taskId) {
  var notes = document.getElementById('editNotes-' + taskId);
  var assign = document.getElementById('editAssign-' + taskId);
  var due = document.getElementById('editDue-' + taskId);
  if (!notes || !notes.value.trim()) return;
  await fetch(API + '/api/tasks/' + taskId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: notes.value.trim(), assigned_to: assign ? assign.value : '', due_date: due ? due.value : '' })
  });
  if (currentClientId) loadClient(currentClientId);
}

function cancelTaskEdit(taskId) {
  var editRow = document.getElementById('task-edit-' + taskId);
  var taskRow = document.getElementById('task-row-' + taskId);
  if (editRow) editRow.remove();
  if (taskRow) taskRow.classList.remove('hidden');
}

// \u2500\u2500 Job inline edit \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function openJobEdit(jobId) {
  var row = document.getElementById('job-row-' + jobId);
  if (!row) return;
  var header = row.querySelector('.job-header');
  if (!header) return;
  var titleEl = row.querySelector('.job-title');
  var assignEl = row.querySelector('.task-assignee');
  var dueEl = row.querySelector('.task-due');
  // Get job name (first text node of title, strip the task count span)
  var currentName = titleEl ? (titleEl.firstChild ? titleEl.firstChild.textContent.trim() : '') : '';
  var currentAssign = assignEl ? assignEl.textContent : '';
  var currentDue = '';
  if (dueEl) {
    var parts = dueEl.textContent.split('/');
    if (parts.length === 2) {
      var yr = new Date().getFullYear();
      currentDue = yr + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0');
    }
  }
  var editHtml = '<div class="task-edit-row" id="job-edit-' + jobId + '">';
  editHtml += '<input class="task-edit-notes" type="text" id="editJobName-' + jobId + '" value="' + esc(currentName) + '" placeholder="Job name...">';
  editHtml += '<select id="editJobAssign-' + jobId + '"><option value="">Unassigned</option>' + teamOptionsSelected(currentAssign) + '</select>';
  editHtml += '<input type="date" id="editJobDue-' + jobId + '" value="' + currentDue + '">';
  editHtml += '<button class="save-btn" data-action="job-save" data-id="' + jobId + '">Save</button>';
  editHtml += '<button class="cancel-edit-btn" data-action="job-cancel-edit" data-id="' + jobId + '">Cancel</button>';
  editHtml += '</div>';
  header.insertAdjacentHTML('afterend', editHtml);
  header.classList.add('hidden');
  var inp = document.getElementById('editJobName-' + jobId);
  if (inp) { inp.focus(); inp.select(); }
  if (inp) inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveJobEdit(jobId); }
    if (e.key === 'Escape') { cancelJobEdit(jobId); }
  });
}

async function saveJobEdit(jobId) {
  var name = document.getElementById('editJobName-' + jobId);
  var assign = document.getElementById('editJobAssign-' + jobId);
  var due = document.getElementById('editJobDue-' + jobId);
  if (!name || !name.value.trim()) return;
  await fetch(API + '/api/jobs/' + jobId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.value.trim(), assigned_to: assign ? assign.value : '', due_date: due ? due.value : '' })
  });
  if (currentClientId) loadClient(currentClientId);
}

function cancelJobEdit(jobId) {
  var editRow = document.getElementById('job-edit-' + jobId);
  var row = document.getElementById('job-row-' + jobId);
  if (editRow) editRow.remove();
  if (row) { var header = row.querySelector('.job-header'); if (header) header.classList.remove('hidden'); }
}

// \\u2500\\u2500 Job notes \\u2500\\u2500
function toggleJobNotes(jobId) {
  var panel = document.getElementById('jobNotes-' + jobId);
  if (!panel) return;
  var opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (opening) {
    var ta = document.getElementById('jobNotesInput-' + jobId);
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }
}

async function saveJobNotes(jobId) {
  var ta = document.getElementById('jobNotesInput-' + jobId);
  if (!ta) return;
  var notes = ta.value;
  var savedEl = document.getElementById('jobNotesSaved-' + jobId);
  try {
    var res = await fetch(API + '/api/jobs/' + jobId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notes })
    });
    if (!res.ok) throw new Error('save failed');
    // reflect saved state on the button without a full reload
    var row = document.getElementById('job-row-' + jobId);
    if (row) {
      var btn = row.querySelector('.job-notes-btn');
      if (btn) {
        if (notes.trim()) { btn.classList.add('has-notes'); btn.title = 'View / edit notes'; }
        else { btn.classList.remove('has-notes'); btn.title = 'Add notes'; }
      }
    }
    if (savedEl) { savedEl.classList.add('show'); setTimeout(function(){ savedEl.classList.remove('show'); }, 1500); }
  } catch (err) {
    if (savedEl) { savedEl.textContent = 'Save failed'; savedEl.style.color = 'var(--red)'; savedEl.classList.add('show'); }
  }
}

function cancelJobNotes(jobId) {
  var panel = document.getElementById('jobNotes-' + jobId);
  if (panel) panel.classList.add('hidden');
}

// \u2500\u2500 Task delete + undo \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function deleteTask(taskId, jobId) {
  // Clear any previous pending delete
  if (deleteTimer) { clearTimeout(deleteTimer); executeDelete(); }
  deletePendingId = taskId;
  deletePendingJobId = jobId;
  // Remove from DOM immediately (optimistic)
  var row = document.getElementById('task-row-' + taskId);
  if (row) { deletePendingEl = row.outerHTML; row.remove(); }
  // Cancel edit row if open
  var editRow = document.getElementById('task-edit-' + taskId);
  if (editRow) editRow.remove();
  // Show snackbar
  showSnackbar('Task deleted');
  deleteTimer = setTimeout(function() { executeDelete(); }, 4000);
}

function executeDelete() {
  if (!deletePendingId) return;
  fetch(API + '/api/tasks/' + deletePendingId, { method: 'DELETE' });
  deletePendingId = null;
  deletePendingEl = null;
  deletePendingJobId = null;
  deleteTimer = null;
  hideSnackbar();
  // Refresh dashboard counts silently
  fetch(API + '/api/dashboard').then(function(r) { return r.json(); }).then(function(d) { dashboardData = d; });
}

function undoDelete() {
  if (!deletePendingId) return;
  clearTimeout(deleteTimer);
  deleteTimer = null;
  // Re-insert task row
  if (deletePendingEl) {
    var taskList = document.querySelector('.task-list');
    // Find the add-task row in the correct job and insert before it
    var jobId = deletePendingJobId;
    var addRow = document.querySelector('#addTaskForm-' + jobId);
    if (addRow && addRow.previousElementSibling) {
      addRow.previousElementSibling.insertAdjacentHTML('afterend', deletePendingEl);
    } else if (taskList) {
      taskList.insertAdjacentHTML('afterbegin', deletePendingEl);
    }
  }
  deletePendingId = null;
  deletePendingEl = null;
  deletePendingJobId = null;
  hideSnackbar();
}

function showSnackbar(msg) {
  document.getElementById('snackbarMsg').textContent = msg;
  document.getElementById('snackbar').classList.add('show');
}

function hideSnackbar() {
  document.getElementById('snackbar').classList.remove('show');
}

// \u2500\u2500 Team \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function toggleGearPanel() {
  document.getElementById('gearPanel').classList.toggle('show');
}

async function addTeamMember() {
  var inp = document.getElementById('newMemberName');
  var name = inp.value.trim();
  if (!name) return;
  var res = await fetch(API + '/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  });
  if (res.ok) {
    inp.value = '';
    var tr2 = await fetch(API + '/api/team');
    if (tr2.ok) teamMembers = await tr2.json();
    // Refresh dashboard to update gear panel
    var dr = await fetch(API + '/api/dashboard');
    dashboardData = await dr.json();
    renderDashboard();
  } else {
    var err = await res.json();
    alert(err.error || 'Error adding member');
  }
}

async function removeTeamMember(id) {
  if (!confirm('Remove this team member? Their tasks will be unassigned.')) return;
  await fetch(API + '/api/team/' + id, { method: 'DELETE' });
  var tr2 = await fetch(API + '/api/team');
  if (tr2.ok) teamMembers = await tr2.json();
  var dr = await fetch(API + '/api/dashboard');
  dashboardData = await dr.json();
  renderDashboard();
}

function teamOptions() {
  var html = '';
  for (var i = 0; i < teamMembers.length; i++) {
    html += '<option>' + esc(teamMembers[i].name) + '</option>';
  }
  return html;
}

function teamOptionsSelected(selected) {
  var html = '';
  for (var i = 0; i < teamMembers.length; i++) {
    var sel = teamMembers[i].name === selected ? ' selected' : '';
    html += '<option' + sel + '>' + esc(teamMembers[i].name) + '</option>';
  }
  return html;
}

// \u2500\u2500 Client management \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function toggleAddClientForm() {
  var f = document.getElementById('addClientForm');
  f.classList.toggle('show');
  if (f.classList.contains('show')) document.getElementById('newClientName').focus();
  document.getElementById('addClientError').classList.add('hidden');
}

async function addClient() {
  var name = document.getElementById('newClientName').value.trim();
  var errEl = document.getElementById('addClientError');
  if (!name) return;
  var res = await fetch(API + '/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name })
  });
  if (res.ok) {
    document.getElementById('newClientName').value = '';
    toggleAddClientForm();
    var dr = await fetch(API + '/api/dashboard');
    dashboardData = await dr.json();
    renderDashboard();
  } else {
    var err = await res.json();
    errEl.textContent = err.error || 'Error';
    errEl.classList.remove('hidden');
  }
}

async function renameClient(clientId) {
  var current = document.getElementById('clientNameDisplay');
  var newName = prompt('Rename client:', current ? current.textContent : '');
  if (!newName || !newName.trim()) return;
  var res = await fetch(API + '/api/clients/' + clientId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName.trim() })
  });
  if (res.ok) {
    if (current) current.textContent = newName.trim();
    // Update dashboard data
    var dr = await fetch(API + '/api/dashboard');
    dashboardData = await dr.json();
  } else {
    var err = await res.json();
    alert(err.error || 'Rename failed');
  }
}

async function archiveClient(clientId, activeJobs) {
  if (parseInt(activeJobs) > 0) {
    if (!confirm('This client has ' + activeJobs + ' active job(s). Archive anyway?')) return;
  } else {
    if (!confirm('Archive this client? They will be removed from the dashboard.')) return;
  }
  await fetch(API + '/api/clients/' + clientId + '/archive', { method: 'POST' });
  var dr = await fetch(API + '/api/dashboard');
  dashboardData = await dr.json();
  showDashboard();
}

// \u2500\u2500 Team detail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function loadTeam(encodedName) {
  var name = decodeURIComponent(encodedName);
  currentTeamName = name;
  currentClientId = null;
  document.getElementById('teamDetail').innerHTML = '<div class="loading">Loading...</div>';
  document.getElementById('teamDetail').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('navBack').style.display = 'flex';
  var res = await fetch(API + '/api/team/' + encodedName);
  if (res.status === 401) { showLoginScreen(); return; }
  var data = await res.json();
  renderTeamDetail(data);
}

function renderTeamDetail(data) {
  var today = new Date().toISOString().split('T')[0];
  var html = '<div class="detail-header"><div><h2>' + esc(data.name) + '</h2><div class="sub">' + data.tasks.length + ' assigned tasks</div></div></div>';
  // Tasks by client
  var byClient = {};
  for (var i = 0; i < data.tasks.length; i++) {
    var t = data.tasks[i];
    if (!byClient[t.client_name]) byClient[t.client_name] = [];
    byClient[t.client_name].push(t);
  }
  var keys = Object.keys(byClient).sort();
  if (keys.length === 0) {
    html += '<div style="color:var(--text-dim);font-size:14px;margin:16px 0">No open tasks assigned.</div>';
  }
  for (var k = 0; k < keys.length; k++) {
    var cn = keys[k];
    html += '<div class="section-title" style="margin-top:16px">' + esc(cn) + '</div>';
    html += '<div class="task-list" style="border:1px solid var(--border);border-radius:8px;margin-bottom:12px">';
    for (var i = 0; i < byClient[cn].length; i++) {
      var t = byClient[cn][i];
      var dueClass = t.due_date ? (t.due_date < today ? 'overdue' : (daysDiff(today, t.due_date) <= 3 ? 'soon' : '')) : '';
      html += '<div class="task-item" id="task-row-' + t.id + '"><div class="task-check" role="checkbox" aria-checked="false" tabindex="0" data-action="task-toggle" data-id="' + t.id + '" data-val="1"></div>';
      html += '<div class="task-notes">' + esc(t.notes || 'Untitled') + '</div>';
      html += '<span class="task-assignee">' + esc(t.job_name || '') + '</span>';
      if (t.due_date) html += '<span class="task-due ' + dueClass + '">' + formatDate(t.due_date) + '</span>';
      html += '</div>';
    }
    html += '</div>';
  }
  // Daily Log section
  var logs = data.logs || [];
  var todayLog = logs.find(function(l) { return l.log_date === today; });
  var todayNotes = todayLog ? todayLog.notes : '';
  var firstName = esc(data.name.split(' ')[0]);
  html += '<div class="section-title" style="margin-top:28px">Daily Log</div>';
  html += '<div style="margin-bottom:20px">';
  html += '<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px">Today — ' + formatDate(today) + '</div>';
  html += '<textarea id="dailyLogTodayInput" style="width:100%;box-sizing:border-box;min-height:80px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:14px;font-family:inherit;resize:vertical;outline:none" placeholder="What did ' + firstName + ' work on today?">' + esc(todayNotes) + '</textarea>';
  html += '<div style="display:flex;align-items:center;gap:10px;margin-top:8px">';
  html += '<button class="save-btn" data-action="log-save-today" data-val="' + esc(data.name) + '" style="padding:6px 16px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Save</button>';
  html += '<span id="dailyLogSaved" style="font-size:13px;color:var(--green,#22c55e);display:none">Saved ✓</span>';
  html += '</div>';
  html += '</div>';
  // Past log entries
  var pastLogs = logs.filter(function(l) { return l.log_date !== today; });
  if (pastLogs.length > 0) {
    html += '<div style="font-size:12px;color:var(--text-dim);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">Past Entries</div>';
    for (var p = 0; p < pastLogs.length; p++) {
      var pl = pastLogs[p];
      html += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px;background:var(--surface)">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
      html += '<span style="font-size:12px;font-weight:600;color:var(--text-dim)">' + formatDate(pl.log_date) + '</span>';
      html += '<button class="task-delete-btn" data-action="log-delete" data-id="' + pl.id + '" data-val="' + esc(data.name) + '" title="Delete" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:16px;line-height:1">&times;</button>';
      html += '</div>';
      html += '<div style="font-size:14px;white-space:pre-wrap">' + esc(pl.notes || '') + '</div>';
      html += '</div>';
    }
  }
  document.getElementById('teamDetail').innerHTML = html;
}

// \u2500\u2500 Task toggle \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function toggleTask(taskId, complete, clientId, teamName) {
  var ep = complete ? '/api/tasks/' + taskId + '/complete' : '/api/tasks/' + taskId + '/reopen';
  await fetch(API + ep, { method: 'POST' });
  // Fix BUG-001: refresh team view when toggling from team detail
  if (teamName) {
    loadTeam(encodeURIComponent(teamName));
  } else if (clientId) {
    loadClient(clientId);
  }
  fetch(API + '/api/dashboard').then(function(r) { return r.json(); }).then(function(d) { dashboardData = d; });
}

// \u2500\u2500 Daily Log \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function saveLogToday(memberName) {
  var input = document.getElementById('dailyLogTodayInput');
  if (!input) return;
  var notes = input.value.trim();
  var today = new Date().toISOString().split('T')[0];
  var res = await fetch(API + '/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_member_name: memberName, log_date: today, notes: notes })
  });
  if (res.ok) {
    var saved = document.getElementById('dailyLogSaved');
    if (saved) { saved.style.display = 'inline'; setTimeout(function() { saved.style.display = 'none'; }, 2500); }
    loadTeam(encodeURIComponent(memberName));
  }
}

async function deleteLog(logId, memberName) {
  if (!confirm('Delete this log entry?')) return;
  await fetch(API + '/api/logs/' + logId, { method: 'DELETE' });
  loadTeam(encodeURIComponent(memberName));
}

// \u2500\u2500 Job CRUD \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function completeJob(jobId, clientId) {
  await fetch(API + '/api/jobs/' + jobId + '/complete', { method: 'POST' });
  if (clientId) loadClient(clientId);
  fetch(API + '/api/dashboard').then(function(r) { return r.json(); }).then(function(d) { dashboardData = d; });
}

async function reopenJob(jobId, clientId) {
  await fetch(API + '/api/jobs/' + jobId + '/reopen', { method: 'POST' });
  if (clientId) loadClient(clientId);
  fetch(API + '/api/dashboard').then(function(r) { return r.json(); }).then(function(d) { dashboardData = d; });
}

async function quickAssignJob(sel, jobId) {
  var val = sel.value;
  sel.className = 'job-assign-select' + (val ? ' has-assignee' : '');
  await fetch(API + '/api/jobs/' + jobId + '/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigned_to: val })
  });
}

function toggleAddJob(clientId) {
  var f = document.getElementById('addJobForm-' + clientId);
  f.classList.toggle('show');
  if (f.classList.contains('show')) {
    var inp = document.getElementById('newJobName-' + clientId);
    if (inp) inp.focus();
  }
}

async function createJob(clientId) {
  var inp = document.getElementById('newJobName-' + clientId);
  var tmpl = document.getElementById('newJobTemplate-' + clientId);
  var assign = document.getElementById('newJobAssign-' + clientId);
  var due = document.getElementById('newJobDue-' + clientId);
  if (!inp || !inp.value.trim()) return;
  var body = { client_id: clientId, name: inp.value.trim() };
  if (tmpl && tmpl.value) body.template_id = tmpl.value;
  if (assign && assign.value) body.assigned_to = assign.value;
  if (due && due.value) body.due_date = due.value;
  await fetch(API + '/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  loadClient(clientId);
}

function toggleAddTask(jobId) {
  var f = document.getElementById('addTaskForm-' + jobId);
  f.classList.toggle('show');
  var inp = document.getElementById('newTaskNotes-' + jobId);
  if (inp) inp.focus();
}

async function createTask(jobId, clientId) {
  var notes = document.getElementById('newTaskNotes-' + jobId);
  var assign = document.getElementById('newTaskAssign-' + jobId);
  var due = document.getElementById('newTaskDue-' + jobId);
  if (!notes || !notes.value.trim()) return;
  await fetch(API + '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, client_id: clientId, notes: notes.value.trim(), assigned_to: assign ? assign.value : '', due_date: due ? due.value : '' })
  });
  loadClient(clientId);
}

// \u2500\u2500 Assistant bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

var assistantResponseTimer = null;

async function sendAssistantMessage() {
  var input = document.getElementById('assistantInput');
  var resp = document.getElementById('assistantResponse');
  var btn = document.getElementById('assistantSend');
  var msg = (input.value || '').trim();
  if (!msg) return;
  input.value = '';
  input.disabled = true;
  btn.disabled = true;
  resp.className = 'assistant-response thinking';
  resp.textContent = 'Thinking\u2026';
  clearTimeout(assistantResponseTimer);
  try {
    var r = await fetch(API + '/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    var d = await r.json();
    resp.className = 'assistant-response ' + (r.ok && d.response && !d.error ? 'success' : 'error');
    resp.textContent = d.response || d.error || 'Something went wrong';
    if (d.refresh) {
      loadDashboard();
    }
    assistantResponseTimer = setTimeout(function() {
      resp.className = 'assistant-response';
      resp.textContent = '';
    }, 6000);
  } catch(e) {
    resp.className = 'assistant-response error';
    resp.textContent = 'Request failed \u2014 try again';
  }
  input.disabled = false;
  btn.disabled = false;
  input.focus();
}

document.addEventListener('DOMContentLoaded', function() {
  var input = document.getElementById('assistantInput');
  if (input) {
    input.addEventListener('keydown', function(e) {
      if (e.keyCode === 13 && !e.shiftKey) { e.preventDefault(); sendAssistantMessage(); }
    });
  }
});

// \u2500\u2500 Dashboard navigation \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function showDashboard() {
  document.getElementById('dashboard').classList.remove('hidden');
  document.getElementById('detail').classList.add('hidden');
  document.getElementById('teamDetail').classList.add('hidden');
  document.getElementById('intakeDetail').classList.add('hidden');
  document.getElementById('navBack').style.display = 'none';
  currentClientId = null;
  currentTeamName = null;
  currentIntakeId = null;
  if (dashboardData) renderDashboard(); else loadDashboard();
}

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('appShell').classList.add('hidden');
}

// \u2500\u2500 Intake \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function loadIntakeSection() {
  var sec = document.getElementById('intakeSection');
  if (!sec) return;

  // Always render the section shell
  var gmailHtml = '<div class="gmail-settings" id="gmailSettingsBox">' +
    '<div class="gmail-settings-title">Gmail Integration</div>' +
    '<div class="gmail-status-row">' +
    '<div class="gmail-dot" id="gmailDot"></div>' +
    '<div class="gmail-status-text" id="gmailStatusText">Checking...</div>' +
    '<button class="gmail-connect-btn" data-action="gmail-connect" id="gmailConnectBtn">Connect</button>' +
    '<button class="gmail-checknow-btn" id="gmailCheckNowBtn" style="display:none" onclick="gmailCheckNow()">Check now</button>' +
    '</div>' +
    '<div class="gmail-last-checked" id="gmailLastChecked"></div>' +
    '<div class="gmail-error-msg" id="gmailErrorMsg"></div>' +
    '</div>';

  sec.innerHTML = '<div class="intake-section-header">' +
    '<div class="section-title" style="margin-bottom:0">Intake <span class="intake-badge" id="intakeBadge">0</span></div>' +
    '<div style="display:flex;align-items:center;gap:10px;">' +
    '<label class="intake-select-all-wrap"><input type="checkbox" id="intakeSelectAll" class="intake-item-check" onchange="intakeToggleSelectAll(this.checked)"> Select all</label>' +
    '<button class="intake-upload-btn" data-action="upload-proposal">&#128196; Upload Proposal</button>' +
    '</div>' +
    '</div>' +
    '<div class="intake-bulk-bar" id="intakeBulkBar"><span class="intake-bulk-count" id="intakeBulkCount">0 selected</span><button class="intake-bulk-delete-btn" onclick="intakeBulkDelete()">&#128465; Delete Selected</button></div>' +
    '<div class="intake-list" id="intakeList"></div>' +
    gmailHtml;

  sec.classList.remove('hidden');

  // Load intake items
  var res = await fetch(API + '/api/intake');
  if (!res.ok) return;
  var items = await res.json();

  document.getElementById('intakeBadge').textContent = items.length;

  var listEl = document.getElementById('intakeList');
  if (items.length === 0) {
    listEl.innerHTML = '<div class="intake-empty">No pending intake items.</div>';
  } else {
    listEl.innerHTML = items.map(function(item) {
      var icon = item.source === 'email' ? '\u2709\uFE0F' : '\u{1F4C4}';
      var extracted = {};
      try { extracted = JSON.parse(item.extracted_json || '{}'); } catch {}
      var clientLabel = item.suggested_client_name ? item.suggested_client_name : 'Unknown client';
      var jobCount = (extracted.jobs || []).length;
      var actionsHtml = item.source === 'proposal'
        ? '<button class="intake-review-btn" data-action="intake-review" data-id="' + item.id + '">Review &amp; Refine</button>'
        : '<button class="intake-confirm-btn" data-action="intake-confirm" data-id="' + item.id + '">&#10003; Add</button>' +
          '<button class="intake-note-btn" data-action="intake-save-note" data-id="' + item.id + '">&#128196; Note</button>';
      return '<div class="intake-item" id="intake-' + item.id + '">' +
        '<input type="checkbox" class="intake-item-check intake-cb" data-id="' + item.id + '" onchange="intakeCheckChange()">' +
        '<div class="intake-item-icon">' + icon + '</div>' +
        '<div class="intake-item-body">' +
        '<div class="intake-item-subject">' + esc(item.subject || 'Untitled') + '</div>' +
        '<div class="intake-item-meta">' +
        '<span class="intake-item-client">' + esc(clientLabel) + '</span>' +
        (jobCount ? '<span>' + jobCount + ' job' + (jobCount !== 1 ? 's' : '') + '</span>' : '') +
        '</div>' +
        '</div>' +
        '<div class="intake-item-actions">' +
        actionsHtml +
        '<button class="intake-dismiss-btn" data-action="intake-dismiss" data-id="' + item.id + '">&#10005;</button>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  // Load Gmail status
  var gres = await fetch(API + '/api/gmail/status');
  if (gres.ok) {
    var gdata = await gres.json();
    var dot = document.getElementById('gmailDot');
    var statusText = document.getElementById('gmailStatusText');
    var connectBtn = document.getElementById('gmailConnectBtn');
    var lastChecked = document.getElementById('gmailLastChecked');
    var errorMsg = document.getElementById('gmailErrorMsg');
    if (gdata.connected) {
      dot.classList.add('connected');
      statusText.textContent = 'Gmail connected';
      connectBtn.textContent = 'Reconnect';
      var checkNowBtn = document.getElementById('gmailCheckNowBtn');
      if (checkNowBtn) checkNowBtn.style.display = '';
      if (gdata.last_checked) {
        lastChecked.textContent = 'Last checked: ' + new Date(gdata.last_checked).toLocaleString();
      }
      if (gdata.cron_last_error) {
        errorMsg.textContent = 'Last error: ' + gdata.cron_last_error;
      }
    } else {
      statusText.textContent = "Gmail not connected \u2014 emails won\u2019t be captured";
    }
  }
}

async function gmailCheckNow() {
  var btn = document.getElementById('gmailCheckNowBtn');
  var lastChecked = document.getElementById('gmailLastChecked');
  var errorMsg = document.getElementById('gmailErrorMsg');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Checking\u2026';
  errorMsg.textContent = '';
  try {
    var r = await fetch(API + '/api/gmail/poll', { method: 'POST' });
    var d = await r.json();
    if (d.ok) {
      lastChecked.textContent = 'Last checked: ' + new Date().toLocaleString() + (d.processed ? ' (' + d.processed + ' new)' : ' (0 new)');
    } else {
      errorMsg.textContent = 'Error: ' + (d.error || 'unknown');
    }
  } catch (e) {
    errorMsg.textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Check now';
}

function showIntakeConfirmModal(intakeId) {
  var itemEl = document.getElementById('intake-' + intakeId);
  if (!itemEl) return;

  var items = [];
  try {
    var cached = intakeConfirmData;
    if (!cached || cached.id !== intakeId) {
      // Will need to re-fetch, but we have the DOM data \u2014 build from dashboardData context
    }
  } catch {}

  // Fetch fresh data for the modal
  fetch(API + '/api/intake').then(function(r) { return r.json(); }).then(function(allItems) {
    var item = allItems.find(function(i) { return i.id === intakeId; });
    if (!item) return;
    var extracted = {};
    try { extracted = JSON.parse(item.extracted_json || '{}'); } catch {}

    var jobsHtml = (extracted.jobs || []).map(function(j) {
      return '<div class="ijob">' + esc(j.name) + '</div>' +
        (j.tasks || []).map(function(t) { return '<div class="itask">&#8226; ' + esc(t.name || t.notes || '') + '</div>'; }).join('');
    }).join('');

    // Build client select options
    var clientOpts = '<option value="">\u2014 Create new client \u2014</option>';
    if (dashboardData && dashboardData.clients) {
      clientOpts = (dashboardData.clients || []).map(function(c) {
        var sel = (c.id === item.suggested_client_id) ? ' selected' : '';
        return '<option value="' + c.id + '"' + sel + '>' + esc(c.name) + '</option>';
      }).join('');
      clientOpts = '<option value="">\u2014 Create new client \u2014</option>' + clientOpts;
    }

    var html = '<div class="intake-modal-overlay" id="intakeModalOverlay">' +
      '<div class="intake-modal">' +
      '<h3>Add to tracker</h3>' +
      '<div class="sub">' + esc(item.subject || 'Untitled') + '</div>' +
      '<div class="intake-job-preview">' + (jobsHtml || '<div class="intake-empty">No structured jobs extracted.</div>') + '</div>' +
      '<select id="intakeClientSelect" onchange="toggleNewClientInput()">' + clientOpts + '</select>' +
      '<input type="text" id="intakeNewClientName" placeholder="New client name..." style="display:none">' +
      '<div class="intake-modal-actions">' +
      '<button class="cancel-btn" data-action="intake-modal-cancel">Cancel</button>' +
      '<button class="confirm-btn" data-action="intake-modal-confirm" id="intakeModalConfirmBtn" data-id="' + intakeId + '">Add to Tracker</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    // Show new client input if "create new" is selected
    toggleNewClientInput();
  });
}

function toggleNewClientInput() {
  var sel = document.getElementById('intakeClientSelect');
  var inp = document.getElementById('intakeNewClientName');
  if (!sel || !inp) return;
  inp.style.display = sel.value === '' ? '' : 'none';
}

function closeIntakeModal() {
  var overlay = document.getElementById('intakeModalOverlay');
  if (overlay) overlay.remove();
}

async function confirmIntakeFromModal() {
  var btn = document.getElementById('intakeModalConfirmBtn');
  if (!btn) return;
  var intakeId = btn.getAttribute('data-id');
  var sel = document.getElementById('intakeClientSelect');
  var newName = document.getElementById('intakeNewClientName');

  var body = {};
  if (sel && sel.value) {
    body.client_id = sel.value;
  } else if (newName && newName.value.trim()) {
    body.create_client_name = newName.value.trim();
  } else {
    alert('Please select a client or enter a new client name.');
    return;
  }

  btn.textContent = 'Adding...';
  btn.disabled = true;
  var res = await fetch(API + '/api/intake/' + intakeId + '/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  closeIntakeModal();
  if (res.ok) {
    var data = await res.json();
    loadDashboard();
    // Navigate to client
    if (data.client_id) setTimeout(function() { loadClient(data.client_id); }, 400);
  } else {
    var err = await res.json().catch(function() { return {}; });
    alert(err.error || 'Failed to add to tracker');
    loadIntakeSection();
  }
}

function showIntakeNoteModal(intakeId) {
  // Find the intake item from DOM data
  var itemEl = document.getElementById('intake-' + intakeId);
  if (!itemEl) return;
  var subject = (itemEl.querySelector('.intake-item-subject') || {}).textContent || 'Email note';

  // Build client options
  var clientOpts = '<option value="">\u2014 Select client \u2014</option>';
  if (dashboardData && dashboardData.clients) {
    clientOpts += (dashboardData.clients || []).map(function(c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  var html = '<div class="note-modal-overlay" id="noteModalOverlay">' +
    '<div class="note-modal">' +
    '<h3>Save as job note</h3>' +
    '<p class="sub">Attach this email to an existing job as a note.</p>' +
    '<div class="note-preview">' + esc(subject) + '</div>' +
    '<label>Client</label>' +
    '<select id="noteClientSelect" data-action="note-client-change">' + clientOpts + '</select>' +
    '<label>Job</label>' +
    '<select id="noteJobSelect"><option value="">\u2014 Select client first \u2014</option></select>' +
    '<div class="note-modal-actions">' +
    '<button class="cancel-btn" data-action="note-modal-cancel">Cancel</button>' +
    '<button class="save-btn" data-action="note-modal-save" data-id="' + intakeId + '">Save note</button>' +
    '</div></div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
}

async function loadNoteJobSelect(clientId) {
  var sel = document.getElementById('noteJobSelect');
  if (!sel) return;
  if (!clientId) { sel.innerHTML = '<option value="">\u2014 Select client first \u2014</option>'; return; }
  sel.innerHTML = '<option value="">Loading...</option>';
  try {
    var r = await fetch(API + '/api/clients/' + clientId);
    var d = await r.json();
    var jobs = (d.jobs || []).filter(function(j) { return j.status === 'Active'; });
    if (!jobs.length) { sel.innerHTML = '<option value="">No active jobs</option>'; return; }
    sel.innerHTML = '<option value="">\u2014 Select job \u2014</option>' +
      jobs.map(function(j) { return '<option value="' + j.id + '">' + esc(j.name) + '</option>'; }).join('');
  } catch(e) { sel.innerHTML = '<option value="">Error loading jobs</option>'; }
}

function closeNoteModal() {
  var overlay = document.getElementById('noteModalOverlay');
  if (overlay) overlay.remove();
}

async function saveIntakeNote(intakeId) {
  var jobSel = document.getElementById('noteJobSelect');
  if (!jobSel || !jobSel.value) { jobSel && jobSel.focus(); return; }
  var jobId = jobSel.value;
  var saveBtn = document.querySelector('#noteModalOverlay .save-btn');
  if (saveBtn) { saveBtn.textContent = 'Saving...'; saveBtn.disabled = true; }
  var res = await fetch(API + '/api/intake/' + intakeId + '/save-as-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId })
  });
  if (res.ok) {
    closeNoteModal();
    var itemEl = document.getElementById('intake-' + intakeId);
    if (itemEl) { itemEl.style.transition = 'opacity 0.3s'; itemEl.style.opacity = '0'; setTimeout(function() { itemEl.remove(); var b = document.getElementById('intakeBadge'); if (b) b.textContent = Math.max(0, parseInt(b.textContent||'0')-1); }, 300); }
    showSnackbar('Note saved to job');
  } else {
    if (saveBtn) { saveBtn.textContent = 'Save note'; saveBtn.disabled = false; }
    showSnackbar('Failed to save note');
  }
}

async function dismissIntakeItem(intakeId) {
  var itemEl = document.getElementById('intake-' + intakeId);
  if (itemEl) itemEl.style.opacity = '0.4';
  await fetch(API + '/api/intake/' + intakeId + '/dismiss', { method: 'POST' });
  loadIntakeSection();
}

function intakeCheckChange() {
  var cbs = document.querySelectorAll('.intake-cb');
  var checked = document.querySelectorAll('.intake-cb:checked');
  var bar = document.getElementById('intakeBulkBar');
  var count = document.getElementById('intakeBulkCount');
  var selectAll = document.getElementById('intakeSelectAll');
  if (bar) {
    if (checked.length > 0) { bar.classList.add('show'); } else { bar.classList.remove('show'); }
  }
  if (count) count.textContent = checked.length + ' selected';
  if (selectAll) selectAll.indeterminate = checked.length > 0 && checked.length < cbs.length;
  if (selectAll && checked.length === cbs.length && cbs.length > 0) selectAll.checked = true;
  if (selectAll && checked.length === 0) selectAll.checked = false;
}

function intakeToggleSelectAll(checked) {
  document.querySelectorAll('.intake-cb').forEach(function(cb) { cb.checked = checked; });
  intakeCheckChange();
}

async function intakeBulkDelete() {
  var checked = document.querySelectorAll('.intake-cb:checked');
  if (!checked.length) return;
  var ids = Array.from(checked).map(function(cb) { return cb.getAttribute('data-id'); });
  var bar = document.getElementById('intakeBulkBar');
  if (bar) bar.innerHTML = '<span class="intake-bulk-count">Deleting ' + ids.length + '...</span>';
  await fetch(API + '/api/intake/bulk-dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ids })
  });
  loadIntakeSection();
}

async function loadIntakeDetail(intakeId) {
  currentIntakeId = intakeId;

  // Show intakeDetail, hide others
  document.getElementById('dashboard').classList.add('hidden');
  document.getElementById('detail').classList.add('hidden');
  document.getElementById('teamDetail').classList.add('hidden');
  document.getElementById('intakeDetail').classList.remove('hidden');
  document.getElementById('navBack').style.display = 'flex';

  var detailEl = document.getElementById('intakeDetail');
  detailEl.innerHTML = '<div style="padding:24px;color:var(--text-dim)">Loading...</div>';

  // Fetch intake item + chat history
  var items = await fetch(API + '/api/intake').then(function(r) { return r.json(); });
  var item = items.find(function(i) { return i.id === intakeId; });
  if (!item) { detailEl.innerHTML = '<div style="padding:24px">Item not found.</div>'; return; }

  var extracted = {};
  try { extracted = JSON.parse(item.extracted_json || '{}'); } catch {}

  // Build client select
  var clientOpts = '<option value="">+ Create new client</option>';
  if (dashboardData && dashboardData.clients) {
    clientOpts += dashboardData.clients.map(function(c) {
      return '<option value="' + c.id + '"' + (c.id === item.suggested_client_id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
  }

  var jobsHtml = (extracted.jobs || []).map(function(j) {
    return '<div class="intake-job-card">' +
      '<div class="ijob-name">' + esc(j.name) + '</div>' +
      (j.tasks || []).map(function(t) {
        return '<div class="itask-sm">' + esc(t.name || t.notes || '') + '</div>';
      }).join('') +
      '</div>';
  }).join('') || '<div class="intake-empty">No jobs extracted yet. Ask Claude to extract structure.</div>';

  detailEl.innerHTML = '<div class="intake-split">' +
    '<div class="intake-preview-panel">' +
    '<h2>' + esc(item.subject || 'Proposal') + '</h2>' +
    '<div class="intake-file-meta">\u{1F4C4} ' + esc(item.subject || '') + ' &middot; ' + (item.suggested_client_name ? esc(item.suggested_client_name) : 'No client matched') + '</div>' +
    '<div class="intake-client-row">' +
    '<select id="intakeDetailClientSelect" onchange="toggleDetailNewClient()">' + clientOpts + '</select>' +
    '<input type="text" id="intakeDetailNewClient" placeholder="New client name..." style="display:none">' +
    '<button class="add-to-client-btn" data-action="intake-add-to-client" data-id="' + intakeId + '">Add to Client</button>' +
    '</div>' +
    '<div class="intake-jobs-list" id="intakeJobsList">' + jobsHtml + '</div>' +
    '</div>' +
    '<div class="intake-chat-panel">' +
    '<div class="intake-chat-messages" id="intakeChatMessages"></div>' +
    '<div class="intake-chat-form">' +
    '<textarea id="intakeChatInput" placeholder="Ask Claude to refine the job list..." rows="1" onkeydown="if(event.keyCode===13&&!event.shiftKey){event.preventDefault();sendIntakeChat();}"></textarea>' +
    '<button class="intake-chat-send" id="intakeChatSendBtn" data-action="intake-chat-send">&#8679;</button>' +
    '</div>' +
    '</div>' +
    '</div>';

  // Add opening assistant message (from upload or load from DB)
  var chatEl = document.getElementById('intakeChatMessages');
  var openMsg = 'What would you like to change about this job structure? You can ask me to split, rename, add, or remove any jobs or tasks.';
  chatEl.innerHTML = '<div class="chat-msg assistant">' + esc(openMsg) + '</div>';

  // Handle new client input toggle
  toggleDetailNewClient();
}

function toggleDetailNewClient() {
  var sel = document.getElementById('intakeDetailClientSelect');
  var inp = document.getElementById('intakeDetailNewClient');
  if (!sel || !inp) return;
  inp.style.display = sel.value === '' ? '' : 'none';
}

async function sendIntakeChat() {
  if (!currentIntakeId) return;
  var input = document.getElementById('intakeChatInput');
  var sendBtn = document.getElementById('intakeChatSendBtn');
  var chatEl = document.getElementById('intakeChatMessages');
  var message = input ? input.value.trim() : '';
  if (!message) return;

  // Show user message
  chatEl.insertAdjacentHTML('beforeend', '<div class="chat-msg user">' + esc(message) + '</div>');
  input.value = '';
  sendBtn.disabled = true;
  chatEl.insertAdjacentHTML('beforeend', '<div class="chat-msg assistant" id="intakeChatThinking">Thinking...</div>');
  chatEl.scrollTop = chatEl.scrollHeight;

  var res = await fetch(API + '/api/intake/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intake_id: currentIntakeId, message: message })
  });
  sendBtn.disabled = false;

  var thinking = document.getElementById('intakeChatThinking');
  if (thinking) thinking.removeAttribute('id');

  if (!res.ok) {
    if (thinking) thinking.textContent = 'Error \u2014 please try again.';
    return;
  }

  var data = await res.json();
  // Replace "Thinking..." with actual reply
  if (thinking) thinking.textContent = data.reply || '';
  chatEl.scrollTop = chatEl.scrollHeight;

  // If extraction was updated, refresh the job list panel
  if (data.updated_extraction) {
    var jobs = data.updated_extraction.jobs || [];
    var jobsHtml = jobs.map(function(j) {
      return '<div class="intake-job-card">' +
        '<div class="ijob-name">' + esc(j.name) + '</div>' +
        (j.tasks || []).map(function(t) {
          return '<div class="itask-sm">' + esc(t.name || t.notes || '') + '</div>';
        }).join('') +
        '</div>';
    }).join('') || '<div class="intake-empty">No jobs yet.</div>';
    var jobsList = document.getElementById('intakeJobsList');
    if (jobsList) jobsList.innerHTML = jobsHtml;
  }
}

async function confirmIntakeProposal(intakeId) {
  var sel = document.getElementById('intakeDetailClientSelect');
  var newClientInput = document.getElementById('intakeDetailNewClient');
  var body = {};
  if (sel && sel.value) {
    body.client_id = sel.value;
  } else if (newClientInput && newClientInput.value.trim()) {
    body.create_client_name = newClientInput.value.trim();
  } else {
    alert('Please select a client or enter a new client name.');
    return;
  }

  var btn = document.querySelector('[data-action="intake-add-to-client"]');
  if (btn) { btn.textContent = 'Adding...'; btn.disabled = true; }

  var res = await fetch(API + '/api/intake/' + intakeId + '/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    var data = await res.json();
    currentIntakeId = null;
    document.getElementById('intakeDetail').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('navBack').style.display = 'none';
    loadDashboard();
    if (data.client_id) setTimeout(function() { loadClient(data.client_id); }, 400);
  } else {
    var err = await res.json().catch(function() { return {}; });
    alert(err.error || 'Failed to add to tracker');
    if (btn) { btn.textContent = 'Add to Client'; btn.disabled = false; }
  }
}

async function handleProposalFile(file) {
  if (!file) return;
  var formData = new FormData();
  formData.append('file', file);

  // Show loading in intake section
  var uploadBtn = document.querySelector('.intake-upload-btn');
  if (uploadBtn) { uploadBtn.textContent = 'Uploading...'; uploadBtn.disabled = true; }

  var res = await fetch(API + '/api/intake/upload', { method: 'POST', body: formData });

  if (uploadBtn) { uploadBtn.textContent = '\u{1F4C4} Upload Proposal'; uploadBtn.disabled = false; }
  // Reset file input so the same file can be re-uploaded
  document.getElementById('proposalFileInput').value = '';

  if (!res.ok) {
    var err = await res.json().catch(function() { return {}; });
    alert(err.error || 'Upload failed');
    return;
  }
  var data = await res.json();
  if (data.intake_id) {
    loadIntakeSection();
    // Auto-open the split panel for the proposal
    setTimeout(function() { loadIntakeDetail(data.intake_id); }, 300);
  }
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// \u2500\u2500 SPRINT TEMPLATE DATA \u2500\u2500
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

var SPRINT_PHASES = [
  { id: 'preSprint', name: 'Pre-Sprint', subtitle: 'Foundation Setup', sections: ['preSprint_access','preSprint_vendasta','preSprint_oviond','preSprint_assets'] },
  { id: 'week1', name: 'Week 1', subtitle: 'Technical Foundation', sections: ['week1_technical','week1_speed','week1_listings','week1_diagnosis'] },
  { id: 'week2', name: 'Week 2', subtitle: 'Messaging & Positioning', sections: ['week2_headlines','week2_offer','week2_landing'] },
  { id: 'week3', name: 'Week 3', subtitle: 'Social Proof & Trust', sections: ['week3_reviews','week3_proof','week3_guarantee'] },
  { id: 'week4', name: 'Week 4', subtitle: 'Conversion & Launch', sections: ['week4_cta','week4_retargeting','week4_launch','week4_handoff'] }
];

var SPRINT_SECTIONS = {
  preSprint_access: { title: 'Access & Credentials', items: [
    { id: 'gbp', label: 'Google Business Profile (Owner access)', critical: true },
    { id: 'ga4', label: 'Google Analytics 4 (Admin access)', critical: true },
    { id: 'gads', label: 'Google Ads (Admin access, if existing)', critical: false },
    { id: 'meta', label: 'Meta Business Manager (Admin access)', critical: false },
    { id: 'website', label: 'Website backend access', critical: true },
    { id: 'domain', label: 'Domain registrar access', critical: false },
    { id: 'crm', label: 'CRM access (if applicable)', critical: false },
    { id: 'hosting', label: 'Hosting panel access', critical: false }
  ]},
  preSprint_vendasta: { title: 'Vendasta Setup', items: [
    { id: 'vendasta-account', label: 'Create client account in Vendasta', critical: true },
    { id: 'vendasta-listings', label: 'Activate Business Listings (Listings Sync Pro)', critical: true },
    { id: 'vendasta-reputation', label: 'Activate Reputation Management', critical: false },
    { id: 'vendasta-seo', label: 'Activate Local SEO (if applicable)', critical: false },
    { id: 'vendasta-social', label: 'Activate Social Marketing dashboard', critical: false },
    { id: 'vendasta-chatbot', label: 'Activate Chatbot', critical: false },
    { id: 'vendasta-notifications', label: 'Configure email notifications', critical: false },
    { id: 'vendasta-invite', label: 'Send client portal invitation', critical: false }
  ]},
  preSprint_oviond: { title: 'Oviond Reporting', items: [
    { id: 'oviond-workspace', label: 'Create new client workspace', critical: true },
    { id: 'oviond-ga4', label: 'Connect Google Analytics 4', critical: false },
    { id: 'oviond-gsc', label: 'Connect Google Search Console', critical: false },
    { id: 'oviond-gads', label: 'Connect Google Ads (if applicable)', critical: false },
    { id: 'oviond-meta', label: 'Connect Meta Ads (if applicable)', critical: false },
    { id: 'oviond-gbp', label: 'Connect Google Business Profile', critical: false },
    { id: 'oviond-widgets', label: 'Configure dashboard widgets', critical: false },
    { id: 'oviond-reports', label: 'Set up automated weekly reports', critical: false }
  ]},
  preSprint_assets: { title: 'Asset Collection', items: [
    { id: 'logo', label: 'Logo files (vector preferred)', critical: false },
    { id: 'colors', label: 'Brand colors (hex codes)', critical: false },
    { id: 'fonts', label: 'Brand fonts (if specified)', critical: false },
    { id: 'photos', label: 'Current photography library', critical: false },
    { id: 'testimonials', label: 'Existing testimonials and reviews', critical: false },
    { id: 'service-area', label: 'Service area documentation', critical: false },
    { id: 'pricing', label: 'Current pricing structure', critical: false }
  ]},
  week1_technical: { title: 'Technical Audit', items: [
    { id: 'speed-test', label: 'Run PageSpeed Insights audit', critical: true },
    { id: 'mobile-test', label: 'Mobile responsiveness check', critical: false },
    { id: 'ssl-check', label: 'SSL certificate verification', critical: false },
    { id: 'indexing', label: 'Google Search Console indexing status', critical: false },
    { id: 'broken-links', label: 'Broken link scan', critical: false },
    { id: 'schema', label: 'Schema markup review', critical: false }
  ]},
  week1_speed: { title: 'Speed Optimization', items: [
    { id: 'image-opt', label: 'Image compression and optimization', critical: false },
    { id: 'caching', label: 'Browser caching implementation', critical: false },
    { id: 'minify', label: 'CSS/JS minification', critical: false },
    { id: 'cdn', label: 'CDN setup (if applicable)', critical: false }
  ]},
  week1_listings: { title: 'Listings Audit', items: [
    { id: 'nap-audit', label: 'NAP consistency audit', critical: true },
    { id: 'gbp-optimize', label: 'Google Business Profile optimization', critical: false },
    { id: 'categories', label: 'Category selection review', critical: false },
    { id: 'photos-gbp', label: 'GBP photo upload', critical: false },
    { id: 'services-gbp', label: 'Services/Products setup in GBP', critical: false }
  ]},
  week1_diagnosis: { title: 'Initial Diagnosis', items: [
    { id: 'competitor-review', label: 'Top 3 competitor analysis', critical: false },
    { id: 'keyword-baseline', label: 'Current keyword rankings baseline', critical: false },
    { id: 'traffic-baseline', label: 'Traffic baseline documentation', critical: false },
    { id: 'conversion-baseline', label: 'Conversion baseline setup', critical: false }
  ]},
  week2_headlines: { title: 'Messaging Overhaul', items: [
    { id: 'headline-audit', label: 'Current headline effectiveness audit', critical: false },
    { id: 'value-prop', label: 'Value proposition refinement', critical: true },
    { id: 'headline-variants', label: 'Create 5+ headline variants', critical: false },
    { id: 'subheadline', label: 'Supporting subheadline copy', critical: false }
  ]},
  week2_offer: { title: 'Offer Development', items: [
    { id: 'offer-audit', label: 'Current offer analysis', critical: false },
    { id: 'offer-create', label: 'Develop irresistible offer', critical: true },
    { id: 'urgency', label: 'Add urgency/scarcity elements', critical: false },
    { id: 'guarantee', label: 'Guarantee formulation', critical: false }
  ]},
  week2_landing: { title: 'Landing Page Optimization', items: [
    { id: 'hero-section', label: 'Hero section redesign', critical: false },
    { id: 'benefit-blocks', label: 'Benefit blocks creation', critical: false },
    { id: 'social-proof-section', label: 'Social proof section', critical: false },
    { id: 'cta-placement', label: 'CTA button optimization', critical: false }
  ]},
  week3_reviews: { title: 'Review Generation', items: [
    { id: 'review-audit', label: 'Current review audit', critical: true },
    { id: 'review-response', label: 'Respond to existing reviews', critical: false },
    { id: 'review-system', label: 'Implement review request system', critical: false },
    { id: 'review-training', label: 'Train client on review requests', critical: false }
  ]},
  week3_proof: { title: 'Social Proof Assets', items: [
    { id: 'testimonial-collect', label: 'Collect written testimonials', critical: false },
    { id: 'case-study', label: 'Create 1 case study', critical: false },
    { id: 'before-after', label: 'Before/after examples', critical: false },
    { id: 'credentials', label: 'Credentials/certifications display', critical: false }
  ]},
  week3_guarantee: { title: 'Trust Elements', items: [
    { id: 'guarantee-badge', label: 'Guarantee badge creation', critical: false },
    { id: 'trust-badges', label: 'Trust badges implementation', critical: false },
    { id: 'about-page', label: 'About page humanization', critical: false },
    { id: 'team-photos', label: 'Team photos (if applicable)', critical: false }
  ]},
  week4_cta: { title: 'Conversion Optimization', items: [
    { id: 'cta-audit', label: 'CTA audit and optimization', critical: true },
    { id: 'form-optimization', label: 'Form field optimization', critical: false },
    { id: 'click-to-call', label: 'Click-to-call implementation', critical: false },
    { id: 'chat-widget', label: 'Chat widget setup (if applicable)', critical: false }
  ]},
  week4_retargeting: { title: 'Retargeting Setup', items: [
    { id: 'pixel-install', label: 'Facebook pixel installation', critical: false },
    { id: 'google-remarketing', label: 'Google remarketing tag', critical: false },
    { id: 'audience-creation', label: 'Custom audience creation', critical: false },
    { id: 'retargeting-ads', label: 'Retargeting ad creation', critical: false }
  ]},
  week4_launch: { title: 'Campaign Launch', items: [
    { id: 'campaign-structure', label: 'Campaign structure finalization', critical: false },
    { id: 'ad-copy-final', label: 'Final ad copy approval', critical: false },
    { id: 'budget-confirm', label: 'Budget confirmation', critical: false },
    { id: 'launch', label: 'Campaign launch', critical: true }
  ]},
  week4_handoff: { title: 'Client Handoff', items: [
    { id: 'dashboard-walkthrough', label: 'Reporting dashboard walkthrough', critical: false },
    { id: 'expectations', label: 'Set ongoing expectations', critical: false },
    { id: 'communication', label: 'Establish communication cadence', critical: false },
    { id: 'documentation', label: 'Handoff documentation complete', critical: false }
  ]}
};

// \u2500\u2500 Sprint functions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

function renderSprintClientBar() {
  if (!dashboardData) {
    fetch(API + '/api/dashboard').then(function(r) { return r.json(); }).then(function(d) {
      dashboardData = d; renderSprintClientBar();
    });
    return;
  }
  var clients = dashboardData.clients;
  var sprintClients = clients.filter(function(c) { return c.has_sprint === 1; });
  var html = '';
  for (var i = 0; i < sprintClients.length; i++) {
    var c = sprintClients[i];
    html += '<button class="sprint-client-btn' + (sprintClientId === c.id ? ' active' : '') + '" data-action="sprint-select-client" data-id="' + c.id + '">' + esc(c.name) + '</button>';
  }
  html += '<button class="sprint-activate-btn" data-action="sprint-activate">+ Activate Sprint</button>';
  document.getElementById('sprintClientBar').innerHTML = html;
}

async function loadSprintClient(clientId) {
  sprintClientId = clientId;
  sprintPhase = 'preSprint';
  document.getElementById('sprintContent').innerHTML = '<div class="loading">Loading checklist...</div>';
  renderSprintClientBar();
  var res = await fetch(API + '/api/sprint/' + clientId);
  var data = await res.json();
  sprintItems = {};
  for (var i = 0; i < data.items.length; i++) {
    var item = data.items[i];
    sprintItems[item.task_id] = { completed: item.completed, completed_by: item.completed_by, completed_date: item.completed_date };
  }
  renderSprintChecklist();
}

function getSprintStats() {
  var total = 0, done = 0;
  var phaseStats = {};
  for (var p = 0; p < SPRINT_PHASES.length; p++) {
    var phase = SPRINT_PHASES[p];
    phaseStats[phase.id] = { total: 0, done: 0 };
    for (var s = 0; s < phase.sections.length; s++) {
      var sec = SPRINT_SECTIONS[phase.sections[s]];
      for (var i = 0; i < sec.items.length; i++) {
        total++; phaseStats[phase.id].total++;
        var item = sprintItems[sec.items[i].id];
        if (item && item.completed) { done++; phaseStats[phase.id].done++; }
      }
    }
  }
  return { total: total, done: done, phaseStats: phaseStats };
}

function renderSprintChecklist() {
  var stats = getSprintStats();
  var pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  var html = '';
  html += '<div class="sprint-progress-wrap">';
  html += '<div class="sprint-progress-header"><span class="pct">' + pct + '%</span><span class="counts">' + stats.done + ' / ' + stats.total + ' tasks complete</span><button class="sprint-graduate-btn" onclick="graduateSprint(\\'' + sprintClientId + '\\')">&#127891; Graduate from Sprint</button></div>';
  html += '<div class="sprint-progress-bar"><div class="sprint-progress-fill" style="width:' + pct + '%"></div></div>';
  html += '</div>';
  html += '<div class="phase-nav">';
  for (var p = 0; p < SPRINT_PHASES.length; p++) {
    var phase = SPRINT_PHASES[p];
    var ps = stats.phaseStats[phase.id];
    var ppct = ps.total > 0 ? Math.round((ps.done / ps.total) * 100) : 0;
    html += '<button class="phase-btn' + (sprintPhase === phase.id ? ' active' : '') + '" data-action="sprint-phase" data-id="' + phase.id + '">';
    html += '<span class="phase-name">' + phase.name + '</span>';
    html += '<span class="phase-sub">' + phase.subtitle + '</span>';
    html += '<span class="phase-pct">' + ppct + '% &middot; ' + ps.done + '/' + ps.total + '</span>';
    html += '</button>';
  }
  html += '</div>';
  var activePhase = SPRINT_PHASES.filter(function(p) { return p.id === sprintPhase; })[0];
  if (activePhase) {
    for (var s = 0; s < activePhase.sections.length; s++) {
      var secKey = activePhase.sections[s];
      var sec = SPRINT_SECTIONS[secKey];
      var secDone = 0;
      for (var i = 0; i < sec.items.length; i++) {
        var it = sprintItems[sec.items[i].id];
        if (it && it.completed) secDone++;
      }
      html += '<div class="sprint-section">';
      html += '<div class="sprint-section-header" data-action="sprint-toggle-section">';
      html += '<span class="sprint-section-title">' + esc(sec.title) + '</span>';
      html += '<span class="sprint-section-count"><span class="done-count">' + secDone + '</span> / ' + sec.items.length + '</span>';
      html += '</div>';
      html += '<div class="sprint-section-items">';
      for (var i = 0; i < sec.items.length; i++) {
        var task = sec.items[i];
        var state = sprintItems[task.id];
        var isDone = state && state.completed;
        html += '<div class="checklist-item" data-action="sprint-toggle-item" data-id="' + task.id + '">';
        html += '<div class="checklist-circle' + (isDone ? ' done' : '') + '"></div>';
        html += '<span class="checklist-label' + (isDone ? ' done' : '') + '">' + esc(task.label) + '</span>';
        if (task.critical) html += '<span class="checklist-badge critical">Critical</span>';
        if (isDone && state.completed_by) html += '<span class="checklist-by">' + esc(state.completed_by) + '</span>';
        html += '</div>';
      }
      html += '</div></div>';
    }
  }
  document.getElementById('sprintContent').innerHTML = html;
}

async function toggleSprintItem(taskId) {
  if (!sprintClientId) return;
  var state = sprintItems[taskId];
  if (state && state.completed) {
    state.completed = 0; state.completed_by = ''; state.completed_date = '';
  } else {
    sprintItems[taskId] = { completed: 1, completed_by: '', completed_date: new Date().toISOString().split('T')[0] };
  }
  renderSprintChecklist();
  await fetch(API + '/api/sprint/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: sprintClientId, task_id: taskId, completed_by: '' })
  });
}

function showActivateModal() {
  if (!dashboardData) return;
  var clients = dashboardData.clients.filter(function(c) { return !c.has_sprint; });
  var html = '<div class="activate-modal-overlay" id="activateOverlay">';
  html += '<div class="activate-modal">';
  html += '<h3>Activate 30-Day Sprint</h3>';
  html += '<label>Client</label>';
  html += '<select id="activateClientSelect">';
  for (var i = 0; i < clients.length; i++) {
    html += '<option value="' + clients[i].id + '">' + esc(clients[i].name) + '</option>';
  }
  html += '</select>';
  html += '<label>Start Date</label>';
  html += '<input type="date" id="activateDate" value="' + new Date().toISOString().split('T')[0] + '">';
  html += '<div class="activate-modal-actions">';
  html += '<button class="cancel-btn" data-action="sprint-activate-cancel">Cancel</button>';
  html += '<button class="confirm-btn" data-action="sprint-activate-confirm">Activate</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeActivateModal() {
  var overlay = document.getElementById('activateOverlay');
  if (overlay) overlay.remove();
}

async function activateSprintClient() {
  var sel = document.getElementById('activateClientSelect');
  var date = document.getElementById('activateDate');
  if (!sel || !sel.value) return;
  var res = await fetch(API + '/api/sprint/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: sel.value, start_date: date ? date.value : '' })
  });
  if (!res.ok) {
    var err = await res.json();
    alert(err.error || 'Activation failed');
    return;
  }
  closeActivateModal();
  var dr = await fetch(API + '/api/dashboard');
  dashboardData = await dr.json();
  renderSprintClientBar();
  loadSprintClient(sel.value);
}

async function graduateSprint(clientId) {
  if (!clientId) return;
  if (!confirm('Graduate this client from the 30-Day Sprint?\\n\\nThey leave the Sprint tab (checklist history is kept) and stay an active client. You can re-add them later.')) return;
  await fetch(API + '/api/sprint/deactivate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: clientId }) });
  showSnackbar('Graduated from sprint');
  sprintClientId = null;
  var dr = await fetch(API + '/api/dashboard');
  dashboardData = await dr.json();
  renderSprintClientBar();
  document.getElementById('sprintContent').innerHTML = '<div class="loading">Select a client to view their sprint checklist.</div>';
}

// \u2500\u2500 Google Ads Portal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function loadPortalSection(clientId) {
  var el = document.getElementById('portalSection');
  if (!el) return;
  var res = await fetch(API + '/api/clients/' + clientId + '/portal-token');
  if (res.status === 401) return;
  var d = await res.json();
  var tok = d.token;
  if (tok) {
    var url = location.origin + '/portal/' + tok.token;
    el.innerHTML =
      '<div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;background:var(--surface)">' +
      '<div class="section-title" style="margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">Google Ads Client Portal</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<input type="text" value="' + url + '" readonly style="flex:1;min-width:180px;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:11px;font-family:monospace;background:var(--bg);color:var(--text)">' +
      '<button data-action="portal-copy" data-id="' + esc(clientId) + '" data-val="' + url + '" style="padding:7px 12px;border-radius:6px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font-size:12px;font-family:inherit">Copy</button>' +
      '<button data-action="portal-revoke" data-id="' + esc(clientId) + '" style="padding:7px 12px;border-radius:6px;border:1px solid var(--border);background:var(--surface);cursor:pointer;font-size:12px;font-family:inherit;color:var(--red)">Revoke</button>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Created ' + new Date(tok.created_at).toLocaleDateString() + '</div>' +
      '</div>';
  } else {
    el.innerHTML =
      '<div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;background:var(--surface)">' +
      '<div class="section-title" style="margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">Google Ads Client Portal</div>' +
      '<button data-action="portal-create" data-id="' + esc(clientId) + '" style="padding:7px 14px;border-radius:6px;border:none;background:var(--accent);color:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit">Generate Portal Link</button>' +
      '</div>';
  }
}

async function portalCreate(clientId) {
  var res = await fetch(API + '/api/clients/' + clientId + '/portal-token', { method: 'POST' });
  if (!res.ok) { var e = await res.json(); alert(e.error || 'Failed'); return; }
  loadPortalSection(clientId);
}

async function portalRevoke(clientId) {
  if (!confirm('Revoke this portal link? The client will lose access immediately.')) return;
  await fetch(API + '/api/clients/' + clientId + '/portal-token', { method: 'DELETE' });
  loadPortalSection(clientId);
}

// \u2500\u2500 Client Services Grid \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

var servicesData = null;

var SERVICE_COLS = [
  {key:'weekly_email', label:'Email'},
  {key:'drip',         label:'Drip'},
  {key:'ga4',          label:'GA4'},
  {key:'gads',         label:'G Ads'},
  {key:'meta',         label:'Meta'},
  {key:'clarity',      label:'Clarity'},
  {key:'audiencelab',  label:'Int. Data'},
  {key:'pipeline',     label:'Pipeline'},
  {key:'pixel',        label:'Pixel'},
  {key:'gbp',          label:'GBP'},
  {key:'crm',          label:'Vendasta'},
  {key:'social',       label:'Social'},
  {key:'website',      label:'Website'},
  {key:'seo',          label:'SEO'},
];

var STATUS_CYCLE   = ['none','pending','active','paused','cancelled'];
var WEBSITE_CYCLE  = ['none','B','M','O'];

// ── Client Health ──
var clientHealthData = null;
var CH_SIGNAL_LABELS = {google_ads_cpl:'CPL',google_ads_impressions:'Impressions',ga4_sessions:'Sessions',clarity_scroll_depth:'Scroll depth',email_open_rate:'Email opens',pixel_visitor_volume:'Pixel visitors',gbp_review_recency_days:'GBP review',meta_ctr:'Meta CTR'};
var CH_CSS = '.ch-sub{color:var(--text-dim);font-size:13px;margin-bottom:18px}'
+ '.ch-summary{display:flex;gap:12px;margin-bottom:20px}'
+ '.ch-stat{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px}'
+ '.ch-num{font-size:28px;font-weight:700;line-height:1}'
+ '.ch-lbl{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin-top:6px;font-weight:600}'
+ '.ch-stat.red .ch-num{color:var(--red)}.ch-stat.amber .ch-num{color:var(--amber)}.ch-stat.green .ch-num{color:var(--green)}'
+ '.ch-row{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:10px}'
+ '.ch-row-main{display:flex;align-items:center;gap:16px}'
+ '.ch-pill{font-size:20px;font-weight:700;min-width:54px;height:46px;display:flex;align-items:center;justify-content:center;border-radius:10px}'
+ '.ch-s-red{background:var(--red-bg);color:var(--red)}.ch-s-amber{background:var(--amber-bg);color:var(--amber)}.ch-s-green{background:var(--green-bg);color:var(--green)}'
+ '.ch-name{flex:1}.ch-cn{font-size:16px;font-weight:700}'
+ '.ch-flags{margin-top:5px;display:flex;gap:6px;flex-wrap:wrap}'
+ '.ch-flag{font-size:11px;font-weight:600;background:var(--red-bg);color:var(--red);padding:2px 8px;border-radius:6px}'
+ '.ch-flag-none{font-size:11px;color:var(--text-muted)}'
+ '.ch-trend{font-size:11px;font-weight:700;padding:5px 13px;border-radius:20px;text-transform:uppercase;letter-spacing:.6px;color:#fff}'
+ '.ch-t-flat{background:#78716C}.ch-t-up{background:var(--green)}.ch-t-down{background:var(--amber)}.ch-t-critical{background:var(--red);box-shadow:0 0 0 3px var(--red-bg)}'
+ '.ch-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)}'
+ '.ch-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 9px;border-radius:7px;background:var(--surface2);border:1px solid var(--border)}'
+ '.ch-cl{color:var(--text-dim);font-weight:500}.ch-cv{font-weight:700}.ch-cd{font-size:11px;font-weight:600}'
+ '.ch-g .ch-cv{color:var(--green)}.ch-a .ch-cv{color:var(--amber)}.ch-r .ch-cv{color:var(--red)}'
+ '.ch-r .ch-cd{color:var(--red)}.ch-a .ch-cd{color:var(--amber)}';

async function loadClientHealth() {
  document.getElementById('healthContent').innerHTML = '<div class="loading">Loading...</div>';
  var res = await fetch(API + '/api/client-health');
  if (res.status === 401) { showLoginScreen(); return; }
  clientHealthData = await res.json();
  renderClientHealth();
}

function chScoreClass(score, trend) {
  if (trend === 'critical' || score < 60) return 'red';
  if (score < 85) return 'amber';
  return 'green';
}

function chFmtSignal(key, d) {
  var v = d.value, disp = '—';
  if (v != null) {
    if (key === 'gbp_review_recency_days') disp = Math.round(v) + 'd ago';
    else if (key === 'email_open_rate') disp = v.toFixed(1) + '%';
    else if (key === 'meta_ctr') disp = v.toFixed(2) + '%';
    else if (key === 'clarity_scroll_depth') disp = Math.round(v) + '%';
    else if (key === 'google_ads_cpl') disp = '$' + Math.round(v);
    else disp = Math.round(v).toLocaleString();
  }
  var delta = '';
  if (d.delta_pct != null) {
    var a = d.delta_pct > 0 ? '▲' : '▼';
    delta = ' <span class="ch-cd">' + a + Math.abs(d.delta_pct) + '%</span>';
  }
  var dot = ({green:'g',yellow:'a',red:'r'})[d.status] || 'n';
  return '<span class="ch-chip ch-' + dot + '"><span class="ch-cl">' + (CH_SIGNAL_LABELS[key] || key) + '</span><span class="ch-cv">' + disp + '</span>' + delta + '</span>';
}

function renderClientHealth() {
  if (!clientHealthData) return;
  var data = clientHealthData.clients || [];
  var nr = 0, na = 0, ng = 0;
  data.forEach(function(c) { var cl = chScoreClass(c.composite_score, c.trend); if (cl === 'red') nr++; else if (cl === 'amber') na++; else ng++; });
  var html = '<style>' + CH_CSS + '</style>';
  html += '<div class="ch-sub">Daily composite health score across all clients. Updated 7am ET. Lower = at risk.' + (clientHealthData.score_date ? ' · ' + clientHealthData.score_date : '') + '</div>';
  html += '<div class="ch-summary">';
  html += '<div class="ch-stat red"><div class="ch-num">' + nr + '</div><div class="ch-lbl">Critical / At Risk</div></div>';
  html += '<div class="ch-stat amber"><div class="ch-num">' + na + '</div><div class="ch-lbl">Watch</div></div>';
  html += '<div class="ch-stat green"><div class="ch-num">' + ng + '</div><div class="ch-lbl">Healthy</div></div>';
  html += '</div>';
  if (!data.length) { html += '<div class="loading">No health scores yet. The daily job runs at 7am ET.</div>'; }
  data.forEach(function(c) {
    var cl = chScoreClass(c.composite_score, c.trend);
    var chips = '';
    for (var k in c.signals) { chips += chFmtSignal(k, c.signals[k]); }
    var flags = (c.flags && c.flags.length) ? c.flags.map(function(f) { return '<span class="ch-flag">' + esc(f) + '</span>'; }).join('') : '<span class="ch-flag-none">no flags</span>';
    var ti = ({up:'▲',flat:'—',down:'▼',critical:'⚠'})[c.trend] || '—';
    html += '<div class="ch-row"><div class="ch-row-main">';
    html += '<div class="ch-pill ch-s-' + cl + '">' + c.composite_score + '</div>';
    html += '<div class="ch-name"><div class="ch-cn">' + esc(c.client_name) + '</div><div class="ch-flags">' + flags + '</div></div>';
    html += '<span class="ch-trend ch-t-' + c.trend + '">' + ti + ' ' + c.trend + '</span>';
    html += '</div><div class="ch-chips">' + chips + '</div></div>';
  });
  document.getElementById('healthContent').innerHTML = html;
}

async function loadServices() {
  document.getElementById('servicesContent').innerHTML = '<div class="loading">Loading...</div>';
  var res = await fetch(API + '/api/services');
  if (res.status === 401) { showLoginScreen(); return; }
  servicesData = await res.json();
  renderServices();
}

function renderServices() {
  if (!servicesData) return;
  var html = '<div class="services-wrap">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  html += '<div class="section-title" style="margin-bottom:0">Client Services \u2014 ' + servicesData.length + ' clients</div>';
  html += '</div>';
  html += '<div class="services-legend">';
  html += '<span><span class="svc-badge svc-active" style="width:16px;height:16px;font-size:9px">\u2713</span> Active</span>';
  html += '<span><span class="svc-badge svc-paused" style="width:16px;height:16px;font-size:10px">\u23F8</span> Paused</span>';
  html += '<span><span class="svc-badge svc-cancelled" style="width:16px;height:16px;font-size:10px">\u2715</span> Cancelled</span>';
  html += '<span><span class="svc-badge svc-pending" style="width:16px;height:16px;font-size:9px">\u23F3</span> Pending \u2014 wanted, no access yet</span>';
  html += '<span><span class="svc-none" style="font-size:14px">\u2014</span> Not active</span>';
  html += '<span style="color:var(--text-muted);font-size:11px">Click any cell to cycle status</span>';
  html += '</div>';
  html += '<div class="services-table-wrap"><table class="services-table"><thead><tr>';
  html += '<th class="svc-client-col">Client</th>';
  html += '<th class="svc-domain-col">Domain</th>';
  SERVICE_COLS.forEach(function(col) { html += '<th>' + col.label + '</th>'; });
  html += '</tr></thead><tbody>';
  servicesData.forEach(function(client) {
    html += '<tr><td class="svc-client-name">' + esc(client.name) + '</td>';
    html += '<td class="svc-domain-cell"><input class="svc-domain-input" type="text" placeholder="example.com" value="' + esc(client.domain || '') + '" data-client="' + client.id + '" data-orig="' + esc(client.domain || '') + '" onblur="saveDomain(this)" onkeydown="if(event.keyCode===13)this.blur()"></td>';
    SERVICE_COLS.forEach(function(col) {
      var svc = client.services[col.key] || {status:'none',notes:null,social_scheduled_through:null};
      html += '<td class="svc-cell" data-client="' + client.id + '" data-svc="' + col.key + '" data-status="' + (svc.status||'none') + '" onclick="cycleServiceStatus(this)">';
      html += renderSvcBadge(col.key, svc);
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  document.getElementById('servicesContent').innerHTML = html;
}

function renderSvcBadge(key, svc) {
  var s = svc.status || 'none';
  if (s === 'none') return '<span class="svc-none">\u2014</span>';
  if (key === 'website') {
    var label = s === 'B' ? 'Burt' : s === 'M' ? 'Mktg Perf' : s === 'O' ? 'Other' : s;
    return '<span class="svc-badge svc-website" title="' + label + '">' + s + '</span>';
  }
  if (s === 'active') {
    var thru = (key === 'social' && svc.social_scheduled_through) ? '<span class="svc-thru">thru ' + svc.social_scheduled_through + '</span>' : '';
    return '<span class="svc-badge svc-active">\u2713</span>' + thru;
  }
  if (s === 'paused') {
    var info = svc.notes ? '<span class="svc-note-icon" title="' + svc.notes.replace(/"/g,"&quot;") + '">\u2139</span>' : '';
    return '<span class="svc-badge svc-paused">\u23F8</span>' + info;
  }
  if (s === 'cancelled') return '<span class="svc-badge svc-cancelled">\u2715</span>';
  if (s === 'pending') {
    var pinfo = svc.notes ? '<span class="svc-note-icon" title="' + svc.notes.replace(/"/g,"&quot;") + '">\u2139</span>' : '';
    return '<span class="svc-badge svc-pending" title="Wanted \u2014 access not confirmed">\u23F3</span>' + pinfo;
  }
  return '<span class="svc-none">\u2014</span>';
}

async function cycleServiceStatus(cell) {
  var clientId = cell.dataset.client;
  var service = cell.dataset.svc;
  var current = cell.dataset.status || 'none';
  var cycle = (service === 'website') ? WEBSITE_CYCLE : STATUS_CYCLE;
  var idx = cycle.indexOf(current);
  if (idx === -1) idx = 0;
  var next = cycle[(idx + 1) % cycle.length];

  var body = {status: next, notes: null, social_scheduled_through: null};

  if ((next === 'paused' || next === 'cancelled') && current === 'active') {
    var reason = prompt('Reason (optional):');
    if (reason === null) return;
    if (reason) body.notes = reason;
  }

  // Optimistic update
  cell.dataset.status = next;
  var client = servicesData.find(function(c) { return c.id === clientId; });
  if (client) {
    if (!client.services[service]) client.services[service] = {};
    client.services[service].status = next;
    client.services[service].notes = body.notes;
    client.services[service].social_scheduled_through = body.social_scheduled_through;
    cell.innerHTML = renderSvcBadge(service, client.services[service]);
  }

  var res = await fetch(API + '/api/services/' + clientId + '/' + service, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    showSnackbar('Update failed');
    cell.dataset.status = current;
    if (client && client.services[service]) {
      client.services[service].status = current;
      cell.innerHTML = renderSvcBadge(service, client.services[service]);
    }
  }
}

async function saveDomain(input) {
  var clientId = input.dataset.client;
  var orig = input.dataset.orig;
  var val = input.value.trim();
  if (val === orig) return;
  var res = await fetch(API + '/api/clients/' + clientId + '/domain', {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({domain: val})
  });
  if (res.ok) {
    var data = await res.json();
    input.value = data.domain || '';
    input.dataset.orig = input.value;
    var client = servicesData.find(function(c) { return c.id === clientId; });
    if (client) client.domain = data.domain;
    showSnackbar('Domain saved');
  } else {
    input.value = orig;
    showSnackbar('Failed to save domain');
  }
}

// \u2500\u2500 Maintenance tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

var maintData = null;

async function loadMaintenance() {
  document.getElementById('maintenanceContent').innerHTML = '<div class="loading">Loading...</div>';
  var res = await fetch(API + '/api/maintenance');
  if (res.status === 401) { showLoginScreen(); return; }
  maintData = await res.json();
  renderMaintenance();
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  var now = new Date();
  return Math.floor((now - d) / 86400000);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  var d = new Date(dateStr);
  var now = new Date();
  return Math.floor((d - now) / 86400000);
}

function maintFlag(days, warnAt, redAt) {
  if (days === null) return '<span class="maint-dim">\u2014</span>';
  if (days >= redAt) return '<span class="maint-flag-red">\u{1F534} ' + days + 'd ago</span>';
  if (days >= warnAt) return '<span class="maint-flag-warn">\u26A0\uFE0F ' + days + 'd ago</span>';
  return '<span class="maint-flag-ok">\u2713 ' + days + 'd ago</span>';
}

function renderMaintenance() {
  if (!maintData) return;
  var today = new Date().toISOString().slice(0, 10);
  var html = '<div class="services-wrap">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">';
  html += '<div class="section-title" style="margin-bottom:0">Maintenance \u2014 ' + maintData.length + ' clients</div>';
  html += '<button class="seo-check-btn" onclick="checkAllSeo()" style="padding:5px 14px;font-size:12px">Check All SEO</button>';
  html += '</div>';
  html += '<div class="maint-table-wrap"><table class="maint-table"><thead><tr>';
  html += '<th class="maint-client" style="min-width:140px">Client</th>';
  html += '<th>Website</th>';
  html += '<th>Social</th>';
  html += '<th>Last Report</th>';
  html += '<th>Last Audit</th>';
  html += '<th>SEO</th>';
  html += '<th style="min-width:160px">Notes</th>';
  html += '</tr></thead><tbody>';

  maintData.forEach(function(c) {
    html += '<tr>';
    html += '<td class="maint-client">' + esc(c.name) + '</td>';

    // Website column
    if (c.website_status === 'B' && c.domain) {
      html += '<td class="maint-wp-age" id="wp-' + c.id + '"><span class="maint-loading">checking...</span></td>';
    } else if (c.website_status === 'B' && !c.domain) {
      html += '<td><span class="maint-dim">Burt \u2014 no domain set</span></td>';
    } else {
      html += '<td><span class="maint-dim">\u2014</span></td>';
    }

    // Social column
    if (c.social_status === 'active') {
      var du = daysUntil(c.social_through);
      if (c.social_through === null) {
        html += '<td><span class="maint-flag-red">\u{1F534} no posts scheduled</span></td>';
      } else if (du < 0) {
        html += '<td><span class="maint-flag-red">\u{1F534} expired ' + Math.abs(du) + 'd ago</span></td>';
      } else if (du < 14) {
        html += '<td><span class="maint-flag-warn">\u26A0\uFE0F ' + du + 'd remaining</span></td>';
      } else {
        html += '<td><span class="maint-flag-ok">\u2713 ' + du + 'd remaining</span></td>';
      }
    } else if (c.social_status === 'paused') {
      html += '<td><span class="maint-dim">\u2014 (paused)</span></td>';
    } else {
      html += '<td><span class="maint-dim">\u2014</span></td>';
    }

    // Last Report
    var rDays = daysSince(c.last_report_date);
    html += '<td>';
    if (rDays !== null) html += maintFlag(rDays, 30, 45) + ' ';
    html += '<button class="maint-date-btn" data-client="' + c.id + '" data-field="last_report_date" data-value="' + today + '" onclick="setMaintDate(this)" title="Mark today">Today</button>';
    html += '</td>';

    // Last Audit
    var aDays = daysSince(c.last_audit_date);
    html += '<td>';
    if (aDays !== null) html += maintFlag(aDays, 90, 120) + ' ';
    html += '<button class="maint-date-btn" data-client="' + c.id + '" data-field="last_audit_date" data-value="' + today + '" onclick="setMaintDate(this)" title="Mark today">Today</button>';
    html += '</td>';

    // SEO column
    if (c.domain) {
      html += '<td id="seo-' + c.id + '"><button class="seo-check-btn" data-client="' + c.id + '" onclick="checkSeo(this)">Check</button></td>';
    } else {
      html += '<td><span class="maint-dim">\u2014</span></td>';
    }

    // Notes
    html += '<td><input class="maint-notes-input" type="text" placeholder="notes..." value="' + esc(c.maint_notes || '') + '" data-client="' + c.id + '" data-orig="' + esc(c.maint_notes || '') + '" onblur="saveMaintNotes(this)" onkeydown="if(event.keyCode===13)this.blur()"></td>';

    html += '</tr>';
  });

  html += '</tbody></table></div></div>';
  document.getElementById('maintenanceContent').innerHTML = html;

  // Kick off WP age checks for Burt sites
  maintData.forEach(function(c) {
    if (c.website_status === 'B' && c.domain) {
      fetchWpAge(c.id);
    }
  });
}

async function fetchWpAge(clientId) {
  var cell = document.getElementById('wp-' + clientId);
  if (!cell) return;
  try {
    var res = await fetch(API + '/api/maintenance/wp/' + clientId);
    var data = await res.json();
    if (data.error || !data.modified) {
      cell.innerHTML = '<span class="maint-flag-warn">\u26A0\uFE0F WP API unavailable</span>';
      return;
    }
    var days = daysSince(data.modified);
    cell.innerHTML = maintFlag(days, 60, 90);
  } catch(e) {
    cell.innerHTML = '<span class="maint-dim">error</span>';
  }
}

function checkAllSeo() {
  if (!maintData) return;
  maintData.forEach(function(c) {
    if (!c.domain) return;
    var cell = document.getElementById('seo-' + c.id);
    if (!cell) return;
    var btn = cell.querySelector('button');
    if (btn) checkSeo(btn);
  });
}

async function checkSeo(btn) {
  var clientId = btn.dataset.client;
  var cell = document.getElementById('seo-' + clientId);
  cell.innerHTML = '<span class="maint-loading">checking...</span>';
  try {
    var res = await fetch(API + '/api/maintenance/seo/' + clientId);
    var d = await res.json();
    if (d.error) { cell.innerHTML = '<span class="maint-dim">\u2014</span>'; return; }
    var out = '';
    if (d.score !== null && d.score !== undefined) {
      var cls = d.score >= 90 ? 'seo-score-g' : d.score >= 50 ? 'seo-score-y' : 'seo-score-r';
      out += '<span class="' + cls + '">\u{1F4F1}' + d.score + '</span> ';
    } else {
      out += '<span class="maint-dim">\u{1F4F1}\u2014</span> ';
    }
    if (d.hasMeta === true) {
      out += '<span class="maint-flag-ok">meta\u2713</span> ';
    } else if (d.hasMeta === false) {
      out += '<span class="maint-flag-warn">\u26A0\uFE0Fmeta</span> ';
    }
    if (d.noindex) {
      out += '<span class="maint-flag-red">\u{1F534}noindex</span>';
    } else if (d.hasMeta !== null) {
      out += '<span class="maint-flag-ok">idx\u2713</span>';
    }
    out += ' <button class="seo-check-btn" data-client="' + clientId + '" onclick="checkSeo(this)" style="margin-left:2px">\u21BB</button>';
    cell.innerHTML = out;
  } catch(e) {
    cell.innerHTML = '<span class="maint-dim">error</span>';
  }
}

async function setMaintDate(btn) {
  var clientId = btn.dataset.client;
  var field = btn.dataset.field;
  var value = btn.dataset.value;
  var body = {};
  body[field] = value;
  var res = await fetch(API + '/api/clients/' + clientId + '/maintenance', {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if (res.ok) {
    var c = maintData.find(function(x) { return x.id === clientId; });
    if (c) c[field] = value;
    renderMaintenance();
    showSnackbar('Saved');
  } else {
    showSnackbar('Failed to save');
  }
}

async function saveMaintNotes(input) {
  var clientId = input.dataset.client;
  var orig = input.dataset.orig;
  var val = input.value.trim();
  if (val === orig) return;
  var res = await fetch(API + '/api/clients/' + clientId + '/maintenance', {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({maint_notes: val})
  });
  if (res.ok) {
    input.dataset.orig = val;
    var c = maintData.find(function(x) { return x.id === clientId; });
    if (c) c.maint_notes = val;
    showSnackbar('Notes saved');
  } else {
    input.value = orig;
    showSnackbar('Failed to save');
  }
}

function fmtActivityDate(s){if(!s)return'';var d=String(s).split(' ')[0];var p=d.split('-');if(p.length===3)return p[1]+'/'+p[2]+'/'+p[0].slice(2);return d;}

async function loadClientActivity(clientId){
  var wrap=document.getElementById('clientActivity');
  if(!wrap)return;
  try{
    var res=await fetch(API+'/api/clients/'+clientId+'/activity');
    if(!res.ok){wrap.innerHTML='';return;}
    var data=await res.json();
    renderClientActivity(data.activity||[]);
  }catch(e){wrap.innerHTML='';}
}

function renderClientActivity(rows){
  var wrap=document.getElementById('clientActivity');
  if(!wrap)return;
  if(!rows.length){wrap.innerHTML='';return;}
  var html='<div class="section-title" style="margin-top:24px">Client Activity</div>';
  html+='<div class="activity-list">';
  for(var i=0;i<rows.length;i++){
    var r=rows[i];
    var meta=fmtActivityDate(r.created_at)+' \u00b7 '+esc(r.tool||'')+' \u00b7 '+esc(r.kind||'');
    if(r.score!==null&&r.score!==undefined&&r.score!=='')meta+=' \u00b7 '+esc(String(r.score));
    meta+=loopBadge(r);
    var summary=esc(r.summary||'');
    if(r.artifact_url)summary='<a href="'+esc(r.artifact_url)+'" target="_blank" rel="noopener">'+(summary||'View')+'</a>';
    html+='<div class="activity-item" style="padding:8px 0;border-bottom:1px solid var(--border)">';
    html+='<div style="font-size:12px;color:var(--text-dim)">'+meta+'</div>';
    if(summary)html+='<div style="font-size:14px;margin-top:2px">'+summary+'</div>';
    html+='</div>';
  }
  html+='</div>';
  wrap.innerHTML=html;
}

// ── Cloud Agent Feed (engageengine-agents) ─────────────────
var agentsFeedData=[];

async function loadAgentsFeed(){
  var wrap=document.getElementById('agentsContent');
  if(!wrap)return;
  wrap.innerHTML='<div class="loading">Loading...</div>';
  try{
    var res=await fetch(API+'/api/agents');
    if(res.status===401){showLoginScreen();return;}
    if(!res.ok){wrap.innerHTML='<div class="loading">Failed to load agents.</div>';return;}
    var data=await res.json();
    agentsFeedData=data.agents||[];
    renderAgentsFeed();
  }catch(e){wrap.innerHTML='<div class="loading">Failed to load agents.</div>';}
}

function agentAgo(ts){
  if(!ts)return'';
  var s=Math.max(0,Math.round((Date.now()-ts)/1000));
  if(s<60)return s+'s ago';
  var m=Math.round(s/60);
  if(m<60)return m+'m ago';
  var h=Math.round(m/60);
  if(h<24)return h+'h ago';
  return Math.round(h/24)+'d ago';
}

function renderAgentsFeed(){
  var wrap=document.getElementById('agentsContent');
  if(!wrap)return;
  var rows=agentsFeedData||[];
  var meta={launched:['Launched','#8668ff'],active:['Working','#00a1b3'],quiet:['Quiet','#ed6300'],completed:['Done','#0071e3'],error:['Error','#b64400']};
  var html='<div class="section-title">Cloud Agents</div>';
  html+='<div style="font-size:13px;color:var(--text-dim);margin-bottom:14px">Live status from claude.ai/code cloud runs reporting to the engageengine-agents feed.</div>';
  if(!rows.length){
    html+='<div class="loading">No agent runs yet.</div>';
    wrap.innerHTML=html;
    return;
  }
  html+='<div class="activity-list">';
  for(var k=0;k<rows.length;k++){
    var r=rows[k];
    var m=meta[r.view_state]||meta.active;
    html+='<div class="activity-item" style="padding:10px 12px;margin-bottom:10px;border:1px solid var(--border);border-left:4px solid '+m[1]+';border-radius:10px;background:var(--surface)">';
    html+='<div style="font-size:12px;color:var(--text-dim)"><span style="color:'+m[1]+';font-weight:600">'+m[0]+'</span> · '+agentAgo(r.last_event_at||r.created_at)+(r.repos?' · '+esc(r.repos):'')+'</div>';
    html+='<div style="font-size:14px;font-weight:600;margin-top:3px">'+esc(r.title||r.run_id)+'</div>';
    if(r.detail)html+='<div style="font-size:13px;color:var(--text-dim);margin-top:2px">'+esc(r.detail)+'</div>';
    var links='';
    if(r.session_url)links+='<a href="'+esc(r.session_url)+'" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px;margin-right:12px">Open session ↗</a>';
    if(r.pr_urls){var prs=String(r.pr_urls).split(',').join(' ').split(' ');for(var p=0;p<prs.length;p++){if(prs[p])links+='<a href="'+esc(prs[p])+'" target="_blank" rel="noopener" style="color:var(--accent);font-size:12px;margin-right:12px">PR ↗</a>';}}
    if(links)html+='<div style="margin-top:8px">'+links+'</div>';
    html+='</div>';
  }
  html+='</div>';
  wrap.innerHTML=html;
}

// ── Firm-wide Activity Feed ─────────────────────────────────

async function loadActivityFeed(){
  var wrap=document.getElementById('activityContent');
  if(!wrap)return;
  wrap.innerHTML='<div class="loading">Loading...</div>';
  try{
    var qs=activityToolFilter?('?tool='+encodeURIComponent(activityToolFilter)):'';
    var res=await fetch(API+'/api/activity'+qs);
    if(res.status===401){showLoginScreen();return;}
    if(!res.ok){wrap.innerHTML='<div class="loading">Failed to load activity.</div>';return;}
    var data=await res.json();
    activityFeedData=data.activity||[];
    try{
      var dueRes=await fetch(API+'/api/activity/due');
      if(dueRes.ok){var dueData=await dueRes.json();activityDueData=dueData.due||[];activityScoreboard=dueData.scoreboard||{};}
    }catch(e2){activityDueData=[];}
    renderActivityFeed();
  }catch(e){wrap.innerHTML='<div class="loading">Failed to load activity.</div>';}
}

function renderActivityFeed(){
  var wrap=document.getElementById('activityContent');
  if(!wrap)return;
  var rows=activityFeedData||[];
  var tools=[];
  for(var i=0;i<rows.length;i++){
    var t=rows[i].tool||'';
    if(t&&tools.indexOf(t)===-1)tools.push(t);
  }
  tools.sort();
  var html='';
  var due=activityDueData||[];
  var sb=activityScoreboard||{};
  var reviewed=(sb.confirmed||0)+(sb.missed||0)+(sb.partial||0);
  if(due.length||reviewed){
    html+='<div class="section-title">The Loop — What Happened Next?</div>';
    if(reviewed){
      var hitPct=Math.round(((sb.confirmed||0)+(sb.partial||0)*0.5)/reviewed*100);
      html+='<div style="font-size:13px;color:var(--text-dim);margin-bottom:10px">Scoreboard: '+(sb.confirmed||0)+' confirmed · '+(sb.partial||0)+' partial · '+(sb.missed||0)+' missed — <strong style="color:var(--text)">'+hitPct+'% hit rate</strong> ('+reviewed+' reviewed)</div>';
    }
    if(!due.length){
      html+='<div style="font-size:13px;color:var(--text-dim);margin-bottom:20px">Nothing due for review. New predictions come back here on their review date.</div>';
    }
    for(var d=0;d<due.length;d++){
      var q=due[d];
      var qmeta=esc(q.client_name||'—')+' · '+esc(q.tool||'')+' · logged '+fmtActivityDate(q.created_at)+' · due '+fmtActivityDate(q.review_at);
      html+='<div class="activity-item" style="padding:10px 12px;margin-bottom:10px;border:1px solid var(--border);border-left:4px solid var(--accent);border-radius:10px;background:var(--surface)">';
      html+='<div style="font-size:12px;color:var(--text-dim)">'+qmeta+'</div>';
      if(q.summary)html+='<div style="font-size:14px;margin-top:2px">'+(q.artifact_url?'<a href="'+esc(q.artifact_url)+'" target="_blank" rel="noopener">'+esc(q.summary)+'</a>':esc(q.summary))+'</div>';
      if(q.expected_outcome)html+='<div style="font-size:13px;margin-top:4px"><strong>Predicted:</strong> '+esc(q.expected_outcome)+'</div>';
      html+='<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">';
      html+='<button data-action="loop-outcome" data-id="'+q.id+'" data-val="confirmed" style="background:#16A34A;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer">Confirmed</button>';
      html+='<button data-action="loop-outcome" data-id="'+q.id+'" data-val="partial" style="background:#D97706;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer">Partial</button>';
      html+='<button data-action="loop-outcome" data-id="'+q.id+'" data-val="missed" style="background:#DC2626;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer">Missed</button>';
      html+='<button data-action="loop-outcome" data-id="'+q.id+'" data-val="na" style="background:var(--surface2);color:var(--text-dim);border:1px solid var(--border);padding:5px 12px;border-radius:6px;font-size:12px;cursor:pointer">N/A</button>';
      html+='</div></div>';
    }
    html+='<div style="height:16px"></div>';
  }
  html+='<div class="section-title">Firm-Wide Activity</div>';
  html+='<div style="margin-bottom:14px">';
  html+='<select data-action="activity-filter-tool" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:13px;outline:none">';
  html+='<option value=""'+(activityToolFilter===''?' selected':'')+'>All tools</option>';
  for(var j=0;j<tools.length;j++){
    var tv=tools[j];
    html+='<option value="'+esc(tv)+'"'+(activityToolFilter===tv?' selected':'')+'>'+esc(tv)+'</option>';
  }
  html+='</select>';
  html+='</div>';
  if(!rows.length){
    html+='<div class="loading">No activity yet.</div>';
    wrap.innerHTML=html;
    return;
  }
  html+='<div class="activity-list">';
  for(var k=0;k<rows.length;k++){
    var r=rows[k];
    var meta=fmtActivityDate(r.created_at)+' \u00b7 '+esc(r.client_name||'\u2014')+' \u00b7 '+esc(r.tool||'')+' \u00b7 '+esc(r.kind||'');
    if(r.score!==null&&r.score!==undefined&&r.score!=='')meta+=' \u00b7 '+esc(String(r.score));
    var summary=esc(r.summary||'');
    if(r.artifact_url)summary='<a href="'+esc(r.artifact_url)+'" target="_blank" rel="noopener">'+(summary||'View')+'</a>';
    html+='<div class="activity-item" style="padding:8px 0;border-bottom:1px solid var(--border)">';
    html+='<div style="font-size:12px;color:var(--text-dim)">'+meta+loopBadge(r)+'</div>';
    if(summary)html+='<div style="font-size:14px;margin-top:2px">'+summary+'</div>';
    if(r.expected_outcome&&!r.outcome_status)html+='<div style="font-size:12px;color:var(--text-dim);margin-top:2px">Predicted: '+esc(r.expected_outcome)+(r.review_at?' (review '+fmtActivityDate(r.review_at)+')':'')+'</div>';
    if(r.outcome_note)html+='<div style="font-size:12px;color:var(--text-dim);margin-top:2px">Outcome: '+esc(r.outcome_note)+'</div>';
    html+='</div>';
  }
  html+='</div>';
  wrap.innerHTML=html;
}

function loopBadge(r){
  if(!r||!r.outcome_status)return'';
  var colors={confirmed:'#16A34A',partial:'#D97706',missed:'#DC2626',na:'#78716C'};
  var labels={confirmed:'CONFIRMED',partial:'PARTIAL',missed:'MISSED',na:'N/A'};
  var c=colors[r.outcome_status]||'#78716C';
  return' <span style="color:'+c+';font-weight:700;font-size:11px;letter-spacing:0.5px">'+(labels[r.outcome_status]||'')+'</span>';
}

async function recordLoopOutcome(id,status){
  var note=window.prompt('What actually happened? (optional note)','');
  if(note===null)return;
  try{
    var res=await fetch(API+'/api/activity/'+id+'/outcome',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:status,note:note})});
    if(res.ok){showSnackbar('Outcome recorded');loadActivityFeed();}
    else{showSnackbar('Failed to record outcome');}
  }catch(e){showSnackbar('Failed to record outcome');}
}

// \u2500\u2500 Init \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

${authed ? "loadDashboard();" : "// Not authed \u2014 wait for login"}
<\/script>
</body>
</html>`;
}
__name(getHTML, "getHTML");
// ==================== ADS AUDIT ENGINE ====================
function auditAuthorized(request, env) {
  const secret = request.headers.get("X-Internal-Secret");
  return !!secret && !!env.INTERNAL_AUDIT_SECRET && secret === env.INTERNAL_AUDIT_SECRET;
}
__name(auditAuthorized, "auditAuthorized");
async function auditGadsToken(env) {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GADS_CLIENT_ID,
      client_secret: env.GADS_CLIENT_SECRET,
      refresh_token: env.GADS_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const d = await resp.json();
  if (!d.access_token) throw new Error(`Google token exchange failed: ${d.error_description || d.error}`);
  return d.access_token;
}
__name(auditGadsToken, "auditGadsToken");
// Direct-billed accounts (client pays Google direct; NOT under our MCC 7536541386).
// Do NOT send login-customer-id=MCC for these — it fails. See Credentials Index.
var AUDIT_DIRECT_ACCOUNTS = /* @__PURE__ */ new Set(["6952791370", "1134268807"]);
async function auditGAQL(token, env, custId, query) {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "developer-token": env.GADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json"
  };
  if (!AUDIT_DIRECT_ACCOUNTS.has(String(custId))) headers["login-customer-id"] = "7536541386";
  const resp = await fetch(`https://googleads.googleapis.com/v21/customers/${custId}/googleAds:search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query })
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GAQL failed (${resp.status}) on [${query.trim().slice(0, 80)}]: ${err.replace(/\s+/g, " ").slice(0, 800)}`);
  }
  const data = await resp.json();
  return data.results || [];
}
__name(auditGAQL, "auditGAQL");
async function ensureAuditTable(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ads_audit_runs (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL, run_at TEXT DEFAULT (datetime('now')),
    overall_score INTEGER, sections_json TEXT, findings_json TEXT
  )`).run();
}
__name(ensureAuditTable, "ensureAuditTable");
async function handleAuditClients(request, env) {
  if (!auditAuthorized(request, env)) return json({ error: "Forbidden" }, 403);
  const rows = await env.DB.prepare(`
    SELECT c.id, c.name FROM sprint_clients c
    JOIN client_services s ON s.client_id = c.id AND s.service = 'gads' AND s.status = 'active'
    WHERE c.archived = 0 AND c.google_ads_customer_id IS NOT NULL AND c.google_ads_customer_id != ''
    ORDER BY c.name
  `).all();
  return json(rows.results || []);
}
__name(handleAuditClients, "handleAuditClients");
async function handleAuditLatest(request, env, clientId) {
  if (!auditAuthorized(request, env)) return json({ error: "Forbidden" }, 403);
  await ensureAuditTable(env);
  const row = await env.DB.prepare(
    "SELECT * FROM ads_audit_runs WHERE client_id=? ORDER BY run_at DESC LIMIT 1"
  ).bind(clientId).first();
  if (!row) return json({ error: "No audit runs for this client" }, 404);
  return json({
    run_id: row.id, run_at: row.run_at, overall_score: row.overall_score,
    section_scores: JSON.parse(row.sections_json || "{}"),
    findings: JSON.parse(row.findings_json || "[]"),
    pdf_available: false
  });
}
__name(handleAuditLatest, "handleAuditLatest");
function micros(v) { return Number(v || 0) / 1e6; }
__name(micros, "micros");
function money(v) { return "$" + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
__name(money, "money");
async function handleAuditRun(request, env, clientId) {
  if (!auditAuthorized(request, env)) return json({ error: "Forbidden" }, 403);
  const client = await env.DB.prepare(
    "SELECT id, name, google_ads_customer_id FROM sprint_clients WHERE id=? AND archived=0"
  ).bind(clientId).first();
  if (!client) return json({ error: "Client not found" }, 404);
  if (!client.google_ads_customer_id) return json({ error: "No Google Ads customer ID on file for this client" }, 400);
  const cid = client.google_ads_customer_id;
  try {
    const token = await auditGadsToken(env);
    const [campaigns, terms, keywords, negatives, convActions] = await Promise.all([
      auditGAQL(token, env, cid, `
        SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros,
               metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
               metrics.search_impression_share, metrics.search_budget_lost_impression_share
        FROM campaign WHERE campaign.status = 'ENABLED' AND segments.date DURING LAST_30_DAYS`),
      auditGAQL(token, env, cid, `
        SELECT search_term_view.search_term, campaign.name,
               metrics.cost_micros, metrics.clicks, metrics.conversions
        FROM search_term_view
        WHERE segments.date DURING LAST_30_DAYS AND metrics.clicks > 0
        ORDER BY metrics.cost_micros DESC LIMIT 500`),
      auditGAQL(token, env, cid, `
        SELECT ad_group_criterion.keyword.text, ad_group_criterion.quality_info.quality_score,
               campaign.name, metrics.impressions, metrics.cost_micros, metrics.conversions
        FROM keyword_view
        WHERE ad_group_criterion.status = 'ENABLED' AND campaign.status = 'ENABLED'
          AND segments.date DURING LAST_30_DAYS LIMIT 1000`),
      auditGAQL(token, env, cid, `
        SELECT campaign.id, campaign.name, campaign_criterion.keyword.text
        FROM campaign_criterion
        WHERE campaign_criterion.negative = TRUE AND campaign_criterion.type = 'KEYWORD'
          AND campaign.status = 'ENABLED' LIMIT 2000`),
      auditGAQL(token, env, cid, `
        SELECT conversion_action.name, conversion_action.status, conversion_action.primary_for_goal
        FROM conversion_action WHERE conversion_action.status = 'ENABLED'`)
    ]);
    const findings = [];
    const totalSpend = campaigns.reduce((a, r) => a + micros(r.metrics?.costMicros), 0);
    const totalConv = campaigns.reduce((a, r) => a + Number(r.metrics?.conversions || 0), 0);
    if (!campaigns.length) {
      findings.push({ severity: "critical", title: "No enabled campaigns", evidence: "Zero campaigns with status ENABLED had activity in the last 30 days.", action: "Confirm the account should be running; enable or rebuild campaigns." });
    }
    // --- Spend efficiency (waste) ---
    const wasted = terms.filter((r) => Number(r.metrics?.conversions || 0) === 0 && micros(r.metrics?.costMicros) > 0);
    const wastedSpend = wasted.reduce((a, r) => a + micros(r.metrics?.costMicros), 0);
    const wastePct = totalSpend > 0 ? wastedSpend / totalSpend * 100 : 0;
    let wasteScore = campaigns.length ? Math.max(0, Math.round(100 - wastePct * 1.8)) : 0;
    const topWaste = wasted.slice(0, 5).map((r) => `"${r.searchTermView?.searchTerm}" (${money(micros(r.metrics?.costMicros))})`).join(", ");
    if (wastePct >= 40) {
      findings.push({ severity: "critical", title: `${Math.round(wastePct)}% of spend went to search terms with zero conversions`, evidence: `${money(wastedSpend)} of ${money(totalSpend)} (30 days) on non-converting terms. Top: ${topWaste}`, action: "Add the top wasted terms as negatives and tighten match types." });
    } else if (wastePct >= 20) {
      findings.push({ severity: "warning", title: `${Math.round(wastePct)}% of spend on non-converting search terms`, evidence: `${money(wastedSpend)} of ${money(totalSpend)} over 30 days. Top: ${topWaste}`, action: "Review the search-terms report and add negatives weekly." });
    } else if (campaigns.length) {
      findings.push({ severity: "ok", title: "Spend efficiency is healthy", evidence: `Only ${Math.round(wastePct)}% of 30-day spend (${money(wastedSpend)}) went to zero-conversion search terms.`, action: "Keep the weekly negative-mining cadence." });
    }
    // --- Keyword quality ---
    const qsRows = keywords.filter((r) => r.adGroupCriterion?.qualityInfo?.qualityScore);
    let qualityScore = 50;
    if (qsRows.length) {
      let imp = 0, qsImp = 0, lowQs = 0;
      for (const r of qsRows) {
        const w = Number(r.metrics?.impressions || 0) + 1;
        const qs = Number(r.adGroupCriterion.qualityInfo.qualityScore);
        imp += w; qsImp += qs * w;
        if (qs <= 4) lowQs++;
      }
      const avgQs = qsImp / imp;
      qualityScore = Math.round(avgQs / 10 * 100);
      if (avgQs < 5) {
        findings.push({ severity: "critical", title: `Average Quality Score is ${avgQs.toFixed(1)}/10`, evidence: `${lowQs} of ${qsRows.length} scored keywords are QS 4 or below (impression-weighted average ${avgQs.toFixed(1)}).`, action: "Rework ad relevance and landing pages for the low-QS ad groups; pause chronic QS 1-3 keywords." });
      } else if (avgQs < 7) {
        findings.push({ severity: "warning", title: `Average Quality Score is ${avgQs.toFixed(1)}/10`, evidence: `${lowQs} keywords at QS ≤ 4 out of ${qsRows.length} scored.`, action: "Tighten ad-group themes and align RSA headlines to keyword intent." });
      } else {
        findings.push({ severity: "ok", title: `Quality Score healthy (avg ${avgQs.toFixed(1)}/10)`, evidence: `${qsRows.length} scored keywords, ${lowQs} at QS ≤ 4.`, action: "No action needed." });
      }
    } else if (campaigns.length) {
      findings.push({ severity: "warning", title: "No Quality Score data available", evidence: "No enabled keywords returned a Quality Score (low volume or non-search campaigns).", action: "If this account is search-driven, check keyword volume; QS needs sufficient impressions." });
    }
    // --- Negatives ---
    const negByCampaign = {};
    for (const r of negatives) negByCampaign[r.campaign?.name || "?"] = (negByCampaign[r.campaign?.name || "?"] || 0) + 1;
    const searchCampaigns = campaigns.filter((r) => Number(r.metrics?.impressions || 0) > 0);
    const bare = searchCampaigns.filter((r) => !negByCampaign[r.campaign?.name]);
    let negScore = searchCampaigns.length ? Math.round(100 * (1 - bare.length / searchCampaigns.length)) : 0;
    if (negatives.length === 0 && searchCampaigns.length) {
      negScore = 0;
      findings.push({ severity: "critical", title: "No negative keywords in any active campaign", evidence: `0 campaign-level negatives across ${searchCampaigns.length} active campaigns.`, action: "Mine the 30-day search-terms report and build a negative list immediately." });
    } else if (bare.length) {
      findings.push({ severity: "warning", title: `${bare.length} active campaign(s) have zero negatives`, evidence: bare.map((r) => r.campaign?.name).slice(0, 5).join(", "), action: "Add campaign-level negatives or attach a shared negative list." });
    } else if (searchCampaigns.length) {
      findings.push({ severity: "ok", title: "Negative coverage in place", evidence: `${negatives.length} campaign-level negatives across ${searchCampaigns.length} campaigns.`, action: "Keep mining search terms weekly." });
    }
    // --- Conversion tracking ---
    let convScore = 0;
    if (convActions.length === 0) {
      findings.push({ severity: "critical", title: "No enabled conversion actions", evidence: "conversion_action query returned zero enabled actions.", action: "Set up conversion tracking before optimizing anything else." });
    } else if (totalConv === 0 && totalSpend > 0) {
      convScore = 40;
      findings.push({ severity: "critical", title: "Conversion actions exist but recorded ZERO conversions in 30 days", evidence: `${convActions.length} enabled action(s), ${money(totalSpend)} spend, 0 conversions — tracking may be broken (green-but-zero).`, action: "Fire a test conversion and verify the tag/GA4 import is still recording." });
    } else {
      convScore = 100;
      findings.push({ severity: "ok", title: "Conversion tracking recording", evidence: `${convActions.length} enabled action(s); ${totalConv.toFixed(1)} conversions in the last 30 days.`, action: "No action needed." });
    }
    // --- Budget pacing ---
    let paceScore = 100;
    const limited = campaigns.filter((r) => Number(r.metrics?.searchBudgetLostImpressionShare || 0) > 0.1);
    if (campaigns.length) {
      const avgLost = campaigns.reduce((a, r) => a + Number(r.metrics?.searchBudgetLostImpressionShare || 0), 0) / campaigns.length;
      paceScore = Math.max(0, Math.round(100 - avgLost * 200));
      if (limited.length) {
        findings.push({ severity: "warning", title: `${limited.length} campaign(s) losing impression share to budget`, evidence: limited.map((r) => `${r.campaign?.name} (${Math.round(Number(r.metrics.searchBudgetLostImpressionShare) * 100)}% lost)`).slice(0, 5).join(", "), action: "Raise budget on winners or rebalance from underperformers." });
      } else {
        findings.push({ severity: "ok", title: "No campaigns budget-limited", evidence: "Search budget lost impression share ≤ 10% on all active campaigns.", action: "No action needed." });
      }
    } else { paceScore = 0; }
    const section_scores = {
      waste: wasteScore, quality: qualityScore, negatives: negScore,
      conversions: convScore, pacing: paceScore
    };
    const overall = Math.round(
      wasteScore * 0.3 + qualityScore * 0.25 + negScore * 0.2 + convScore * 0.15 + paceScore * 0.1
    );
    await ensureAuditTable(env);
    const runId = genId("audit");
    await env.DB.prepare(
      "INSERT INTO ads_audit_runs (id, client_id, overall_score, sections_json, findings_json) VALUES (?,?,?,?,?)"
    ).bind(runId, clientId, overall, JSON.stringify(section_scores), JSON.stringify(findings)).run();
    try {
      const artifactUrl = `https://sprint.engageengine.cc/audit/${runId}`;
      // Outcome loop: the audit's top issue becomes a scored prediction, due for review in 30 days.
      const topIssue = findings.find((f) => f.severity === "critical") || findings.find((f) => f.severity === "warning") || null;
      const expected = topIssue ? `If "${topIssue.action}" is done, expect score above ${overall} and "${topIssue.title}" resolved on the next audit.` : null;
      await env.DB.prepare(
        "INSERT INTO client_activity (client_id, client_name, tool, kind, score, summary, artifact_url, expected_outcome, review_at) VALUES (?,?,?,?,?,?,?,?, CASE WHEN ?8 IS NULL THEN NULL ELSE date('now','+30 days') END)"
      ).bind(clientId, client.name || null, "ads-audit", "audit", overall, `Ads audit — score ${overall}/100`, artifactUrl, expected).run();
    } catch (e) {}
    await env.DB.prepare("UPDATE sprint_clients SET last_audit_date=date('now') WHERE id=?").bind(clientId).run();
    return json({ run_id: runId, overall_score: overall, section_scores, findings, pdf_available: false });
  } catch (err) {
    return json({ error: `Audit failed: ${err.message}` }, 502);
  }
}
__name(handleAuditRun, "handleAuditRun");
function auditSeverityColor(sev) {
  if (sev === "critical") return "#DC2626";
  if (sev === "warning") return "#D97706";
  return "#16A34A";
}
__name(auditSeverityColor, "auditSeverityColor");
function escAudit(s) {
  if (s === null || s === undefined) return "";
  return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;");
}
__name(escAudit, "escAudit");
async function handleAuditViewPage(request, env, runId) {
  await ensureAuditTable(env);
  const row = await env.DB.prepare(
    "SELECT r.*, c.name AS client_name FROM ads_audit_runs r LEFT JOIN sprint_clients c ON c.id = r.client_id WHERE r.id=?"
  ).bind(runId).first();
  if (!row) {
    return new Response("<!DOCTYPE html><html><body style=\"font-family:sans-serif;padding:40px;color:#1C1917\"><h2>Audit not found</h2><p>No ads-audit run matches this id.</p></body></html>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  let sections = {};
  let findings = [];
  try { sections = JSON.parse(row.sections_json || "{}"); } catch {}
  try { findings = JSON.parse(row.findings_json || "[]"); } catch {}
  const sectionRows = Object.entries(sections).map(([k, v]) => `
    <div class="a-metric">
      <div class="a-metric-label">${escAudit(k)}</div>
      <div class="a-metric-score">${escAudit(v)}<span>/100</span></div>
    </div>`).join("");
  const findingRows = findings.map((f) => `
    <div class="a-finding" style="border-left-color:${auditSeverityColor(f.severity)}">
      <div class="a-finding-title">${escAudit(f.title)}</div>
      <div class="a-finding-sev" style="color:${auditSeverityColor(f.severity)}">${escAudit((f.severity || "").toUpperCase())}</div>
      <div class="a-finding-evidence">${escAudit(f.evidence)}</div>
      <div class="a-finding-action"><strong>Action:</strong> ${escAudit(f.action)}</div>
    </div>`).join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ads Audit — ${escAudit(row.client_name || row.client_id)}</title>
<style>
:root{--bg:#F5F3EE;--surface:#FFFFFF;--border:#E2DED5;--text:#1C1917;--text-dim:#78716C;--accent:#CF6344}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"DM Sans",sans-serif;background:var(--bg);color:var(--text);padding:32px}
.wrap{max-width:900px;margin:0 auto}
h1{font-size:22px;margin-bottom:4px}
.sub{color:var(--text-dim);font-size:13px;margin-bottom:24px}
.overall{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:24px;display:flex;align-items:center;gap:20px}
.overall .score{font-size:48px;font-weight:700;color:var(--accent)}
.overall .score span{font-size:20px;color:var(--text-dim);font-weight:500}
.a-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:28px}
.a-metric{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px}
.a-metric-label{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-dim);margin-bottom:6px}
.a-metric-score{font-size:22px;font-weight:700}
.a-metric-score span{font-size:12px;color:var(--text-dim);font-weight:500}
.a-finding{background:var(--surface);border:1px solid var(--border);border-left:4px solid;border-radius:10px;padding:14px 16px;margin-bottom:12px}
.a-finding-title{font-weight:700;font-size:14px;margin-bottom:2px}
.a-finding-sev{font-size:11px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px}
.a-finding-evidence{font-size:13px;color:var(--text-dim);margin-bottom:6px;line-height:1.5}
.a-finding-action{font-size:13px;line-height:1.5}
.back{display:inline-block;margin-bottom:16px;color:var(--accent);text-decoration:none;font-size:13px;font-weight:600}
</style>
</head>
<body>
<div class="wrap">
<a class="back" href="/">&larr; Back to Sprint Tracker</a>
<h1>Ads Audit — ${escAudit(row.client_name || row.client_id)}</h1>
<div class="sub">Run ${escAudit(row.id)} &middot; ${escAudit(row.run_at)}</div>
<div class="overall"><div class="score">${escAudit(row.overall_score)}<span>/100 overall</span></div></div>
<div class="a-metrics">${sectionRows}</div>
<div>${findingRows || '<p style="color:var(--text-dim)">No findings recorded.</p>'}</div>
</div>
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
__name(handleAuditViewPage, "handleAuditViewPage");
async function handleRoster(request, env) {
  const sec = request.headers.get("X-Internal-Secret");
  const ok = !!sec && ((env.ROSTER_READ_SECRET && sec === env.ROSTER_READ_SECRET) || (env.INTERNAL_AUDIT_SECRET && sec === env.INTERNAL_AUDIT_SECRET));
  if (!ok) return json({ error: "Forbidden" }, 403);
  const clients = await env.DB.prepare(
    "SELECT id, name, domain, google_ads_customer_id FROM sprint_clients WHERE archived = 0 ORDER BY name"
  ).all();
  const svc = await env.DB.prepare(
    "SELECT client_id, service, status FROM client_services WHERE status = 'active'"
  ).all();
  const svcByClient = {};
  for (const s of svc.results || []) (svcByClient[s.client_id] ||= []).push(s.service);
  function normDomain(d) {
    if (!d) return null;
    return String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim() || null;
  }
  const roster = (clients.results || []).map((c) => ({
    id: c.id,
    name: c.name,
    domain: normDomain(c.domain),
    google_ads_customer_id: c.google_ads_customer_id || null,
    services: svcByClient[c.id] || []
  }));
  return json({ count: roster.length, clients: roster }, 200, {
    "Cache-Control": "public, max-age=300"
  });
}
__name(handleRoster, "handleRoster");
function normActivityDomain(d) {
  if (!d) return null;
  return String(d).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim() || null;
}
__name(normActivityDomain, "normActivityDomain");
async function handleActivityIngest(request, env) {
  const sec = request.headers.get("X-Internal-Secret");
  const ok = !!sec && ((env.INTERNAL_AUDIT_SECRET && sec === env.INTERNAL_AUDIT_SECRET) || (env.ROSTER_READ_SECRET && sec === env.ROSTER_READ_SECRET));
  if (!ok) return json({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  const tool = body.tool && String(body.tool).trim();
  const kind = body.kind && String(body.kind).trim();
  if (!tool || !kind) return json({ error: "tool and kind are required" }, 400);
  let clientId = body.client_id != null ? String(body.client_id) : null;
  let clientName = body.client_name != null ? String(body.client_name) : null;
  let resolved = false;
  if (clientId) {
    const row = await env.DB.prepare("SELECT id, name FROM sprint_clients WHERE id = ?1 LIMIT 1").bind(clientId).first().catch(() => null);
    if (row) { clientName = row.name; resolved = true; }
  } else {
    const nd = normActivityDomain(body.domain);
    const candidates = [nd, body.domain, body.client_name].filter((v) => v != null && String(v).length > 0);
    for (const cand of candidates) {
      const row = await env.DB.prepare("SELECT id, name FROM sprint_clients WHERE domain = ?1 OR name = ?1 LIMIT 1").bind(String(cand)).first().catch(() => null);
      if (row) { clientId = String(row.id); clientName = row.name; resolved = true; break; }
    }
    if (!resolved && !clientName) clientName = nd || (body.domain ? String(body.domain) : null);
  }
  const score = body.score != null && body.score !== "" ? Number(body.score) : null;
  const summary = body.summary != null ? String(body.summary) : null;
  const artifactUrl = body.artifact_url != null ? String(body.artifact_url) : null;
  // Outcome loop: an activity may carry a prediction (expected_outcome) and a review date.
  // review_days defaults to 30 whenever a prediction is supplied.
  const expectedOutcome = body.expected_outcome != null && String(body.expected_outcome).trim() !== "" ? String(body.expected_outcome).trim() : null;
  let reviewDays = body.review_days != null && body.review_days !== "" ? Math.max(1, Math.round(Number(body.review_days))) : null;
  if (!reviewDays && expectedOutcome) reviewDays = 30;
  const ins = await env.DB.prepare(
    `INSERT INTO client_activity (client_id, client_name, tool, kind, score, summary, artifact_url, expected_outcome, review_at)
     VALUES (?,?,?,?,?,?,?,?, CASE WHEN ?9 IS NULL THEN NULL ELSE date('now', '+' || ?9 || ' days') END)`
  ).bind(clientId, clientName, tool, kind, score, summary, artifactUrl, expectedOutcome, reviewDays).run();
  // Routine auto-completion: if a routine step is tagged with this tool, mark the
  // client's open instances of that step Complete (best-effort; exact tool match).
  let autoCompleted = 0;
  if (clientId && tool) {
    try {
      const tks = (await env.DB.prepare("SELECT id FROM sprint_template_tasks WHERE tool_key!='' AND LOWER(tool_key)=LOWER(?)").bind(tool).all()).results;
      if (tks.length) {
        const ids = tks.map((r) => r.id);
        const ph = ids.map(() => "?").join(",");
        const upd = await env.DB.prepare(
          `UPDATE sprint_tasks SET status='Complete', completed_date=date('now'), updated_at=date('now') WHERE client_id=? AND status!='Complete' AND task_id IN (${ph})`
        ).bind(clientId, ...ids).run();
        autoCompleted = upd.meta?.changes || 0;
      }
    } catch (e) {
    }
  }
  return json({ ok: true, id: ins.meta?.last_row_id ?? null, resolved, auto_completed: autoCompleted });
}
__name(handleActivityIngest, "handleActivityIngest");
async function handleClientActivity(request, env, clientId) {
  const rows = await env.DB.prepare(
    "SELECT id, client_id, client_name, tool, kind, score, summary, artifact_url, created_at, expected_outcome, review_at, outcome_status, outcome_note FROM client_activity WHERE client_id = ?1 ORDER BY created_at DESC LIMIT 100"
  ).bind(String(clientId)).all();
  return json({ activity: rows.results || [] });
}
__name(handleClientActivity, "handleClientActivity");
async function handleActivityFeed(request, env) {
  const url = new URL(request.url);
  const tool = url.searchParams.get("tool");
  const clientId = url.searchParams.get("client_id");
  const conditions = [];
  const binds = [];
  if (tool) { conditions.push("a.tool = ?"); binds.push(tool); }
  if (clientId) { conditions.push("a.client_id = ?"); binds.push(clientId); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const stmt = `
    SELECT a.id, a.client_id, a.client_name, a.tool, a.kind, a.score, a.summary, a.artifact_url, a.created_at,
      a.expected_outcome, a.review_at, a.outcome_status, a.outcome_note,
      COALESCE(a.client_name, c.name) as display_name
    FROM client_activity a
    LEFT JOIN sprint_clients c ON c.id = a.client_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT 200
  `;
  const rows = await env.DB.prepare(stmt).bind(...binds).all();
  const activity = (rows.results || []).map((r) => ({ ...r, client_name: r.display_name || r.client_name || null }));
  return json({ activity });
}
__name(handleActivityFeed, "handleActivityFeed");
async function handleAgentsFeed(request, env) {
  const res = await env.DB.prepare(
    "SELECT run_id, title, repos, state, detail, session_url, pr_urls, created_at, last_event_at FROM agent_launches ORDER BY COALESCE(last_event_at, created_at) DESC LIMIT 100"
  ).all().catch(() => ({ results: [] }));
  const now = Date.now();
  const QUIET_MS = 12 * 60 * 1000;
  const agents = (res.results || []).map((r) => {
    let view = r.state;
    if (r.state === "active" && r.last_event_at && now - r.last_event_at > QUIET_MS) view = "quiet";
    return Object.assign({}, r, { view_state: view });
  });
  return json({ agents, now });
}
__name(handleAgentsFeed, "handleAgentsFeed");
async function handleActivityDue(request, env) {
  // The review queue: activities whose review date has arrived and that have no recorded outcome yet.
  const rows = await env.DB.prepare(`
    SELECT a.id, a.client_id, a.client_name, a.tool, a.kind, a.score, a.summary, a.artifact_url, a.created_at,
      a.expected_outcome, a.review_at,
      COALESCE(a.client_name, c.name) as display_name
    FROM client_activity a
    LEFT JOIN sprint_clients c ON c.id = a.client_id
    WHERE a.review_at IS NOT NULL AND a.review_at <= date('now') AND a.outcome_status IS NULL
    ORDER BY a.review_at ASC
    LIMIT 100
  `).all();
  const due = (rows.results || []).map((r) => ({ ...r, client_name: r.display_name || r.client_name || null }));
  // Scoreboard: lifetime hit rate of everything already reviewed.
  const tally = await env.DB.prepare(
    "SELECT outcome_status, COUNT(*) as n FROM client_activity WHERE outcome_status IS NOT NULL GROUP BY outcome_status"
  ).all();
  const scoreboard = {};
  for (const t of tally.results || []) scoreboard[t.outcome_status] = t.n;
  return json({ due, scoreboard });
}
__name(handleActivityDue, "handleActivityDue");
async function handleActivityOutcome(request, env, activityId) {
  const body = await request.json().catch(() => ({}));
  const status = body.status && String(body.status).trim();
  const allowed = ["confirmed", "missed", "partial", "na"];
  if (!status || !allowed.includes(status)) return json({ error: "status must be one of: " + allowed.join(", ") }, 400);
  const note = body.note != null && String(body.note).trim() !== "" ? String(body.note).trim() : null;
  const res = await env.DB.prepare(
    "UPDATE client_activity SET outcome_status = ?1, outcome_note = ?2, outcome_recorded_at = datetime('now') WHERE id = ?3"
  ).bind(status, note, Number(activityId)).run();
  if (!res.meta || res.meta.changes === 0) return json({ error: "Activity not found" }, 404);
  return json({ ok: true });
}
__name(handleActivityOutcome, "handleActivityOutcome");
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

