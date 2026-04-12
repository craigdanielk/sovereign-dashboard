import { NextRequest, NextResponse } from "next/server";

interface CreateBriefBody {
  task_id: string;
  tenant_id: string;
  title: string;
  description?: string;
  priority?: string;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function POST(request: NextRequest) {
  let body: CreateBriefBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { task_id, tenant_id, title, description, priority } = body;

  if (!task_id || !tenant_id || !title) {
    return NextResponse.json(
      { error: "task_id, tenant_id, and title are required" },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  try {
    // 1. Resolve client_slug from tenant_id
    const tenantRes = await fetch(
      `${url}/rest/v1/tenants?id=eq.${encodeURIComponent(tenant_id)}&select=id,slug,name&limit=1`,
      { headers, signal: AbortSignal.timeout(5000) }
    );

    if (!tenantRes.ok) {
      return NextResponse.json(
        { error: "Failed to query tenants table" },
        { status: 502 }
      );
    }

    const tenants: Tenant[] = await tenantRes.json();
    if (!tenants || tenants.length === 0) {
      return NextResponse.json(
        { error: `No tenant found for id: ${tenant_id}` },
        { status: 404 }
      );
    }

    const tenant = tenants[0];
    const clientSlug = tenant.slug;
    const briefName = `BRIEF::${slugify(title)}::${todayDate()}`;

    // 2. Build brief payload with node_1–node_6 skeleton pre-filled from task data
    const payload = {
      schema_version: "brief-v1.2",
      instructed_mode: true,
      supervision_mode: "HITL",
      labels: {
        client_slug: clientSlug,
        r17_client: false,
        demo_target: false,
      },
      node_1_trigger: {
        event: title,
        context: description ?? "",
        decision: `Task (id: ${task_id}) converted to BRIEF. Awaiting HITL approval before execution.`,
      },
      node_2_context: {
        constraints: ["HITL: pause and notify Craig before any write or deploy"],
        stakeholders: ["Craig"],
        current_state: {
          complete: [],
          not_built: [title],
          in_progress: [],
        },
      },
      node_3_deliverables: {
        definition_of_done: [`Complete: ${title}`],
        acceptance_criteria: [],
        out_of_scope: [],
      },
      node_4_system_map: {
        core_systems: [],
        data_sources: [],
        access_required: [],
        required_agents: [],
        required_capabilities: [],
      },
      node_5_gap_analysis: {
        critical_gaps: [],
        non_blocking_gaps: [],
      },
      node_6_execution_plan: {
        steps: [],
        routing: "TBD",
        complexity: "TBD",
        estimated_hours: null,
      },
      source_task: {
        task_id,
        tenant_id,
        client_slug: clientSlug,
        priority: priority ?? "P2",
      },
    };

    // 3. Insert into briefs table — status QUEUED, supervision_mode HITL
    const insertRes = await fetch(`${url}/rest/v1/briefs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: briefName,
        status: "QUEUED",
        supervision_mode: "HITL",
        tenant_id,
        payload,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => "");
      console.error("[create-brief] insert failed:", insertRes.status, errText);
      return NextResponse.json(
        { error: "Failed to insert brief", detail: errText },
        { status: 502 }
      );
    }

    const inserted = await insertRes.json();
    const brief = Array.isArray(inserted) ? inserted[0] : inserted;

    return NextResponse.json(
      { brief_id: brief?.id ?? null, name: briefName },
      { status: 201 }
    );
  } catch (err) {
    console.error("[create-brief/route] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
