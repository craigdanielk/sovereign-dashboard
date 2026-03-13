# Sovereign Dashboard

SOVEREIGN three-panel command centre -- real-time system overview backed by RAG.

## Tech Stack

- **Framework**: Next.js 15.1 (App Router)
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS 4
- **Deployment**: Vercel (auto-deploy on push)
- **Backend data**: RAG MCP server via JSON-RPC over streamable-http (`lib/rag.ts`)

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
  api/
    army/route.ts   -- GET /api/army   (agent/node-director data from RAG)
    system/route.ts -- GET /api/system (SDM health, gaps, infra status)
    pipeline/route.ts -- GET /api/pipeline (capabilities, known gaps, RECON)
lib/
  rag.ts            -- RAG MCP client: init session, call tools, search entities
```

## Vercel

- **Project ID**: `prj_S4YKhUdmgChDueAgKjTWiCSPr3Wf`
- **Project name**: `sovereign-dashboard`
- **Org/Team**: `team_n1rMtzqnARnlXX4LEA8eYlKR`

## Environment Variables

Required in Vercel (and locally in `.env.local`):

- `RAG_MCP_URL` -- RAG MCP server base URL (defaults to GCP Cloud Run endpoint)
- `RAG_AUTH_TOKEN` -- Bearer token for RAG MCP authentication

## Architecture Notes

- Single-page dashboard with a sticky header and three glass-panel columns: Node Directors (agents), System Health, and Pipeline.
- Data is fetched client-side from three Next.js API routes (`/api/army`, `/api/system`, `/api/pipeline`).
- API routes proxy to the RAG MCP server using JSON-RPC 2.0 with session initialization per request.
- Auto-refresh every 60 seconds; manual "Sync" button in header.
- All styling uses CSS custom properties for colors, with frosted-glass and fade-up animations.

## Gotchas

- The RAG client in `lib/rag.ts` creates a new MCP session on every API call (init + tool call = 2 round-trips). This is fine for low traffic but would need session caching for scale.
- SSE responses from RAG are parsed manually by scanning for `data:` lines -- not a full SSE parser.
- The `AbortSignal.timeout(15_000)` on RAG calls means the API routes will fail if RAG takes longer than 15 seconds.
- Tailwind 4 is used (not v3); PostCSS config is in `postcss.config.mjs`.
- No tests exist yet.

## Current Status

- Dashboard is live and functional on Vercel.
- Four commits total; most recent was a UI redesign to Apple-inspired dark frosted-glass theme.

## Next Steps

- Add error boundary / fallback UI for panel-level failures.
- Consider server-side data fetching (RSC) to reduce client-side loading states.
- Add tests for API routes and RAG client.
