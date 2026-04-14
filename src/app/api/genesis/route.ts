import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

const SYSTEM_PROMPT = `You are an operations assistant for the Sovereign Dashboard — Craig's AI agent orchestration system.

You help with:
- Drafting and queuing BRIEFs (wrap JSON in <BRIEF_DRAFT> tags if the user wants to queue one)
- Answering questions about agents, workflows, and system state
- Diagnosing failed BRIEFs or stale claims
- Planning next actions

Be concise and direct. Do not dump system identity information unprompted. Just answer the question or help with the task.

System context:
- Agents: SOVEREIGN, PRISM, RECON, LORE, SAGE, ATLAS, VERIFY, DELIVER, SCRIBE, COMPASS, ARAGON (operational); KIRA, PULSE, EXECUTOR, FORGE (dormant stubs)
- Workflows: build-validation, gap-resolution, website-build, lore-pattern-promote
- Infrastructure: Supabase (briefs table), n8n (localhost:5678), Docker active`;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  let body: {
    messages: Message[];
    draft_brief?: boolean;
    tenant_id?: string;
    context_brief_id?: number | null;
    _draft_override?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }

  const { messages } = body;
  if (!messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_DIRECT_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_DIRECT_API_KEY not configured" }), { status: 503 });
  }

  // Context injection for selected brief
  let contextPrompt = "";
  if (body.context_brief_id) {
    try {
      const supabase = getSupabase();
      const { data: brief } = await supabase
        .from("briefs")
        .select("id,name,status,payload")
        .eq("id", body.context_brief_id)
        .single();
      if (brief) {
        contextPrompt = `\n\nActive brief context — Mission #${brief.id}: ${brief.name} (${brief.status})\nPayload: ${JSON.stringify(brief.payload)}`;
      }
    } catch { /* non-fatal */ }
  }

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT + contextPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!anthropicResp.ok) {
    const err = await anthropicResp.text();
    return new Response(JSON.stringify({ error: `Anthropic API error: ${err}` }), { status: 502 });
  }

  // Stream Anthropic SSE → client SSE
  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                const token = event.delta.text;
                fullText += token;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
              }
            } catch { /* skip malformed events */ }
          }
        }

        // After stream ends: extract and optionally queue BRIEF draft
        let briefDraft: Record<string, unknown> | null = body._draft_override || null;
        if (!briefDraft) {
          const match = fullText.match(/<BRIEF_DRAFT>([\s\S]*?)<\/BRIEF_DRAFT>/);
          if (match) {
            try { briefDraft = JSON.parse(match[1].trim()); } catch { /* non-fatal */ }
          }
        }

        let queuedBriefId: number | null = null;
        if (briefDraft && body.draft_brief) {
          try {
            const supabase = getSupabase();
            const { data: brief } = await supabase
              .from("briefs")
              .insert({
                name: (briefDraft.name as string) ?? `BRIEF::genesis::draft::${Date.now()}`,
                status: "QUEUED",
                priority: (briefDraft.priority as string) ?? "P2",
                supervision_mode: (briefDraft.supervision_mode as string) ?? "HITL",
                triggered_by: "genesis-agent",
                tenant_slug: body.tenant_id ?? "north-star",
                payload: briefDraft.payload ?? briefDraft,
              })
              .select("id")
              .single();
            if (brief) queuedBriefId = brief.id;
          } catch { /* non-fatal */ }
        }

        // Send final event with metadata
        const cleanText = fullText.replace(/<BRIEF_DRAFT>[\s\S]*?<\/BRIEF_DRAFT>/, "").trim();
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, brief_draft: briefDraft, queued_brief_id: queuedBriefId, full_text: cleanText })}\n\n`
          )
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
