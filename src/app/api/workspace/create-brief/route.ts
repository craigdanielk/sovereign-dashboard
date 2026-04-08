import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

interface CreateBriefBody {
  workspace_id: string;
  task_id: string;
  title: string;
  description?: string;
  priority?: string;
}

export async function POST(req: NextRequest) {
  let body: CreateBriefBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { workspace_id, task_id, title, description, priority = "P1" } = body;

  if (!workspace_id || !task_id || !title) {
    return NextResponse.json(
      { error: "workspace_id, task_id, and title are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabase();

    // Resolve workspace to get slug and tenant_id
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, slug, name")
      .eq("id", workspace_id)
      .single();

    if (wsError || !workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Resolve the corresponding tenant record for tenant_id
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", workspace.slug)
      .single();

    const dateStamp = new Date().toISOString().slice(0, 10);
    const briefName = `BRIEF::${slugify(title)}::${dateStamp}`;

    const payload = {
      schema_version: "brief-v1.2",
      supervision_mode: "HITL",
      node_1_trigger: {
        event: title,
        context: description ?? "",
        decision: `Converted from task ${task_id} in ${workspace.name} workspace`,
      },
      node_2_context: {
        rag_checkpoint: workspace.slug,
        current_state: { complete: [], not_built: [title] },
        constraints: ["HITL: pause for human approval before execution"],
      },
      node_3_deliverables: {
        definition_of_done: [title],
        acceptance_criteria: [],
        out_of_scope: [],
      },
      node_4_system_map: {
        core_systems: [],
        required_capabilities: [],
        required_agents: [],
      },
      node_5_gap_analysis: {
        critical_gaps: [],
        non_blocking_gaps: [],
      },
      node_6_execution_plan: {
        routing: "direct_skill",
        complexity: "simple",
        steps: [],
      },
      source_task_id: task_id,
      client_slug: workspace.slug,
    };

    const { data: brief, error: insertError } = await supabase
      .from("briefs")
      .insert({
        name: briefName,
        status: "QUEUED",
        priority,
        supervision_mode: "HITL",
        triggered_by: "workspace-panel",
        tenant_id: tenant?.id ?? null,
        payload,
      })
      .select("id, name")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create brief: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ brief_id: brief.id, name: brief.name }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
