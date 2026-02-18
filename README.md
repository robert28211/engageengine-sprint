# EngageEngine Sprint Tracker

Cloudflare Worker + D1 sprint tracker for EngageEngine's client work management.

## Architecture
- **Cloudflare Worker** serves both API and frontend UI
- **D1 Database** stores clients, jobs, tasks, and team data
- Single-file deployment — no build step needed

## Setup

1. Install dependencies: `npm install`
2. Configure `wrangler.toml` with your D1 database ID
3. Deploy: `npm run deploy`
4. Add custom domain `sprint.engageengine.cc` in Cloudflare dashboard

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Dashboard stats, clients, team |
| GET | `/api/clients/:id` | Client detail with jobs + tasks |
| GET | `/api/team/:name` | Tasks assigned to team member |
| POST | `/api/tasks/:id/complete` | Mark task complete |
| POST | `/api/tasks/:id/reopen` | Reopen a task |
| POST | `/api/jobs` | Create new job |
| POST | `/api/tasks` | Create new task |

## D1 Tables

- `sprint_clients` — 26 clients
- `sprint_jobs` — 72 jobs (Active/Complete)
- `sprint_tasks` — 217 tasks
- `sprint_team` — 4 team members (Robbie, Aaron, Aiden, Burt)

## Development

```bash
npm run dev    # Local dev with wrangler
npm run deploy # Deploy to Cloudflare
```
