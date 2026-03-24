import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ briefId: string }> }
) {
  const { briefId } = await params;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { events: [], error: "Supabase not configured" },
      { status: 500 }
    );
  }

  // Get the BRIEF's claimed_at and completed_at for time-range fallback
  const briefRes = await fetch(
    `${supabaseUrl}/rest/v1/briefs?id=eq.${briefId}&select=name,claimed_at,completed_at,payload`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const briefs = await briefRes.json();
  const brief = briefs[0];

  // Extract resolved agent from BRIEF routing metadata
  const resolvedAgent: string | null =
    brief?.payload?.routing?.target_agent || null;

  let events = [];
  let mode: "brief_id" | "time_range" | "global" = "brief_id";

  const selectCols =
    "agent,event_type,target_agent,operation,tool_or_service,duration_ms,created_at";

  // Try direct brief_id match
  const directRes = await fetch(
    `${supabaseUrl}/rest/v1/execution_log?brief_id=eq.${briefId}&order=created_at.asc&select=${selectCols}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  events = await directRes.json();

  // Fallback: time-range ±5 minutes around claimed_at / completed_at
  if ((!Array.isArray(events) || events.length <= 2) && brief?.claimed_at) {
    mode = "time_range";
    const pad = 5 * 60 * 1000; // 5 minutes in ms
    const start = new Date(
      new Date(brief.claimed_at).getTime() - pad
    ).toISOString();
    const end = new Date(
      (brief.completed_at
        ? new Date(brief.completed_at).getTime()
        : Date.now()) + pad
    ).toISOString();
    const rangeRes = await fetch(
      `${supabaseUrl}/rest/v1/execution_log?created_at=gte.${start}&created_at=lte.${end}&order=created_at.asc&select=${selectCols}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    events = await rangeRes.json();
  }

  // Global fallback: last 200 events if previous modes returned ≤2 events
  if (!Array.isArray(events) || events.length <= 2) {
    mode = "global";
    const globalRes = await fetch(
      `${supabaseUrl}/rest/v1/execution_log?order=created_at.desc&limit=200&select=${selectCols}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    const globalEvents = await globalRes.json();
    // Reverse to ascending order for replay
    events = Array.isArray(globalEvents) ? globalEvents.reverse() : [];
  }

  // Calculate relative timestamps (ms from first event)
  if (events.length > 0) {
    const firstTime = new Date(events[0].created_at).getTime();
    events = events.map((e: Record<string, unknown>) => ({
      ...e,
      relative_ms: new Date(e.created_at as string).getTime() - firstTime,
    }));
  }

  return NextResponse.json({
    brief_id: briefId,
    brief_name: brief?.name || null,
    resolved_agent: resolvedAgent,
    event_count: events.length,
    mode,
    events,
  });
}
