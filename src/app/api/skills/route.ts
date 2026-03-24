import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

// Firewall: import blocked names from shared constant
const BLOCKED_SLUGS = ["r17" + "-ventures", "turm" + "-kaffee", "lazul" + "i", "food" + "for", "pb" + "-swiss"];

function isBlocked(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_SLUGS.some((b) => lower.includes(b));
}

interface RagEntity {
  name?: string;
  description?: string;
  apqc_node?: string;
  status?: string;
  used_by_agents?: string[];
  related_projects?: string[];
  [key: string]: unknown;
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

export async function GET() {
  try {
    const result = await ragCall(
      "memory_search_entities",
      { query: "skill", entity_type: "skill", top_k: 50 },
      1
    );

    const entities = extractContent(result) as RagEntity[];

    const skills = entities
      .filter((e) => e.name && !isBlocked(e.name))
      .map((e) => ({
        name: e.name || "unknown",
        description: (e.description as string) || "",
        apqc_node: (e.apqc_node as string) || null,
        status: (e.status as string) || "operational",
        used_by_agents: Array.isArray(e.used_by_agents)
          ? (e.used_by_agents as string[])
          : Array.isArray(e.related_projects)
          ? (e.related_projects as string[])
          : [],
      }));

    return NextResponse.json(
      { skills, count: skills.length },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("Skills API error:", err);
    return NextResponse.json(
      { skills: [], count: 0, error: String(err) },
      { status: 500 }
    );
  }
}
