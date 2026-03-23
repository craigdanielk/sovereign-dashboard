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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (isBlocked(name)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [entityResult, traverseResult] = await Promise.all([
      ragCall("memory_search_entities", { query: name, top_k: 5 }, 1),
      ragCall("rag_traverse", { start_node: name, max_depth: 1 }, 2),
    ]);

    const entities = extractContent(entityResult) as Array<Record<string, unknown>>;
    const relations = extractContent(traverseResult) as Array<Record<string, unknown>>;

    // Find best-match entity
    const entity = entities.find(
      (e) => (e.name as string || "").toLowerCase() === name.toLowerCase()
    ) || entities[0] || { name, entity_type: "unknown", description: "" };

    // Build relationships list, filtering R17
    const relationships = relations
      .filter((r) => {
        const src = (r.source as string) || "";
        const tgt = (r.target as string) || "";
        return !isBlocked(src) && !isBlocked(tgt);
      })
      .map((r) => ({
        target: (r.target as string) || (r.source as string) || "",
        type: (r.relation_type as string) || (r.type as string) || "related_to",
        direction: ((r.source as string) || "").toLowerCase() === name.toLowerCase() ? "outgoing" : "incoming",
      }));

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
    }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("Graph detail error:", err);
    return NextResponse.json({ entity: null, relationships: [], error: String(err) }, { status: 500 });
  }
}
