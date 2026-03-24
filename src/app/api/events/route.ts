import { NextResponse } from "next/server";

interface SystemEvent {
  id: number;
  source: string;
  event_type: string;
  brief_id: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface QualityGrade {
  grade: string;
  count: number;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { events: [], quality_grades: [], hook_coverage: [], error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  try {
    // Fetch recent system_events (for EventStream and hook coverage)
    const [eventsRes, gradesRes, wiringRes] = await Promise.all([
      fetch(
        `${url}/rest/v1/system_events?select=id,source,event_type,brief_id,payload,created_at&order=created_at.desc&limit=50`,
        { headers, signal: AbortSignal.timeout(5000) }
      ).catch(() => null),
      // Quality grade distribution
      fetch(
        `${url}/rest/v1/rpc/quality_grade_distribution`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(5000),
        }
      ).catch(() => null),
      // System wiring health view
      fetch(
        `${url}/rest/v1/system_wiring_health?select=*&limit=20`,
        { headers, signal: AbortSignal.timeout(5000) }
      ).catch(() => null),
    ]);

    let events: SystemEvent[] = [];
    let qualityGrades: QualityGrade[] = [];
    let wiringHealth: Record<string, unknown>[] = [];

    if (eventsRes?.ok) {
      const data = await eventsRes.json();
      events = Array.isArray(data) ? data : [];
    }

    if (gradesRes?.ok) {
      const data = await gradesRes.json();
      qualityGrades = Array.isArray(data) ? data : [];
    }

    if (wiringRes?.ok) {
      const data = await wiringRes.json();
      wiringHealth = Array.isArray(data) ? data : [];
    }

    // Compute hook coverage from events
    const hookTypes = new Set(
      events
        .filter((e) => e.event_type === "hook_fired")
        .map((e) => e.source)
    );

    return NextResponse.json(
      {
        events,
        quality_grades: qualityGrades,
        wiring_health: wiringHealth,
        hook_coverage: Array.from(hookTypes),
      },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Events API error:", err);
    return NextResponse.json(
      { events: [], quality_grades: [], wiring_health: [], hook_coverage: [], error: String(err) },
      { status: 500 }
    );
  }
}
