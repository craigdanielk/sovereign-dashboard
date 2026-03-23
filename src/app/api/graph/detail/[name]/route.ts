import { NextRequest, NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

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

  if (!res.ok) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractContent(result: Record<string, unknown> | null): unknown[] {
  if (!result) return [];
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
            if (parsed.relations) return parsed.relations;
            return [parsed];
          } catch {
            continue;
          }
        }
      }
    }
  }
  if (Array.isArray(result)) return result;
  return [];
}

interface TraverseEntity {
  name: string;
  relationship: string;
  direction: string;
  depth: number;
  entity_type?: string;
}

interface TraverseResponse {
  start_entity?: string;
  entities?: TraverseEntity[];
}

/**
 * Extract relationships from rag_traverse response.
 * rag_traverse returns { start_entity, entities: [{ name, relationship, direction, depth }] }.
 * Convert to { target, type, direction } relative to the queried entity.
 */
function extractTraverseRelationships(
  result: Record<string, unknown> | null,
  queriedName: string
): Array<{ target: string; type: string; direction: string }> {
  if (!result) return [];

  let traverseData: TraverseResponse | null = null;

  // Navigate JSON-RPC result -> content[].text
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

  // Handle case where result itself is the traverse response (no JSON-RPC wrapper)
  if (!traverseData) {
    const direct = result as unknown as TraverseResponse;
    if (direct.start_entity && direct.entities) {
      traverseData = direct;
    }
  }

  if (!traverseData || !traverseData.entities) return [];

  const relationships: Array<{ target: string; type: string; direction: string }> = [];

  for (const ent of traverseData.entities) {
    if (!ent.name || !ent.relationship) continue;
    if (isBlocked(ent.name)) continue;

    const dir = (ent.direction || "outbound").toLowerCase();
    const direction = (dir === "inbound" || dir === "incoming") ? "incoming" : "outgoing";

    relationships.push({
      target: ent.name,
      type: ent.relationship,
      direction,
    });
  }

  return relationships;
}

interface ExecutionLogEntry {
  operation: string;
  tool_or_service: string | null;
  created_at: string;
}

async function fetchExecutionLog(agentName: string): Promise<ExecutionLogEntry[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/execution_log?agent=eq.${encodeURIComponent(agentName)}&order=created_at.desc&limit=5&select=operation,tool_or_service,created_at`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (isBlocked(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [entityResult, traverseResult, executionLog] = await Promise.all([
      ragCall("memory_search_entities", { query: name, top_k: 5 }, 1),
      ragCall("rag_traverse", { entity_name: name, max_depth: 1 }, 2),
      fetchExecutionLog(name),
    ]);

    const entities = extractContent(entityResult) as Array<Record<string, unknown>>;

    // Find best-match entity
    const entity = entities.find(
      (e) => (e.name as string || "").toLowerCase() === name.toLowerCase()
    ) || entities[0] || { name, entity_type: "unknown", description: "" };

    // Extract relationships from rag_traverse using the proper parser
    const relationships = extractTraverseRelationships(traverseResult, name);

    return NextResponse.json({
      entity: {
        name: (entity.name as string) || name,
        type: (entity.entity_type as string) || "unknown",
        description: (entity.description as string) || "",
        related_projects: (entity.related_projects as string[]) || [],
        last_updated: (entity.last_updated as string) || null,
        status: (entity.status as string) || "operational",
      },
      relationships,
      execution_log: executionLog,
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("Graph detail error:", err);
    return NextResponse.json({ entity: null, relationships: [], execution_log: [], error: String(err) }, { status: 500 });
  }
}
