import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("artifacts")
      .select("id, name, agent_name, artifact_type, status, summary, vercel_url, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    // Group by agent_name for per-agent breakdown
    const agentMap = new Map<
      string,
      {
        name: string;
        artifactCount: number;
        artifacts: Array<{ name: string; type: string; status: string; url: string | null }>;
        lastUpdated: string | null;
        statuses: string[];
      }
    >();

    for (const row of data ?? []) {
      const agentName = row.agent_name ?? "unknown";
      const existing = agentMap.get(agentName);

      const artifact = {
        name: row.name,
        type: row.artifact_type ?? "",
        status: row.status ?? "",
        url: row.vercel_url,
      };

      if (!existing) {
        agentMap.set(agentName, {
          name: agentName,
          artifactCount: 1,
          artifacts: [artifact],
          lastUpdated: row.updated_at ?? row.created_at,
          statuses: [row.status ?? ""],
        });
      } else {
        existing.artifactCount++;
        existing.artifacts.push(artifact);
        existing.statuses.push(row.status ?? "");
        // Keep most recent
        const existingDate = existing.lastUpdated ?? "";
        const newDate = row.updated_at ?? row.created_at ?? "";
        if (newDate > existingDate) {
          existing.lastUpdated = newDate;
        }
      }
    }

    const agents = Array.from(agentMap.values()).map((agent) => {
      // Determine status from artifact statuses
      let status: "operational" | "beta" | "pending" | "offline" = "pending";
      const statusSet = new Set(agent.statuses.map((s) => s.toLowerCase()));
      if (statusSet.has("deployed") || statusSet.has("live") || statusSet.has("production")) {
        status = "operational";
      } else if (statusSet.has("beta") || statusSet.has("review")) {
        status = "beta";
      } else if (statusSet.has("failed") || statusSet.has("error")) {
        status = "offline";
      }

      // Extract capabilities from artifact types
      const capabilities = [...new Set(agent.artifacts.map((a) => a.type).filter(Boolean))];

      return {
        name: agent.name,
        status,
        capabilities,
        lastCommit: null,
        lastUpdated: agent.lastUpdated,
        relatedProjects: [],
        description: `${agent.artifactCount} artifact${agent.artifactCount !== 1 ? "s" : ""} — ${capabilities.join(", ") || "no types"}`,
      };
    });

    return NextResponse.json({ agents, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, agents: [] }, { status: 500 });
  }
}
