import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/rag";
import { dedupByName } from "@/lib/dedup";

export const dynamic = "force-dynamic";

interface GraphNode {
  id: string;
  type: "agent" | "skill" | "tool";
  label: string;
  status?: string;
  capabilities?: string[];
  proficiency?: string;
  metadata?: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: "calls" | "called_by" | "uses_skill" | "depends_on";
}

interface RagEntity {
  name: string;
  description: string;
  last_updated?: string | null;
  related_projects?: string[];
}

export async function GET() {
  try {
    const [agentResult, skillResult, matrixResult] = await Promise.all([
      searchEntities("agent", "agent", 30) as Promise<{ entities?: RagEntity[] }>,
      searchEntities("skill", "skill", 30) as Promise<{ entities?: RagEntity[] }>,
      searchEntities("workflow-matrix", "config", 5) as Promise<{ entities?: RagEntity[] }>,
    ]);

    const agents = dedupByName(agentResult?.entities ?? []);
    const skills = dedupByName(skillResult?.entities ?? []);
    const matrices = dedupByName(matrixResult?.entities ?? []);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Build agent nodes and edges from calls/called_by
    for (const entity of agents) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(entity.description);
      } catch {
        // description is not JSON; fall back to raw text
      }

      const name = (parsed.name as string) ?? entity.name;
      const status = (parsed.status as string) ?? undefined;
      const capabilities = Array.isArray(parsed.capabilities)
        ? (parsed.capabilities as string[])
        : undefined;
      const calls = Array.isArray(parsed.calls) ? (parsed.calls as string[]) : [];
      const calledBy = Array.isArray(parsed.called_by) ? (parsed.called_by as string[]) : [];

      nodes.push({
        id: entity.name,
        type: "agent",
        label: name,
        status,
        capabilities,
        metadata: { lastUpdated: entity.last_updated },
      });

      for (const target of calls) {
        edges.push({ source: entity.name, target, type: "calls" });
      }
      for (const source of calledBy) {
        edges.push({ source, target: entity.name, type: "called_by" });
      }
    }

    // Build skill nodes
    for (const entity of skills) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(entity.description);
      } catch {
        // description is not JSON; fall back to raw text
      }

      const name = (parsed.name as string) ?? entity.name;
      const proficiency = (parsed.proficiency as string) ?? undefined;
      const apqcCode = (parsed.apqc_code as string) ?? undefined;

      nodes.push({
        id: entity.name,
        type: "skill",
        label: name,
        proficiency,
        metadata: apqcCode ? { apqcCode } : undefined,
      });
    }

    // Merge workflow-matrix edges if present
    for (const entity of matrices) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(entity.description);
      } catch {
        continue;
      }

      if (Array.isArray(parsed.edges)) {
        for (const edge of parsed.edges as Array<Record<string, unknown>>) {
          if (edge.source && edge.target) {
            edges.push({
              source: String(edge.source),
              target: String(edge.target),
              type: (edge.type as GraphEdge["type"]) ?? "depends_on",
            });
          }
        }
      }
    }

    return NextResponse.json({ nodes, edges, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/graph]", msg);
    return NextResponse.json({ error: msg, nodes: [], edges: [] }, { status: 500 });
  }
}
