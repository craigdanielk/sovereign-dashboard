import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export interface GraphNode {
  id: string;
  type: "agent" | "skill" | "tool";
  label: string;
  status?: string;
  capabilities?: string[];
  proficiency?: string;
  classification?: string;
  description?: string;
  calls?: string[];
  called_by?: string[];
  gaps?: string[];
  layer?: string;
  category?: string;
  connectionCount?: number;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "calls" | "called_by" | "uses_skill" | "depends_on";
}

export async function GET() {
  try {
    const { data: artifacts, error } = await supabase
      .from("artifacts")
      .select("id, name, agent_name, artifact_type, status, summary, vercel_url, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);

    const rows = artifacts ?? [];
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    // Build agent nodes from unique agent_names
    const agentMap = new Map<string, { types: Set<string>; count: number; lastUpdated: string | null }>();
    for (const row of rows) {
      const agent = row.agent_name ?? "unknown";
      const existing = agentMap.get(agent);
      if (!existing) {
        agentMap.set(agent, {
          types: new Set([row.artifact_type ?? ""]),
          count: 1,
          lastUpdated: row.updated_at ?? row.created_at,
        });
      } else {
        existing.types.add(row.artifact_type ?? "");
        existing.count++;
      }
    }

    for (const [agentName, info] of agentMap) {
      nodeIds.add(agentName);
      nodes.push({
        id: agentName,
        type: "agent",
        label: agentName,
        capabilities: Array.from(info.types).filter(Boolean),
        connectionCount: 0,
        description: `${info.count} artifact${info.count !== 1 ? "s" : ""}`,
        metadata: { lastUpdated: info.lastUpdated },
      });
    }

    // Build artifact-type nodes and connect agents to them
    const typeSet = new Set<string>();
    for (const row of rows) {
      const t = row.artifact_type ?? "";
      if (!t) continue;
      if (!typeSet.has(t)) {
        typeSet.add(t);
        nodeIds.add(`type:${t}`);
        nodes.push({
          id: `type:${t}`,
          type: "skill",
          label: t.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          category: "artifact_type",
        });
      }
      const agent = row.agent_name ?? "unknown";
      edges.push({ source: agent, target: `type:${t}`, type: "uses_skill" });
    }

    // Update connection counts
    const connCounts = new Map<string, number>();
    for (const edge of edges) {
      connCounts.set(edge.source, (connCounts.get(edge.source) ?? 0) + 1);
      connCounts.set(edge.target, (connCounts.get(edge.target) ?? 0) + 1);
    }
    for (const node of nodes) {
      node.connectionCount = connCounts.get(node.id) ?? 0;
    }

    return NextResponse.json({ nodes, edges, fetchedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/graph]", msg);
    return NextResponse.json({ error: msg, nodes: [], edges: [] }, { status: 500 });
  }
}
