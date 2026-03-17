import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";
import { dedupByName } from "@/lib/dedup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await searchEntities("agent", "agent", 20) as {
      entities?: Array<{
        name: string;
        description: string;
        last_updated: string | null;
        related_projects?: string[];
      }>;
    };

    const deduped = dedupByName(result?.entities ?? []);
    const agents = deduped.map((e) => {
      const desc = e.description ?? "";
      const descLower = desc.toLowerCase();

      // Determine status from description keywords
      let status: "operational" | "beta" | "pending" | "offline" = "pending";
      if (descLower.includes("deployed") || descLower.includes("production") || descLower.includes("passing") || descLower.includes("live")) {
        status = "operational";
      } else if (descLower.includes("beta") || descLower.includes("near-production")) {
        status = "beta";
      } else if (descLower.includes("pending") || descLower.includes("no dedicated repo")) {
        status = "pending";
      }

      // Extract capabilities
      const capMatch = desc.match(/[Cc]apabilit(?:y|ies)[:\s]+([^.]+)/);
      const capabilities = capMatch
        ? capMatch[1].split(",").map((c) => c.trim()).filter(Boolean)
        : [];

      // Extract commit ref
      const commitMatch = desc.match(/commit\s+([a-f0-9]{7,})/i);
      const lastCommit = commitMatch ? commitMatch[1] : null;

      return {
        name: e.name,
        status,
        capabilities,
        lastCommit,
        lastUpdated: e.last_updated,
        relatedProjects: e.related_projects ?? [],
        description: desc,
      };
    });

    return NextResponse.json({ agents, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, agents: [] }, { status: 500 });
  }
}
