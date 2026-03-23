import HTML_CONTENT from './app.html';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path.startsWith('/api/')) {
        const response = await handleAPI(path, request, env);
        const headers = new Headers(response.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
        return new Response(response.body, { status: response.status, headers });
      }
      return new Response(HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleAPI(path, request, env) {

  // ── Dashboard ──
  if (path === '/api/dashboard') {
    const clients = await env.DB.prepare(`
      SELECT c.id, c.name, c.status, c.has_sprint,
        COUNT(DISTINCT j.id) as active_jobs,
        COUNT(DISTINCT CASE WHEN t.status = 'Not Started' THEN t.id END) as open_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'Complete' THEN t.id END) as done_tasks
      FROM sprint_clients c
      LEFT JOIN sprint_jobs j ON j.client_id = c.id AND j.status = 'Active'
      LEFT JOIN sprint_tasks t ON t.client_id = c.id
      GROUP BY c.id
      ORDER BY active_jobs DESC, c.name
    `).all();
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM sprint_clients WHERE status = 'Active') as active_clients,
        (SELECT COUNT(*) FROM sprint_jobs WHERE status = 'Active') as active_jobs,
        (SELECT COUNT(*) FROM sprint_tasks WHERE status = 'Not Started') as open_tasks,
        (SELECT COUNT(*) FROM sprint_tasks WHERE status = 'Complete') as done_tasks
    `).first();
    const team = await env.DB.prepare(`
      SELECT tm.id, tm.name, tm.role,
        COUNT(DISTINCT t.id) as assigned_tasks
      FROM sprint_team tm
      LEFT JOIN sprint_tasks t ON LOWER(t.assigned_to) = LOWER(tm.name) AND t.status = 'Not Started'
      GROUP BY tm.id
    `).all();
    return json({ clients: clients.results, stats, team: team.results });
  }

  // ── Client detail ──
  if (path.match(/^\/api\/clients\/[^/]+$/) && request.method === 'GET') {
    const clientId = path.split('/')[3];
    const client = await env.DB.prepare('SELECT * FROM sprint_clients WHERE id = ?').bind(clientId).first();
    if (!client) return json({ error: 'Client not found' }, 404);
    const jobs = await env.DB.prepare(`
      SELECT j.*,
        COUNT(DISTINCT CASE WHEN t.status = 'Not Started' THEN t.id END) as open_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'Complete' THEN t.id END) as done_tasks,
        COUNT(DISTINCT t.id) as total_tasks
      FROM sprint_jobs j
      LEFT JOIN sprint_tasks t ON t.job_id = j.id
      WHERE j.client_id = ?
      GROUP BY j.id
      ORDER BY CASE j.status WHEN 'Active' THEN 0 ELSE 1 END, j.name
    `).bind(clientId).all();
    const tasks = await env.DB.prepare(`
      SELECT t.*, j.name as job_name
      FROM sprint_tasks t
      LEFT JOIN sprint_jobs j ON j.id = t.job_id
      WHERE t.client_id = ?
      ORDER BY CASE t.status WHEN 'Not Started' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END, t.due_date
    `).bind(clientId).all();
    return json({ client, jobs: jobs.results, tasks: tasks.results });
  }

  // ── Team detail ──
  if (path.match(/^\/api\/team\/[^/]+$/)) {
    const name = decodeURIComponent(path.split('/')[3]);
    const tasks = await env.DB.prepare(`
      SELECT t.*, c.name as client_name, j.name as job_name
      FROM sprint_tasks t
      LEFT JOIN sprint_clients c ON c.id = t.client_id
      LEFT JOIN sprint_jobs j ON j.id = t.job_id
      WHERE LOWER(t.assigned_to) = LOWER(?) AND t.status = 'Not Started'
      ORDER BY t.due_date, c.name
    `).bind(name).all();
    return json({ name, tasks: tasks.results });
  }

  // ── Task complete/reopen ──
  if (path.match(/^\/api\/tasks\/[^/]+\/complete$/) && request.method === 'POST') {
    const taskId = path.split('/')[3];
    const now = new Date().toISOString().split('T')[0];
    await env.DB.prepare("UPDATE sprint_tasks SET status = 'Complete', completed_date = ? WHERE id = ?").bind(now, taskId).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/tasks\/[^/]+\/reopen$/) && request.method === 'POST') {
    const taskId = path.split('/')[3];
    await env.DB.prepare("UPDATE sprint_tasks SET status = 'Not Started', completed_date = '' WHERE id = ?").bind(taskId).run();
    return json({ success: true });
  }

  // ── Job complete/reopen ──
  if (path.match(/^\/api\/jobs\/[^/]+\/complete$/) && request.method === 'POST') {
    const jobId = path.split('/')[3];
    await env.DB.prepare("UPDATE sprint_jobs SET status = 'Complete' WHERE id = ?").bind(jobId).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/jobs\/[^/]+\/reopen$/) && request.method === 'POST') {
    const jobId = path.split('/')[3];
    await env.DB.prepare("UPDATE sprint_jobs SET status = 'Active' WHERE id = ?").bind(jobId).run();
    return json({ success: true });
  }

  // ── Create job ──
  if (path === '/api/jobs' && request.method === 'POST') {
    const body = await request.json();
    const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    await env.DB.prepare("INSERT INTO sprint_jobs (id, client_id, name, status) VALUES (?, ?, ?, 'Active')").bind(id, body.client_id, body.name).run();
    return json({ success: true, id });
  }

  // ── Create task ──
  if (path === '/api/tasks' && request.method === 'POST') {
    const body = await request.json();
    const id = 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const taskId = 'manual-' + body.job_id + '-' + Date.now();
    await env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, completed_date) VALUES (?, ?, ?, ?, ?, 'Not Started', ?, ?, '')").bind(id, body.job_id, body.client_id, taskId, body.notes, body.assigned_to || '', body.due_date || '').run();
    return json({ success: true, id });
  }

  // ══════════════════════════════════════════════
  // ── Sprint Checklist API ──
  // ══════════════════════════════════════════════

  // GET /api/sprint/:clientId — returns all completed checklist items for a client
  if (path.match(/^\/api\/sprint\/[^/]+$/) && request.method === 'GET') {
    const clientId = path.split('/')[3];
    const rows = await env.DB.prepare(
      'SELECT task_id, completed, completed_by, completed_date FROM sprint_checklist WHERE client_id = ?'
    ).bind(clientId).all();
    return json({ items: rows.results });
  }

  // POST /api/sprint/toggle — toggle a checklist item
  if (path === '/api/sprint/toggle' && request.method === 'POST') {
    const body = await request.json();
    const { client_id, task_id, completed_by } = body;
    if (!client_id || !task_id) return json({ error: 'client_id and task_id required' }, 400);

    // Check if row exists
    const existing = await env.DB.prepare(
      'SELECT id, completed FROM sprint_checklist WHERE client_id = ? AND task_id = ?'
    ).bind(client_id, task_id).first();

    if (existing) {
      const newCompleted = existing.completed ? 0 : 1;
      const now = newCompleted ? new Date().toISOString().split('T')[0] : '';
      const by = newCompleted ? (completed_by || '') : '';
      await env.DB.prepare(
        'UPDATE sprint_checklist SET completed = ?, completed_by = ?, completed_date = ? WHERE id = ?'
      ).bind(newCompleted, by, now, existing.id).run();
      return json({ success: true, completed: newCompleted });
    } else {
      // Insert as completed
      const id = 'chk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString().split('T')[0];
      await env.DB.prepare(
        'INSERT INTO sprint_checklist (id, client_id, task_id, completed, completed_by, completed_date) VALUES (?, ?, ?, 1, ?, ?)'
      ).bind(id, client_id, task_id, completed_by || '', now).run();
      return json({ success: true, completed: 1 });
    }
  }

  // POST /api/sprint/activate — set has_sprint=1 and start_date for a client
  if (path === '/api/sprint/activate' && request.method === 'POST') {
    const body = await request.json();
    const { client_id, start_date } = body;
    if (!client_id) return json({ error: 'client_id required' }, 400);
    const date = start_date || new Date().toISOString().split('T')[0];
    await env.DB.prepare(
      'UPDATE sprint_clients SET has_sprint = 1, start_date = ?, updated_at = ? WHERE id = ?'
    ).bind(date, new Date().toISOString(), client_id).run();
    return json({ success: true });
  }

  // ══════════════════════════════════════════════
  // ── Email Intelligence API ──
  // ══════════════════════════════════════════════

  // POST /api/email-logs — batch ingest from GitHub Action (Bearer auth required)
  if (path === '/api/email-logs' && request.method === 'POST') {
    const token = (request.headers.get('Authorization') || '').replace('Bearer ', '').trim();
    if (!token || token !== env.EMAIL_SCANNER_TOKEN) return json({ error: 'Unauthorized' }, 401);
    const body = await request.json();
    const logs = Array.isArray(body.logs) ? body.logs : [];
    let inserted = 0;
    for (const log of logs) {
      const id = 'email-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      try {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO email_logs (id,message_id,email_type,client_name,subject,sender,received_at,snippet,dismissed)
           VALUES (?,?,?,?,?,?,?,?,0)`
        ).bind(
          id,
          log.message_id || '',
          log.email_type || 'unknown',
          log.client_name || null,
          log.subject || '',
          log.sender || '',
          log.received_at || new Date().toISOString(),
          log.snippet ? log.snippet.substring(0, 300) : null
        ).run();
        inserted++;
      } catch (e) {
        // UNIQUE constraint = duplicate, skip silently
      }
    }
    return json({ inserted });
  }

  // GET /api/email-logs — fetch non-dismissed logs for dashboard
  if (path === '/api/email-logs' && request.method === 'GET') {
    const logs = await env.DB.prepare(
      `SELECT id,message_id,email_type,client_name,subject,sender,received_at,snippet
       FROM email_logs WHERE dismissed=0 ORDER BY received_at DESC LIMIT 200`
    ).all();
    const lastPixel = await env.DB.prepare(
      `SELECT received_at FROM email_logs WHERE email_type='pixel_data' ORDER BY received_at DESC LIMIT 1`
    ).first();
    const pixelStatus = (() => {
      if (!lastPixel) return { status: 'missing', hours_ago: null };
      const diff = (Date.now() - new Date(lastPixel.received_at).getTime()) / 3600000;
      return { status: diff > 25 ? 'missing' : 'ok', hours_ago: Math.round(diff) };
    })();
    return json({ logs: logs.results, pixel_status: pixelStatus });
  }

  // DELETE /api/email-logs/:id — soft delete (dismiss)
  if (path.match(/^\/api\/email-logs\/[^/]+$/) && request.method === 'DELETE') {
    const logId = path.split('/')[3];
    await env.DB.prepare('UPDATE email_logs SET dismissed=1 WHERE id=?').bind(logId).run();
    return json({ success: true });
  }

  return json({ error: 'Not found' }, 404);
}
