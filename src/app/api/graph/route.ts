import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

interface RagEntity {
  name?: string;
  entity_type?: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

interface RagRelation {
  source?: string;
  target?: string;
  relation_type?: string;
  type?: string;
  [key: string]: unknown;
}

interface GraphNode {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

async function ragCall(method: string, args: Record<string, unknown>, id: number = 1) {
  const token = process.env.RAG_AUTH_TOKEN;
  if (!token) throw new Error("RAG_AUTH_TOKEN not set");

  const res = await fetch(RAG_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: method, arguments: { input: args } },
    }),
  });

  const contentType = res.headers.get("content-type") || "";

  // Handle SSE (Streamable HTTP) response
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n");
    let lastData = "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        lastData = line.slice(6);
      }
    }
    if (lastData) {
      try {
        return JSON.parse(lastData);
      } catch {
        return null;
      }
    }
    return null;
  }

  // Handle regular JSON response
  if (!res.ok) {
    console.error(`RAG call ${method} failed: ${res.status} ${res.statusText}`);
    return null;
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractContent(result: Record<string, unknown> | null): unknown[] {
  if (!result) return [];

  // Navigate JSON-RPC result structure
  const rpcResult = result.result as Record<string, unknown> | undefined;
  if (rpcResult) {
    const content = rpcResult.content as Array<{ text?: string }> | undefined;
    if (content && Array.isArray(content)) {
      for (const item of content) {
        if (item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (Array.isArray(parsed)) return parsed;
            if (parsed.entities) return parsed.entities;
            if (parsed.results) return parsed.results;
            if (parsed.nodes) return parsed.nodes;
            if (parsed.relations) return parsed.relations;
            if (parsed.edges) return parsed.edges;
            return [parsed];
          } catch {
            continue;
          }
        }
      }
    }
  }

  // Direct array
  if (Array.isArray(result)) return result;

  return [];
}

// R17 firewall: never expose these
const R17_BLOCKED = new Set([
  "r17-ventures",
  "turm-kaffee",
  "lazuli",
  "foodfor",
  "pb-swiss",
]);

function isBlocked(name: string): boolean {
  const lower = name.toLowerCase();
  return Array.from(R17_BLOCKED).some((b) => lower.includes(b));
}

export async function GET() {
  try {
    // Step A & B: fetch agents and services in parallel
    const [agentsResult, servicesResult] = await Promise.all([
      ragCall("memory_search_entities", { query: "agent", entity_type: "agent", top_k: 50 }, 1),
      ragCall("memory_search_entities", { query: "service", entity_type: "service", top_k: 50 }, 2),
    ]);

    const agentEntities = extractContent(agentsResult) as RagEntity[];
    const serviceEntities = extractContent(servicesResult) as RagEntity[];

    // Step C & D: traverse for edges
    const [sovereignTraverse, ragTraverse, supaTraverse] = await Promise.all([
      ragCall("rag_traverse", { start_node: "agent::SOVEREIGN", max_depth: 2 }, 3),
      ragCall("rag_traverse", { start_node: "RAG-System", max_depth: 2 }, 4),
      ragCall("rag_traverse", { start_node: "Supabase", max_depth: 2 }, 5),
    ]);

    // Build node map
    const nodeMap = new Map<string, GraphNode>();

    for (const e of agentEntities) {
      const name = e.name || "";
      if (!name || isBlocked(name)) continue;
      nodeMap.set(name, {
        id: name,
        name,
        entity_type: "agent",
        description: (e.description as string) || "",
        status: (e.status as string) || "operational",
      });
    }

    for (const e of serviceEntities) {
      const name = e.name || "";
      if (!name || isBlocked(name)) continue;
      nodeMap.set(name, {
        id: name,
        name,
        entity_type: "service",
        description: (e.description as string) || "",
        status: (e.status as string) || "operational",
      });
    }

    // Build edge set
    const edgeSet = new Map<string, GraphEdge>();

    for (const traverseResult of [sovereignTraverse, ragTraverse, supaTraverse]) {
      const relations = extractContent(traverseResult) as RagRelation[];
      for (const r of relations) {
        const source = r.source || "";
        const target = r.target || "";
        const relType = r.relation_type || r.type || "related_to";
        if (!source || !target || isBlocked(source) || isBlocked(target)) continue;

        const key = `${source}--${relType}--${target}`;
        if (!edgeSet.has(key)) {
          edgeSet.set(key, { source, target, type: relType });
        }

        // Ensure both endpoints exist as nodes
        if (!nodeMap.has(source)) {
          nodeMap.set(source, {
            id: source,
            name: source,
            entity_type: "unknown",
            description: "",
            status: "operational",
          });
        }
        if (!nodeMap.has(target)) {
          nodeMap.set(target, {
            id: target,
            name: target,
            entity_type: "unknown",
            description: "",
            status: "operational",
          });
        }
      }
    }

    const nodes = Array.from(nodeMap.values());
    const edges = Array.from(edgeSet.values());

    return NextResponse.json({ nodes, edges }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("Graph API error:", err);
    return NextResponse.json({ nodes: [], edges: [], error: String(err) }, { status: 500 });
  }
}
