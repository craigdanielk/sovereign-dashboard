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
    `${supabaseUrl}/rest/v1/briefs?id=eq.${briefId}&select=name,claimed_at,completed_at`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const briefs = await briefRes.json();
  const brief = briefs[0];

  let events = [];

  // Try direct brief_id match
  const directRes = await fetch(
    `${supabaseUrl}/rest/v1/execution_log?brief_id=eq.${briefId}&order=created_at.asc&select=agent,event_type,target_agent,operation,tool_or_service,duration_ms,created_at`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  events = await directRes.json();

  // Fallback: time-range between claimed_at and completed_at
  if ((!events || events.length === 0) && brief?.claimed_at) {
    const start = brief.claimed_at;
    const end = brief.completed_at || new Date().toISOString();
    const rangeRes = await fetch(
      `${supabaseUrl}/rest/v1/execution_log?created_at=gte.${start}&created_at=lte.${end}&order=created_at.asc&select=agent,event_type,target_agent,operation,tool_or_service,duration_ms,created_at`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );
    events = await rangeRes.json();
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
    event_count: events.length,
    events,
  });
}
