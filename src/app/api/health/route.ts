import { NextResponse } from "next/server";

const RAG_URL = "https://rag-mcp-server-152999532788.europe-west1.run.app/mcp";

export async function GET() {
  const timestamp = new Date().toISOString();
  let ragStatus: "ok" | "down" = "down";
  let supabaseStatus: "ok" | "down" = "down";

  // Ping RAG MCP
  try {
    const token = process.env.RAG_AUTH_TOKEN;
    if (token) {
      const res = await fetch(RAG_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "memory_search_entities", arguments: { input: { query: "health-check", top_k: 1 } } },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status === 200) {
        ragStatus = "ok";
      }
    }
  } catch {
    ragStatus = "down";
  }

  // Ping Supabase — actual query to confirm connectivity
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const res = await fetch(
        `${url}/rest/v1/briefs?select=id&limit=1`,
        {
          method: "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }
      );
      if (res.ok) {
        supabaseStatus = "ok";
      }
    }
  } catch {
    supabaseStatus = "down";
  }

  return NextResponse.json(
    { rag: ragStatus, supabase: supabaseStatus, timestamp },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
