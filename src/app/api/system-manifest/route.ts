import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

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

/**
 * Returns the system manifest by aggregating all entity types from RAG.
 * This mirrors the structure of control_tower/system.yaml.
 */
export async function GET() {
  try {
    // Fetch all entity types in parallel
    const [agentsResult, servicesResult, skillsResult, workflowsResult] = await Promise.all([
      ragCall("memory_search_entities", { query: "agent", entity_type: "agent", top_k: 50 }, 1),
      ragCall("memory_search_entities", { query: "service", entity_type: "service", top_k: 50 }, 2),
      ragCall("memory_search_entities", { query: "skill", entity_type: "skill", top_k: 50 }, 3),
      ragCall("memory_search_entities", { query: "workflow", entity_type: "workflow", top_k: 30 }, 4),
    ]);

    const agents = extractContent(agentsResult);
    const services = extractContent(servicesResult);
    const skills = extractContent(skillsResult);
    const workflows = extractContent(workflowsResult);

    const manifest = {
      generated_at: new Date().toISOString(),
      source: "RAG entity store (aggregated)",
      counts: {
        agents: agents.length,
        services: services.length,
        skills: skills.length,
        workflows: workflows.length,
        total: agents.length + services.length + skills.length + workflows.length,
      },
      agents,
      services,
      skills,
      workflows,
    };

    return NextResponse.json(manifest, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("System manifest API error:", err);
    return NextResponse.json(
      { error: String(err), agents: [], services: [], skills: [], workflows: [] },
      { status: 500 }
    );
  }
}
