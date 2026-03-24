import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

interface RagEntity {
  name?: string;
  entity_type?: string;
  description?: string;
  status?: string;
  last_updated?: string;
  [key: string]: unknown;
}

// Shape returned by rag_traverse inside the entities array
interface TraverseEntity {
  name: string;
  relationship: string;
  direction: string; // "outbound" | "inbound" | "outgoing" | "incoming"
  depth: number;
  entity_type?: string;
  description?: string;
}

// Full rag_traverse response (inside content[].text)
interface TraverseResponse {
  status?: string;
  start_entity?: string;
  entities?: TraverseEntity[];
  count?: number;
}

interface GraphNode {
  id: string;
  name: string;
  entity_type: string;
  description: string;
  status: string;
  last_updated: string | null;
  related_projects?: string[];
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

/**
 * Extract edges from a rag_traverse JSON-RPC response.
 *
 * rag_traverse returns: { start_entity, entities: [{ name, relationship, direction, depth }] }
 * We convert each entity into a { source, target, type } edge relative to start_entity.
 * For depth-2 entities we still connect them to start_entity since the flat list
 * doesn't indicate which intermediate node is the parent.
 */
function extractTraverseEdges(result: Record<string, unknown> | null): { edges: GraphEdge[]; entities: TraverseEntity[] } {
  if (!result) return { edges: [], entities: [] };

  // Navigate JSON-RPC result → content[].text
  let traverseData: TraverseResponse | null = null;

  const rpcResult = result.result as Record<string, unknown> | undefined;
  if (rpcResult) {
    const content = rpcResult.content as Array<{ text?: string }> | undefined;
    if (content && Array.isArray(content)) {
      for (const item of content) {
        if (item.text) {
          try {
            const parsed = JSON.parse(item.text);
            if (parsed.start_entity && parsed.entities) {
              traverseData = parsed as TraverseResponse;
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }
  }

  // Also handle case where result itself is the traverse response (no JSON-RPC wrapper)
  if (!traverseData) {
    const direct = result as unknown as TraverseResponse;
    if (direct.start_entity && direct.entities) {
      traverseData = direct;
    }
  }

  if (!traverseData || !traverseData.start_entity || !traverseData.entities) {
    return { edges: [], entities: [] };
  }

  const startEntity = traverseData.start_entity;
  const edges: GraphEdge[] = [];

  for (const ent of traverseData.entities) {
    if (!ent.name || !ent.relationship) continue;

    const dir = (ent.direction || "outbound").toLowerCase();
    // For outbound/outgoing: start_entity → entity (source=start, target=entity)
    // For inbound/incoming: entity → start_entity (source=entity, target=start)
    let source: string;
    let target: string;
    if (dir === "inbound" || dir === "incoming") {
      source = ent.name;
      target = startEntity;
    } else {
      source = startEntity;
      target = ent.name;
    }

    edges.push({ source, target, type: ent.relationship });
  }

  return { edges, entities: traverseData.entities };
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

// Normalize entity names: strip "agent::", "service::", etc. prefixes to canonical short names
function canonicalName(raw: string): string {
  // Remove known prefixes
  const prefixes = ["agent::", "service::", "tool::", "workflow::", "content::", "gap::", "repository::"];
  let name = raw;
  for (const prefix of prefixes) {
    if (name.toLowerCase().startsWith(prefix)) {
      name = name.slice(prefix.length);
      break;
    }
  }
  return name;
}

// Check if a name is a node-card config entity (should be excluded)
function isNodeCard(name: string): boolean {
  return name.toLowerCase().startsWith("node-card::");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // entity_type filter: default to agent,service,workflow (no content noise)
  const typesParam = searchParams.get("types") || "agent,service,workflow";
  const requestedTypes = new Set(typesParam.split(",").map((t) => t.trim().toLowerCase()));

  try {
    // Step A, B, C, D, E: fetch agents, services, workflows, content, and skills in parallel
    const [agentsResult, servicesResult, workflowsResult, contentResult, skillsResult] = await Promise.all([
      ragCall("memory_search_entities", { query: "agent", entity_type: "agent", top_k: 50 }, 1),
      ragCall("memory_search_entities", { query: "service", entity_type: "service", top_k: 50 }, 2),
      ragCall("memory_search_entities", { query: "workflow", entity_type: "workflow", top_k: 20 }, 6),
      ragCall("memory_search_entities", { query: "content", entity_type: "content", top_k: 30 }, 7),
      ragCall("memory_search_entities", { query: "skill", entity_type: "skill", top_k: 50 }, 8),
    ]);

    const agentEntities = extractContent(agentsResult) as RagEntity[];
    const serviceEntities = extractContent(servicesResult) as RagEntity[];
    const workflowEntities = extractContent(workflowsResult) as RagEntity[];
    const contentEntities = extractContent(contentResult) as RagEntity[];
    const skillEntities = extractContent(skillsResult) as RagEntity[];

    // Step C: traverse for edges from hub entities that actually store relationships.
    // Most relationships are stored as outbound edges on SOVEREIGN, RAG-System, and Supabase.
    // Traversing individual agents returns 0 entities, so we target the hubs instead.
    const allTraverseResultsRaw = await Promise.all([
      ragCall("rag_traverse", { entity_name: "SOVEREIGN", max_depth: 2 }, 100),
      ragCall("rag_traverse", { entity_name: "RAG-System", max_depth: 1 }, 101),
      ragCall("rag_traverse", { entity_name: "Supabase", max_depth: 1 }, 102),
    ]);

    // Build node map with deduplication
    const nodeMap = new Map<string, GraphNode>();

    function upsertNode(raw: string, entityType: string, desc: string, status: string, lastUpdated: string | null, relatedProjects?: string[]) {
      if (isNodeCard(raw)) return;
      const name = canonicalName(raw);
      if (!name || isBlocked(name)) return;

      const existing = nodeMap.get(name);
      if (existing) {
        // Merge: prefer longer description, keep first non-default status
        if (desc && desc.length > (existing.description || "").length) {
          existing.description = desc;
        }
        if (status && status !== "operational" && existing.status === "operational") {
          existing.status = status;
        }
        if (entityType !== "unknown" && existing.entity_type === "unknown") {
          existing.entity_type = entityType;
        }
        if (lastUpdated && (!existing.last_updated || lastUpdated > existing.last_updated)) {
          existing.last_updated = lastUpdated;
        }
        if (relatedProjects && relatedProjects.length > 0) {
          const merged = new Set([...(existing.related_projects || []), ...relatedProjects]);
          existing.related_projects = Array.from(merged);
        }
      } else {
        nodeMap.set(name, {
          id: name,
          name,
          entity_type: entityType,
          description: desc,
          status: status || "operational",
          last_updated: lastUpdated || null,
          related_projects: relatedProjects || [],
        });
      }
    }

    for (const e of agentEntities) {
      const name = e.name || "";
      if (!name) continue;
      upsertNode(name, "agent", (e.description as string) || "", (e.status as string) || "operational", (e.last_updated as string) || null, Array.isArray(e.related_projects) ? (e.related_projects as string[]) : []);
    }

    for (const e of serviceEntities) {
      const name = e.name || "";
      if (!name) continue;
      upsertNode(name, "service", (e.description as string) || "", (e.status as string) || "operational", (e.last_updated as string) || null, Array.isArray(e.related_projects) ? (e.related_projects as string[]) : []);
    }

    for (const e of workflowEntities) {
      const name = e.name || "";
      if (!name) continue;
      upsertNode(name, "workflow", (e.description as string) || "", (e.status as string) || "operational", (e.last_updated as string) || null, Array.isArray(e.related_projects) ? (e.related_projects as string[]) : []);
    }

    for (const e of contentEntities) {
      const name = e.name || "";
      if (!name) continue;
      upsertNode(name, "content", (e.description as string) || "", (e.status as string) || "operational", (e.last_updated as string) || null, Array.isArray(e.related_projects) ? (e.related_projects as string[]) : []);
    }

    for (const e of skillEntities) {
      const name = e.name || "";
      if (!name) continue;
      upsertNode(name, "skill", (e.description as string) || "", (e.status as string) || "operational", (e.last_updated as string) || null, Array.isArray(e.related_projects) ? (e.related_projects as string[]) : []);
    }

    // Build edge set from all traverse results using extractTraverseEdges
    // which correctly parses the rag_traverse response format:
    // { start_entity: "...", entities: [{ name, relationship, direction, depth }] }
    const edgeSet = new Map<string, GraphEdge>();

    for (const traverseResult of allTraverseResultsRaw) {
      const { edges: rawEdges, entities: travEntities } = extractTraverseEdges(traverseResult);

      // Upsert nodes discovered via traversal (with entity_type from traverse)
      for (const ent of travEntities) {
        if (!ent.name) continue;
        upsertNode(ent.name, ent.entity_type || "unknown", ent.description || "", "operational", null);
      }

      for (const e of rawEdges) {
        const rawSource = e.source;
        const rawTarget = e.target;
        if (isNodeCard(rawSource) || isNodeCard(rawTarget)) continue;

        const source = canonicalName(rawSource);
        const target = canonicalName(rawTarget);
        if (!source || !target || source === target) continue;
        if (isBlocked(source) || isBlocked(target)) continue;

        const relType = e.type || "related_to";
        const key = `${source}--${relType}--${target}`;
        // Also check reverse to avoid duplicated bidirectional edges
        const reverseKey = `${target}--${relType}--${source}`;
        if (!edgeSet.has(key) && !edgeSet.has(reverseKey)) {
          edgeSet.set(key, { source, target, type: relType });
          // Create reverse edge so every node has at least one visible connection.
          // e.g. SOVEREIGN→FORGE also yields FORGE→SOVEREIGN.
          const reverseRelType = relType.replace("orchestrates", "orchestrated_by")
            .replace("manages", "managed_by")
            .replace("uses", "used_by");
          const revKey = `${target}--${reverseRelType}--${source}`;
          if (reverseRelType !== relType && !edgeSet.has(revKey)) {
            edgeSet.set(revKey, { source: target, target: source, type: reverseRelType });
          }
        }

        // Ensure both endpoints exist as nodes
        upsertNode(source, "unknown", "", "operational", null);
        upsertNode(target, "unknown", "", "operational", null);
      }
    }

    // Filter nodes by requested entity types
    const allNodes = Array.from(nodeMap.values());
    const nodes = allNodes.filter((n) => requestedTypes.has(n.entity_type));
    const nodeIds = new Set(nodes.map((n) => n.id));
    // Only include edges where both endpoints are in the filtered node set
    const edges = Array.from(edgeSet.values()).filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return NextResponse.json({ nodes, edges, links: edges, total_counts: {
      agent: allNodes.filter((n) => n.entity_type === "agent").length,
      service: allNodes.filter((n) => n.entity_type === "service").length,
      workflow: allNodes.filter((n) => n.entity_type === "workflow").length,
      skill: allNodes.filter((n) => n.entity_type === "skill").length,
      content: allNodes.filter((n) => n.entity_type === "content").length,
    } }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("Graph API error:", err);
    return NextResponse.json({ nodes: [], edges: [], links: [], error: String(err) }, { status: 500 });
  }
}
