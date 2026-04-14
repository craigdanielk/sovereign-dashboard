import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Genesis Intelligence API — Chat-to-Brief authoring
// Backed by Anthropic claude-sonnet-4-6 via direct API key

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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_DIRECT_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_DIRECT_API_KEY not configured" }, { status: 503 });
  }

  // ── Context Injection ───────────────────────────────────────────
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
        contextPrompt = `\n\n### ACTIVE MISSION CONTEXT (URGENT):
The user is currently focusing on Mission #${brief.id}: ${brief.name}.
Status: ${brief.status}
Current Payload: ${JSON.stringify(brief.payload)}

Your instructions:
1. Prioritise directives related to this specific mission.
2. If the user provides feedback, focus on AUGMENTING this brief (output a new <BRIEF_DRAFT> if needed).
3. Provide status-aware commentary (e.g., if COMPLETED, explain high-level results; if FAILED, provide a gap-analysis root cause).`;
      }
    } catch { /* Non-fatal */ }
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT + contextPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: `Anthropic API error: ${err}` }, { status: 502 });
    }

    const data = await resp.json();
    const text: string = data.content?.[0]?.text ?? "";

    // Extract brief draft — Check for manual override first (from the 'Queue' button)
    let briefDraft: Record<string, unknown> | null = body._draft_override || null;
    
    if (!briefDraft) {
      const draftMatch = text.match(/<BRIEF_DRAFT>([\s\S]*?)<\/BRIEF_DRAFT>/);
      if (draftMatch) {
        try {
          briefDraft = JSON.parse(draftMatch[1].trim());
        } catch { /* Non-fatal */ }
      }
    }

    // Queue the brief if valid
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
      } catch { /* Non-fatal */ }
    }

    const cleanText = text.replace(/<BRIEF_DRAFT>[\s\S]*?<\/BRIEF_DRAFT>/, "").trim();

    return NextResponse.json({
      text: cleanText,
      brief_draft: briefDraft,
      queued_brief_id: queuedBriefId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
