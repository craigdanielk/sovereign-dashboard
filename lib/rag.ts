/**
 * RAG MCP client — streamable-http transport for Next.js API routes.
 */

const RAG_ENDPOINT = process.env.RAG_MCP_URL
  ?? "https://rag-mcp-server-rsc32eci6a-ew.a.run.app";

const MCP_URL = `${RAG_ENDPOINT.replace(/\/$/, "")}/mcp`;

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function mcpPost(
  payload: object,
  sessionId: string | null = null,
): Promise<[JsonRpcResponse, string | null]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const resp = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const newSessionId = resp.headers.get("mcp-session-id") ?? sessionId;
  const raw = await resp.text();

  let body: JsonRpcResponse;
  if (raw.startsWith("event:") || raw.startsWith("data:")) {
    body = { jsonrpc: "2.0", id: 0 };
    for (const line of raw.split("\n")) {
      if (line.startsWith("data:")) {
        try { body = JSON.parse(line.slice(5).trim()); } catch { /* skip */ }
      }
    }
  } else {
    body = JSON.parse(raw);
  }

  return [body, newSessionId];
}

async function initSession(): Promise<string | null> {
  const [, sessionId] = await mcpPost({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "sovereign-dashboard", version: "1.0.0" },
    },
    id: 0,
  });
  return sessionId;
}

export async function callRagTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const sessionId = await initSession();

  const [body] = await mcpPost(
    {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id: 1,
    },
    sessionId,
  );

  if (body.error) {
    throw new Error(`RAG error: ${body.error.message}`);
  }

  const result = body.result as { content?: Array<{ type: string; text: string }> } | undefined;
  if (result?.content) {
    for (const item of result.content) {
      if (item.type === "text") {
        try { return JSON.parse(item.text); } catch { return { text: item.text }; }
      }
    }
  }
  return result;
}

export async function searchEntities(
  query: string,
  entityType?: string,
  topK = 10,
) {
  return callRagTool("memory_search_entities", {
    input: { query, entity_type: entityType ?? null, top_k: topK },
  });
}

export async function getCheckpoint(project: string) {
  return callRagTool("memory_get_checkpoint", {
    input: { project },
  });
}
