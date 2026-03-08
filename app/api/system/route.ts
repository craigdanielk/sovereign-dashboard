import { NextResponse } from "next/server";
import { searchEntities, getCheckpoint } from "@/lib/rag";

export const dynamic = "force-dynamic";

interface Gap {
  name: string;
  priority: string;
  description: string;
}

export async function GET() {
  try {
    // Fetch SDM and active jobs in parallel
    const [sdmResult, jobsResult] = await Promise.all([
      searchEntities("System Dependency Map", "system_map", 3),
      getCheckpoint("heartbeat-jobs"),
    ]);

    // Parse SDM gaps from description
    const sdmEntities = (sdmResult as { entities?: Array<{ description: string; last_updated: string | null }> })?.entities ?? [];
    const sdmDesc = sdmEntities[0]?.description ?? "";
    const sdmLastUpdated = sdmEntities[0]?.last_updated ?? null;

    // Extract gap info from SDM description
    const gapCountMatch = sdmDesc.match(/(\d+)\s+gaps?\s+remaining/i) ?? sdmDesc.match(/(\d+)\s+gaps?\s+identified/i);
    const totalGaps = gapCountMatch ? parseInt(gapCountMatch[1]) : 0;

    const p0Match = sdmDesc.match(/(\d+)\s+P0/);
    const p1Match = sdmDesc.match(/(\d+)\s+P1/);
    const p2Match = sdmDesc.match(/(\d+)\s+P2/);
    const p3Match = sdmDesc.match(/(\d+)\s+P3/);

    const gaps: Gap[] = [];
    const gapCounts = {
      P0: p0Match ? parseInt(p0Match[1]) : 0,
      P1: p1Match ? parseInt(p1Match[1]) : 0,
      P2: p2Match ? parseInt(p2Match[1]) : 0,
      P3: p3Match ? parseInt(p3Match[1]) : 0,
    };

    // Generate gap entries from counts
    for (const [priority, count] of Object.entries(gapCounts)) {
      for (let i = 0; i < count; i++) {
        gaps.push({ name: `${priority} Gap ${i + 1}`, priority, description: `From SDM v5` });
      }
    }

    // Parse jobs checkpoint
    const jobsCheckpoint = jobsResult as { status: string; checkpoint?: { current_state?: string } };
    const activeJobs = jobsCheckpoint?.status === "success"
      ? [{ status: "active", details: jobsCheckpoint.checkpoint?.current_state ?? "No details" }]
      : [];

    // Extract version info
    const versionMatch = sdmDesc.match(/v(\d+)/);
    const sdmVersion = versionMatch ? `v${versionMatch[1]}` : "unknown";

    return NextResponse.json({
      sdmVersion,
      totalGaps,
      gapCounts,
      gaps,
      activeJobs,
      sdmLastUpdated,
      coreInfraComplete: sdmDesc.toLowerCase().includes("complete"),
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
