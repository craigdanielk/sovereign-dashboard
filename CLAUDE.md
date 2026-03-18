# Sovereign Dashboard

SOVEREIGN three-panel command centre -- real-time system overview backed by Supabase.

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
  page.tsx          -- Main dashboard (client component, three-panel grid)
  globals.css       -- Tailwind + custom CSS variables, glass/animation styles
  demos/page.tsx    -- Demo library with OUTREACH gate and human review
  jobs/page.tsx     -- Completed briefs listing
  graph/page.tsx    -- Agent/artifact graph visualization (d3)
  templates/page.tsx -- Workflow templates from briefs data
  components/
    NavBar.tsx      -- Navigation bar
    ExpandableText.tsx -- Collapsible text component
  api/
    army/route.ts   -- GET /api/army   (artifacts grouped by agent_name)
    system/route.ts -- GET /api/system (briefs queue counts: QUEUED/CLAIMED/COMPLETED/FAILED)
    pipeline/route.ts -- GET /api/pipeline (recent artifacts, pending reviews)
    demos/route.ts  -- GET /api/demos  (artifacts where artifact_type='demo')
    jobs/route.ts   -- GET /api/jobs   (briefs where status='COMPLETED')
    recon/route.ts  -- GET /api/recon  (queue depth, signals from recent artifacts)
    review/route.ts -- GET/POST /api/review (needs-review queue, mark as reviewed)
    graph/route.ts  -- GET /api/graph  (agent/type graph from artifacts)
    templates/route.ts -- GET /api/templates (briefs as pseudo-templates)
    login/route.ts  -- POST /api/login (dashboard auth)
lib/
  supabase.ts       -- Supabase client (uses NEXT_PUBLIC_SUPABASE_URL + ANON_KEY)
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

## Supabase Tables

**artifacts**: id, name, agent_name, artifact_type, status, verified_by_human, summary, vercel_url, created_at, updated_at
**briefs**: id, name, priority, status, triggered_by, blocked_by, missing_skills, created_at, claimed_at, completed_at, claimed_by, failure_reason, summary

## Architecture Notes

- Single-page dashboard with a sticky header and three glass-panel columns: Node Directors (agents), System Health, and Pipeline.
- Data is fetched client-side from Next.js API routes that query Supabase directly.
- All API routes use `@supabase/supabase-js` with the anon key — RLS handles permissions.
- `/api/review` POST endpoint allows marking artifacts as human-verified.
- OUTREACH gate on /demos page auto-calculates from verified_by_human demo count (threshold: 5).
- Auto-refresh every 60 seconds; manual "Sync" button in header.
- All styling uses CSS custom properties for colors, with frosted-glass and fade-up animations.

## Gotchas

- The pre-existing `npm run build` has a static page generation error (`<Html> should not be imported outside of pages/_document`) — this is unrelated to Supabase migration and was present before.
- TypeScript compilation (`tsc --noEmit`) passes cleanly.
- Tailwind 4 is used (not v3); PostCSS config is in `postcss.config.mjs`.
- No tests exist yet.
- `lib/rag.ts` and `lib/dedup.ts` are still in the repo but unused — safe to delete.

## Current Status

- Dashboard is live and functional on Vercel.
- All data sources migrated from RAG MCP to Supabase direct queries.
- Human review flow wired up via /api/review endpoint.
- OUTREACH gate widget calculates from verified demo artifacts.

## Next Steps

- Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel env vars.
- Remove deprecated lib/rag.ts and lib/dedup.ts files.
- Fix pre-existing build error with static page generation.
- Add error boundary / fallback UI for panel-level failures.
- Add tests for API routes.
