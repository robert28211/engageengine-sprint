// EngageEngine Sprint Tracker — Cloudflare Worker + D1

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
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

      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};

async function handleAPI(path, request, env) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (path === '/api/dashboard') {
    const clients = await env.DB.prepare(`
      SELECT c.id, c.name, c.status,
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

  if (path.match(/^\/api\/clients\/[^/]+$/)) {
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

  if (path === '/api/jobs' && request.method === 'POST') {
    const body = await request.json();
    const id = 'job-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    await env.DB.prepare("INSERT INTO sprint_jobs (id, client_id, name, status) VALUES (?, ?, ?, 'Active')").bind(id, body.client_id, body.name).run();
    return json({ success: true, id });
  }

  if (path === '/api/tasks' && request.method === 'POST') {
    const body = await request.json();
    const id = 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const taskId = 'manual-' + body.job_id + '-' + Date.now();
    await env.DB.prepare("INSERT INTO sprint_tasks (id, job_id, client_id, task_id, notes, status, assigned_to, due_date, completed_date) VALUES (?, ?, ?, ?, ?, 'Not Started', ?, ?, '')").bind(id, body.job_id, body.client_id, taskId, body.notes, body.assigned_to || '', body.due_date || '').run();
    return json({ success: true, id });
  }

  return json({ error: 'Not found' }, 404);
}

function getHTML() {
  return [
'<!DOCTYPE html>',
'<html lang="en">',
'<head>',
'<meta charset="UTF-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1.0">',
'<title>EngageEngine Sprint Tracker</title>',
'<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">',
'<style>',
':root{--bg:#0a0a0f;--surface:#12121a;--surface2:#1a1a26;--border:#2a2a3a;--text:#e8e8f0;--text-dim:#8888a0;--accent:#4f8cff;--accent-glow:rgba(79,140,255,0.15);--green:#34d399;--green-bg:rgba(52,211,153,0.1);--amber:#fbbf24;--amber-bg:rgba(251,191,36,0.1);--red:#f87171;--red-bg:rgba(248,113,113,0.1)}',
'*{margin:0;padding:0;box-sizing:border-box}',
'body{font-family:"DM Sans",sans-serif;background:var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased}',
'.header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:100}',
'.header h1{font-size:18px;font-weight:700;letter-spacing:-0.5px}',
'.header h1 span{color:var(--accent)}',
'.header-stats{display:flex;gap:16px;font-size:13px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}',
'.header-stats .sv{color:var(--text);font-weight:500}',
'.nav-back{display:none;align-items:center;gap:8px;color:var(--accent);cursor:pointer;font-size:14px;font-weight:500;padding:6px 0}',
'.nav-back:hover{text-decoration:underline}',
'.container{max-width:1200px;margin:0 auto;padding:24px}',
'.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}',
'.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px}',
'.stat-card .label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-dim);margin-bottom:6px}',
'.stat-card .value{font-size:28px;font-weight:700;font-family:"JetBrains Mono",monospace}',
'.stat-card .value.green{color:var(--green)}.stat-card .value.amber{color:var(--amber)}.stat-card .value.accent{color:var(--accent)}',
'.section-title{font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-dim);margin-bottom:12px;padding-left:2px}',
'.client-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px;margin-bottom:32px}',
'.client-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:space-between}',
'.client-card:hover{border-color:var(--accent);background:var(--accent-glow)}',
'.client-name{font-weight:600;font-size:15px}',
'.client-meta{display:flex;gap:14px;font-size:12px;font-family:"JetBrains Mono",monospace;color:var(--text-dim)}',
'.client-meta .jobs{color:var(--accent)}.client-meta .open{color:var(--amber)}.client-meta .done{color:var(--green)}',
'.team-row{display:flex;gap:10px;margin-bottom:32px;flex-wrap:wrap}',
'.team-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 20px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:12px}',
'.team-card:hover{border-color:var(--accent);background:var(--accent-glow)}',
'.team-avatar{width:36px;height:36px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--accent)}',
'.team-name{font-weight:600;font-size:14px}',
'.team-tasks{font-size:12px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}',
'.detail-header{margin-bottom:24px}',
'.detail-header h2{font-size:24px;font-weight:700;margin-bottom:4px}',
'.detail-header .sub{color:var(--text-dim);font-size:14px}',
'.job-section{margin-bottom:24px}',
'.job-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border:1px solid var(--border);border-radius:8px 8px 0 0;cursor:pointer}',
'.job-header.collapsed{border-radius:8px}',
'.job-title{font-weight:600;font-size:14px}',
'.job-badge{font-size:11px;padding:2px 8px;border-radius:4px;font-family:"JetBrains Mono",monospace}',
'.job-badge.active{background:var(--green-bg);color:var(--green)}.job-badge.complete{background:var(--surface2);color:var(--text-dim)}',
'.task-list{border:1px solid var(--border);border-top:none;border-radius:0 0 8px 8px;overflow:hidden}',
'.task-item{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);font-size:14px;transition:background 0.1s}',
'.task-item:last-child{border-bottom:none}.task-item:hover{background:var(--surface2)}',
'.task-check{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s}',
'.task-check:hover{border-color:var(--green);background:var(--green-bg)}',
'.task-check.done{border-color:var(--green);background:var(--green)}',
'.task-check.done::after{content:"\\2713";color:var(--bg);font-size:12px;font-weight:700}',
'.task-notes{flex:1}.task-notes.completed{text-decoration:line-through;color:var(--text-dim)}',
'.task-assignee{font-size:11px;padding:2px 8px;background:var(--surface2);border-radius:4px;color:var(--text-dim);font-family:"JetBrains Mono",monospace}',
'.task-due{font-size:11px;font-family:"JetBrains Mono",monospace;color:var(--text-dim)}',
'.task-due.overdue{color:var(--red)}.task-due.soon{color:var(--amber)}',
'.add-btn{background:none;border:1px dashed var(--border);color:var(--text-dim);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-family:"DM Sans",sans-serif;transition:all 0.15s;margin-top:8px}',
'.add-btn:hover{border-color:var(--accent);color:var(--accent)}',
'.inline-form{display:none;gap:8px;margin-top:8px;align-items:center}',
'.inline-form.show{display:flex}',
'.inline-form input,.inline-form select{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:8px 12px;border-radius:6px;font-family:"DM Sans",sans-serif;font-size:13px;outline:none}',
'.inline-form input:focus,.inline-form select:focus{border-color:var(--accent)}',
'.inline-form input{flex:1}',
'.inline-form button{background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:"DM Sans",sans-serif;font-weight:600;font-size:13px}',
'.loading{text-align:center;padding:60px;color:var(--text-dim);font-size:14px}',
'.hidden{display:none!important}',
'@media(max-width:768px){.stats-row{grid-template-columns:repeat(2,1fr)}.client-grid{grid-template-columns:1fr}.header-stats{display:none}.container{padding:16px}.team-row{flex-direction:column}}',
'</style>',
'</head>',
'<body>',
'<div class="header">',
'<div>',
'<div class="nav-back" id="navBack" onclick="showDashboard()">&#8592; Back</div>',
'<h1>Engage<span>Engine</span> Sprint</h1>',
'</div>',
'<div class="header-stats" id="headerStats"></div>',
'</div>',
'<div class="container">',
'<div id="dashboard">',
'<div class="stats-row" id="statsRow"></div>',
'<div class="section-title">Team</div>',
'<div class="team-row" id="teamRow"></div>',
'<div class="section-title">Clients</div>',
'<div class="client-grid" id="clientGrid"></div>',
'</div>',
'<div id="detail" class="hidden"></div>',
'<div id="teamDetail" class="hidden"></div>',
'</div>',
'<script>',
'var API="";',
'var dashboardData=null;',
'',
'function esc(s){if(!s)return"";return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}',
'function formatDate(d){if(!d)return"";var p=d.split("-");return p[1]+"/"+p[2]}',
'function daysDiff(a,b){return Math.ceil((new Date(b)-new Date(a))/86400000)}',
'',
'function statCard(label,value,color){',
'  return "<div class=\\"stat-card\\"><div class=\\"label\\">"+label+"</div><div class=\\"value "+color+"\\">"+value+"</div></div>";',
'}',
'',
'function clientCard(c){',
'  return "<div class=\\"client-card\\" onclick=\\"loadClient(\'"+c.id+"\')\\"><div class=\\"client-name\\">"+esc(c.name)+"</div><div class=\\"client-meta\\"><span class=\\"jobs\\">"+c.active_jobs+" jobs</span><span class=\\"open\\">"+c.open_tasks+" open</span><span class=\\"done\\">"+c.done_tasks+" done</span></div></div>";',
'}',
'',
'async function loadDashboard(){',
'  document.getElementById("clientGrid").innerHTML="<div class=\\"loading\\">Loading...</div>";',
'  var res=await fetch(API+"/api/dashboard");',
'  dashboardData=await res.json();',
'  renderDashboard();',
'}',
'',
'function renderDashboard(){',
'  var d=dashboardData;',
'  var clients=d.clients,stats=d.stats,team=d.team;',
'  document.getElementById("headerStats").innerHTML="<div><span class=\\"sv\\">"+stats.active_clients+"</span> clients</div><div><span class=\\"sv\\">"+stats.active_jobs+"</span> jobs</div><div><span class=\\"sv\\">"+stats.open_tasks+"</span> open</div>";',
'  document.getElementById("statsRow").innerHTML=statCard("Active Clients",stats.active_clients,"accent")+statCard("Active Jobs",stats.active_jobs,"")+statCard("Open Tasks",stats.open_tasks,"amber")+statCard("Completed",stats.done_tasks,"green");',
'  var teamHtml="";',
'  for(var i=0;i<team.length;i++){',
'    var t=team[i];',
'    teamHtml+="<div class=\\"team-card\\" onclick=\\"loadTeam(\'"+encodeURIComponent(t.name)+"\')\\"><div class=\\"team-avatar\\">"+t.name.charAt(0).toUpperCase()+"</div><div><div class=\\"team-name\\">"+esc(t.name)+"</div><div class=\\"team-tasks\\">"+t.assigned_tasks+" tasks</div></div></div>";',
'  }',
'  document.getElementById("teamRow").innerHTML=teamHtml;',
'  var active=clients.filter(function(c){return c.active_jobs>0||c.open_tasks>0});',
'  var inactive=clients.filter(function(c){return c.active_jobs===0&&c.open_tasks===0});',
'  var grid="";',
'  for(var i=0;i<active.length;i++) grid+=clientCard(active[i]);',
'  if(inactive.length) grid+="<div class=\\"section-title\\" style=\\"grid-column:1/-1;margin-top:16px\\">No Active Work</div>";',
'  for(var i=0;i<inactive.length;i++) grid+=clientCard(inactive[i]);',
'  document.getElementById("clientGrid").innerHTML=grid;',
'  document.getElementById("dashboard").classList.remove("hidden");',
'  document.getElementById("detail").classList.add("hidden");',
'  document.getElementById("teamDetail").classList.add("hidden");',
'  document.getElementById("navBack").style.display="none";',
'}',
'',
'async function loadClient(id){',
'  document.getElementById("detail").innerHTML="<div class=\\"loading\\">Loading...</div>";',
'  document.getElementById("detail").classList.remove("hidden");',
'  document.getElementById("dashboard").classList.add("hidden");',
'  document.getElementById("navBack").style.display="flex";',
'  var res=await fetch(API+"/api/clients/"+id);',
'  var data=await res.json();',
'  renderClientDetail(data);',
'}',
'',
'function renderClientDetail(data){',
'  var client=data.client,jobs=data.jobs,tasks=data.tasks;',
'  var today=new Date().toISOString().split("T")[0];',
'  var openCount=tasks.filter(function(t){return t.status!=="Complete"}).length;',
'  var html="<div class=\\"detail-header\\"><h2>"+esc(client.name)+"</h2><div class=\\"sub\\">"+jobs.length+" jobs &middot; "+openCount+" open tasks</div></div>";',
'  var activeJobs=jobs.filter(function(j){return j.status==="Active"});',
'  var completeJobs=jobs.filter(function(j){return j.status==="Complete"});',
'  for(var i=0;i<activeJobs.length;i++){',
'    html+=renderJobSection(activeJobs[i],tasks.filter(function(t){return t.job_id===activeJobs[i].id}),client.id,today,false);',
'  }',
'  html+="<button class=\\"add-btn\\" onclick=\\"toggleAddJob(\'"+client.id+"\')\\" >+ Add Job</button>";',
'  html+="<div id=\\"addJobForm-"+client.id+"\\" class=\\"inline-form\\"><input type=\\"text\\" id=\\"newJobName-"+client.id+"\\" placeholder=\\"Job name...\\"><button onclick=\\"createJob(\'"+client.id+"\')\\" >Add</button></div>";',
'  if(completeJobs.length){',
'    html+="<div class=\\"section-title\\" style=\\"margin-top:24px\\">Completed Jobs</div>";',
'    for(var i=0;i<completeJobs.length;i++){',
'      html+=renderJobSection(completeJobs[i],tasks.filter(function(t){return t.job_id===completeJobs[i].id}),client.id,today,true);',
'    }',
'  }',
'  document.getElementById("detail").innerHTML=html;',
'}',
'',
'function renderJobSection(job,tasks,clientId,today,collapsed){',
'  var html="<div class=\\"job-section\\"><div class=\\"job-header"+(collapsed?" collapsed":"")+"\\" onclick=\\"this.classList.toggle(\'collapsed\');this.nextElementSibling.classList.toggle(\'hidden\')\\"><div class=\\"job-title\\">"+esc(job.name)+" <span style=\\"color:var(--text-dim);font-weight:400;font-size:12px\\">"+job.open_tasks+"/"+job.total_tasks+"</span></div><span class=\\"job-badge "+(job.status==="Active"?"active":"complete")+"\\">"+job.status+"</span></div>";',
'  html+="<div class=\\"task-list"+(collapsed?" hidden":"")+"\\""+">";',
'  for(var i=0;i<tasks.length;i++){',
'    var t=tasks[i];',
'    var isDone=t.status==="Complete";',
'    var dueClass="";',
'    if(!isDone&&t.due_date){dueClass=t.due_date<today?"overdue":(daysDiff(today,t.due_date)<=3?"soon":"")}',
'    html+="<div class=\\"task-item\\"><div class=\\"task-check"+(isDone?" done":"")+"\\" onclick=\\"toggleTask(\'"+t.id+"\',"+(!isDone)+",\'"+clientId+"\')\\"></div><div class=\\"task-notes"+(isDone?" completed":"")+"\\">"+esc(t.notes||"Untitled task")+"</div>";',
'    if(t.assigned_to) html+="<span class=\\"task-assignee\\">"+esc(t.assigned_to)+"</span>";',
'    if(t.due_date) html+="<span class=\\"task-due "+dueClass+"\\">"+formatDate(t.due_date)+"</span>";',
'    html+="</div>";',
'  }',
'  html+="<div class=\\"task-item\\" style=\\"padding:6px 16px\\"><button class=\\"add-btn\\" style=\\"margin:0;padding:4px 12px;font-size:12px\\" onclick=\\"toggleAddTask(\'"+job.id+"\')\\" >+ task</button></div>";',
'  html+="<div id=\\"addTaskForm-"+job.id+"\\" class=\\"inline-form\\" style=\\"padding:8px 16px\\"><input type=\\"text\\" id=\\"newTaskNotes-"+job.id+"\\" placeholder=\\"Task description...\\"><select id=\\"newTaskAssign-"+job.id+"\\"><option value=\\"\\">Assign</option><option>Robbie</option><option>Aaron</option><option>Aiden</option><option>Burt</option></select><input type=\\"date\\" id=\\"newTaskDue-"+job.id+"\\" style=\\"width:140px\\"><button onclick=\\"createTask(\'"+job.id+"',\'"+clientId+"\')\\" >Add</button></div>";',
'  html+="</div></div>";',
'  return html;',
'}',
'',
'async function loadTeam(encodedName){',
'  var name=decodeURIComponent(encodedName);',
'  document.getElementById("teamDetail").innerHTML="<div class=\\"loading\\">Loading...</div>";',
'  document.getElementById("teamDetail").classList.remove("hidden");',
'  document.getElementById("dashboard").classList.add("hidden");',
'  document.getElementById("navBack").style.display="flex";',
'  var res=await fetch(API+"/api/team/"+encodedName);',
'  var data=await res.json();',
'  var today=new Date().toISOString().split("T")[0];',
'  var html="<div class=\\"detail-header\\"><h2>"+esc(data.name)+"</h2><div class=\\"sub\\">"+data.tasks.length+" assigned tasks</div></div>";',
'  var byClient={};',
'  for(var i=0;i<data.tasks.length;i++){var t=data.tasks[i];if(!byClient[t.client_name])byClient[t.client_name]=[];byClient[t.client_name].push(t)}',
'  var keys=Object.keys(byClient).sort();',
'  for(var k=0;k<keys.length;k++){',
'    var cn=keys[k];',
'    html+="<div class=\\"section-title\\" style=\\"margin-top:16px\\">"+esc(cn)+"</div>";',
'    html+="<div class=\\"task-list\\" style=\\"border:1px solid var(--border);border-radius:8px;margin-bottom:12px\\">";',
'    for(var i=0;i<byClient[cn].length;i++){',
'      var t=byClient[cn][i];',
'      var dueClass=t.due_date?(t.due_date<today?"overdue":(daysDiff(today,t.due_date)<=3?"soon":"")):"";',
'      html+="<div class=\\"task-item\\"><div class=\\"task-check\\" onclick=\\"toggleTask(\'"+t.id+"',true,null,true,\'"+encodedName+"\')\\" ></div><div class=\\"task-notes\\">"+esc(t.notes||"Untitled")+"</div><span class=\\"task-assignee\\">"+esc(t.job_name||"")+"</span>";',
'      if(t.due_date) html+="<span class=\\"task-due "+dueClass+"\\">"+formatDate(t.due_date)+"</span>";',
'      html+="</div>";',
'    }',
'    html+="</div>";',
'  }',
'  document.getElementById("teamDetail").innerHTML=html;',
'}',
'',
'async function toggleTask(taskId,complete,clientId,isTeamView,teamName){',
'  var ep=complete?"/api/tasks/"+taskId+"/complete":"/api/tasks/"+taskId+"/reopen";',
'  await fetch(API+ep,{method:"POST"});',
'  if(isTeamView&&teamName){loadTeam(teamName)}',
'  else if(clientId){loadClient(clientId)}',
'  fetch(API+"/api/dashboard").then(function(r){return r.json()}).then(function(d){dashboardData=d});',
'}',
'',
'function toggleAddJob(clientId){',
'  var f=document.getElementById("addJobForm-"+clientId);',
'  f.classList.toggle("show");',
'  var inp=document.getElementById("newJobName-"+clientId);',
'  if(inp)inp.focus();',
'}',
'',
'async function createJob(clientId){',
'  var inp=document.getElementById("newJobName-"+clientId);',
'  if(!inp.value.trim())return;',
'  await fetch(API+"/api/jobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:clientId,name:inp.value.trim()})});',
'  loadClient(clientId);',
'}',
'',
'function toggleAddTask(jobId){',
'  var f=document.getElementById("addTaskForm-"+jobId);',
'  f.classList.toggle("show");',
'  var inp=document.getElementById("newTaskNotes-"+jobId);',
'  if(inp)inp.focus();',
'}',
'',
'async function createTask(jobId,clientId){',
'  var notes=document.getElementById("newTaskNotes-"+jobId);',
'  var assign=document.getElementById("newTaskAssign-"+jobId);',
'  var due=document.getElementById("newTaskDue-"+jobId);',
'  if(!notes.value.trim())return;',
'  await fetch(API+"/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job_id:jobId,client_id:clientId,notes:notes.value.trim(),assigned_to:assign.value,due_date:due.value})});',
'  loadClient(clientId);',
'}',
'',
'function showDashboard(){',
'  document.getElementById("dashboard").classList.remove("hidden");',
'  document.getElementById("detail").classList.add("hidden");',
'  document.getElementById("teamDetail").classList.add("hidden");',
'  document.getElementById("navBack").style.display="none";',
'  if(dashboardData)renderDashboard();else loadDashboard();',
'}',
'',
'loadDashboard();',
'</script>',
'</body>',
'</html>'
  ].join('\n');
}
