import { NextResponse } from "next/server";
import { searchEntities, getCheckpoint } from "@/lib/rag";

export const dynamic = "force-dynamic";

interface Capability {
  capability_id: string;
  label: string;
  owned_by: string[];
  proficiency: string;
  market_rate: string;
  time_to_deploy_hrs: number;
  gap_to_close: string | null;
}

export async function GET() {
  try {
    const [scoreboardResult, gapResult, checkpointResult] = await Promise.all([
      searchEntities("Scoreboard-current", undefined, 3),
      searchEntities("RECON-pending-gap", undefined, 3),
      getCheckpoint("strawberry-picker"),
    ]);

    // Parse scoreboard
    const scoreboardEntities = (scoreboardResult as { entities?: Array<{ name: string; description: string }> })?.entities ?? [];
    const scoreboardEntity = scoreboardEntities.find((e) => e.name === "Scoreboard-current");
    let capabilities: Capability[] = [];
    let knownGaps: string[] = [];

    if (scoreboardEntity) {
      try {
        const parsed = JSON.parse(scoreboardEntity.description);
        capabilities = parsed.army_capabilities ?? [];
        knownGaps = parsed.known_gaps ?? [];
      } catch {
        // Description might not be JSON
      }
    }

    // Parse pending gaps
    const gapEntities = (gapResult as { entities?: Array<{ name: string; description: string }> })?.entities ?? [];
    const pendingGap = gapEntities.find((e) => e.name === "RECON-pending-gap");
    let pendingGapData = null;
    if (pendingGap) {
      try {
        pendingGapData = JSON.parse(pendingGap.description);
      } catch {
        pendingGapData = { raw: pendingGap.description.slice(0, 300) };
      }
    }

    // Parse strawberry-picker checkpoint for pipeline status
    const checkpoint = checkpointResult as {
      status: string;
      checkpoint?: { current_state?: string; next_steps?: string };
    };
    const pipelineStatus = checkpoint?.status === "success"
      ? checkpoint.checkpoint?.current_state ?? "Unknown"
      : "No checkpoint";

    return NextResponse.json({
      capabilities,
      knownGaps,
      pendingGap: pendingGapData,
      pipelineStatus,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
