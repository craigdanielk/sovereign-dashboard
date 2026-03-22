# Sovereign Dashboard

SOVEREIGN four-panel operations cockpit -- live execution logs, BRIEF queue, agent dispatch, and system health backed by Supabase.

## Tech Stack

- **Framework**: Next.js 15.1 (App Router)
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS 4
- **Deployment**: Vercel (auto-deploy on push)
- **Backend data**: Supabase (direct queries via `@supabase/supabase-js`)

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server locally |
| `npm run lint` | Run ESLint |

## Project Structure

```
app/
  layout.tsx        -- Root layout (dark theme, global CSS)
  page.tsx          -- Main dashboard (four-panel: execution log, BRIEF queue, agent dispatch, system health)
  globals.css       -- Tailwind + custom CSS variables, glass/animation styles
  demos/page.tsx    -- Demo library with OUTREACH gate and human review
  jobs/page.tsx     -- Completed briefs listing
  costs/page.tsx    -- Cost breakdown by agent/client
  graph/page.tsx    -- Agent/artifact graph visualization (d3)
  templates/page.tsx -- Workflow templates from briefs data
  telemetry/page.tsx -- System health telemetry dashboard
  components/
    NavBar.tsx      -- Navigation bar
    ExpandableText.tsx -- Collapsible text component
    StaleBanner.tsx -- Amber banner for stale cached data
  api/
    execution-log/route.ts -- GET /api/execution-log (live execution_log stream + agent activity summary)
    briefs/route.ts -- GET /api/briefs (all briefs with status/priority)
    army/route.ts   -- GET /api/army   (artifacts grouped by agent_name)
    system/route.ts -- GET /api/system (briefs queue counts: QUEUED/CLAIMED/COMPLETED/FAILED)
    pipeline/route.ts -- GET /api/pipeline (recent artifacts, pending reviews)
    demos/route.ts  -- GET /api/demos  (artifacts where artifact_type='demo')
    jobs/route.ts   -- GET /api/jobs   (briefs where status='COMPLETED')
    costs/route.ts  -- GET /api/costs  (cost_log aggregated by agent/client/day)
    telemetry/route.ts -- GET /api/telemetry (session retrospectives + cost analysis)
    recon/route.ts  -- GET /api/recon  (queue depth, signals from recent artifacts)
    review/route.ts -- GET/POST /api/review (needs-review queue, mark as reviewed)
    graph/route.ts  -- GET /api/graph  (agent/type graph from artifacts)
    templates/route.ts -- GET /api/templates (briefs as pseudo-templates)
    login/route.ts  -- POST /api/login (dashboard auth)
lib/
  supabase.ts       -- Supabase client (uses NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
  cache.ts          -- File-based cache with stale fallback for API routes
  rag.ts            -- [DEPRECATED] RAG MCP client — no longer used by any route
  dedup.ts          -- [DEPRECATED] RAG dedup helper — no longer used
```

## Vercel

- **Project ID**: `prj_S4YKhUdmgChDueAgKjTWiCSPr3Wf`
- **Project name**: `sovereign-dashboard`
- **Org/Team**: `team_n1rMtzqnARnlXX4LEA8eYlKR`

## Environment Variables

Required in Vercel (and locally in `.env.local`):

- `NEXT_PUBLIC_SUPABASE_URL` -- Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- Supabase anon/public key (read-only via RLS)
- `DASHBOARD_PASSWORD` -- Password for dashboard access gate

No longer needed:
- `RAG_MCP_URL` -- removed (was RAG MCP server base URL)
- `RAG_AUTH_TOKEN` -- removed (was Bearer token for RAG)

## Supabase Tables (project: wwimngjmnuuitowujnif)

**execution_log**: id, created_at, session_id, brief_id, agent, step_number, operation, trigger, tool_or_service, input_summary, output_summary, expected_outcome, actual_outcome, gap, duration_ms, cost_usd, tokens_used, model, error_type, error_message, recovery_action, metadata
**briefs**: id, name, priority, status, triggered_by, blocked_by, missing_skills, created_at, claimed_at, completed_at, claimed_by, failure_reason, summary, payload, business_value, time_criticality, system_leverage, job_size, wsjf_score
**artifacts**: id, name, agent_name, artifact_type, status, verified_by_human, summary, vercel_url, created_at, updated_at

## Architecture Notes

- Main dashboard is a four-panel 2x2 grid: Live Execution Log, BRIEF Queue, Agent Dispatch, System Health.
- Live execution log shows real-time tool calls from execution_log table (903+ rows).
- BRIEF queue shows status counts (QUEUED/CLAIMED/COMPLETED/FAILED/SUPERSEDED/PENDING) and active/recent lists.
- Agent dispatch shows per-agent ops, sessions, errors, and associated BRIEFs.
- System health shows error rate, throughput (ops/hr), stale claim detection (>30min), and recent failures.
- Data is fetched client-side from Next.js API routes that query Supabase directly.
- All API routes use `@supabase/supabase-js` with the anon key -- RLS handles permissions.
- Main dashboard polls every 15 seconds for near-realtime updates. Manual "Sync" button in header.
- All styling uses CSS custom properties for colors, with frosted-glass and fade-up animations.

## Gotchas

- The pre-existing `npm run build` has a static page generation error (`<Html> should not be imported outside of pages/_document`) — this is unrelated to Supabase migration and was present before.
- TypeScript compilation (`tsc --noEmit`) passes cleanly.
- Tailwind 4 is used (not v3); PostCSS config is in `postcss.config.mjs`.
- No tests exist yet.
- `lib/rag.ts` and `lib/dedup.ts` are still in the repo but unused — safe to delete.

## Current Status

- Dashboard rebuilt and live on Vercel (BRIEF 403).
- Main page shows four panels: execution log stream, BRIEF queue, agent dispatch, system health.
- /api/execution-log queries execution_log table with computed agent activity summaries.
- Polls every 15s for near-realtime updates.
- Additional pages: /telemetry, /costs, /demos, /jobs, /graph, /templates.

## Next Steps

- Remove deprecated lib/rag.ts and lib/dedup.ts files.
- Fix pre-existing build error with static page generation (only affects local `npm run build`, Vercel deploys fine).
- Add Supabase realtime subscription for true live streaming (replace polling).
- Add error boundary / fallback UI for panel-level failures.
- Add tests for API routes.
