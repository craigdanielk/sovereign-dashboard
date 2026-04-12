import { NextRequest, NextResponse } from "next/server";

interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantId = searchParams.get("tenant_id");

  if (!tenantId) {
    return NextResponse.json(
      { error: "tenant_id query param is required" },
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
  };

  try {
    // 1. Resolve tenant row from tenant_id
    const tenantRes = await fetch(
      `${url}/rest/v1/tenants?id=eq.${encodeURIComponent(tenantId)}&select=id,slug,name&limit=1`,
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
        { error: `No tenant found for id: ${tenantId}` },
        { status: 404 }
      );
    }

    const tenant = tenants[0];
    const clientSlug = tenant.slug;

    // 2. Fetch tasks and comms in parallel
    const [tasksRes, commsRes] = await Promise.all([
      fetch(
        `${url}/rest/v1/tasks?client_slug=eq.${encodeURIComponent(clientSlug)}&order=created_at.desc`,
        { headers, signal: AbortSignal.timeout(5000) }
      ).catch(() => null),
      fetch(
        `${url}/rest/v1/v_inbox?client_slug=eq.${encodeURIComponent(clientSlug)}&limit=20`,
        { headers, signal: AbortSignal.timeout(5000) }
      ).catch(() => null),
    ]);

    const tasks = tasksRes?.ok ? await tasksRes.json() : [];
    const comms = commsRes?.ok ? await commsRes.json() : [];

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      tasks: Array.isArray(tasks) ? tasks : [],
      comms: Array.isArray(comms) ? comms : [],
    });
  } catch (err) {
    console.error("[workspace/route] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
