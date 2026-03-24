import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

const BLOCKED_SLUGS = ["r17" + "-ventures", "turm" + "-kaffee", "lazul" + "i", "food" + "for", "pb" + "-swiss"];

function isBlocked(name: string): boolean {
  const lower = name.toLowerCase();
  return BLOCKED_SLUGS.some((b) => lower.includes(b));
}

interface RagEntity {
  name?: string;
  description?: string;
  status?: string;
  steps?: string[];
  agents?: string[];
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

/**
 * Check Supabase execution_log for workflow operation names.
 * Returns a set of workflow names that have been executed.
 */
async function fetchExecutedWorkflows(): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Set();

  try {
    const res = await fetch(
      `${url}/rest/v1/execution_log?select=operation&order=created_at.desc&limit=500`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return new Set();
    const data = await res.json();
    if (!Array.isArray(data)) return new Set();

    const ops = new Set<string>();
    for (const row of data) {
      if (row.operation) {
        ops.add(String(row.operation).toLowerCase());
      }
    }
    return ops;
  } catch {
    return new Set();
  }
}

export async function GET() {
  try {
    const [ragResult, executedOps] = await Promise.all([
      ragCall(
        "memory_search_entities",
        { query: "workflow", entity_type: "workflow", top_k: 30 },
        1
      ),
      fetchExecutedWorkflows(),
    ]);

    const entities = extractContent(ragResult) as RagEntity[];

    const workflows = entities
      .filter((e) => e.name && !isBlocked(e.name))
      .map((e) => {
        const name = e.name || "unknown";
        const nameLower = name.toLowerCase().replace(/[^a-z0-9]/g, "");

        // Check if this workflow name appears in any execution_log operation
        const isExecuted = Array.from(executedOps).some(
          (op) => op.includes(nameLower) || nameLower.includes(op.replace(/[^a-z0-9]/g, ""))
        );

        return {
          name,
          description: (e.description as string) || "",
          steps: Array.isArray(e.steps) ? e.steps : [],
          agents: Array.isArray(e.agents)
            ? (e.agents as string[])
            : Array.isArray(e.related_projects)
            ? (e.related_projects as string[])
            : [],
          execution_status: isExecuted ? "OPERATIONAL" : "DESIGNED ONLY",
        };
      });

    return NextResponse.json(
      { workflows, count: workflows.length },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("Workflows API error:", err);
    return NextResponse.json(
      { workflows: [], count: 0, error: String(err) },
      { status: 500 }
    );
  }
}
