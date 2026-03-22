import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ExecLogRow {
  id: number;
  created_at: string;
  session_id: string;
  brief_id: number | null;
  agent: string;
  step_number: number;
  operation: string;
  trigger: string | null;
  tool_or_service: string | null;
  input_summary: string | null;
  output_summary: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  tokens_used: number | null;
  model: string | null;
  error_type: string | null;
  error_message: string | null;
  recovery_action: string | null;
}

export async function GET() {
  try {
    // Fetch recent execution logs (last 100 entries)
    const { data, error } = await supabase
      .from("execution_log")
      .select(
        "id, created_at, session_id, brief_id, agent, step_number, operation, " +
        "trigger, tool_or_service, input_summary, output_summary, " +
        "duration_ms, cost_usd, tokens_used, model, error_type, error_message, " +
        "recovery_action"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    // Compute summary stats
    const rows = (data ?? []) as unknown as ExecLogRow[];
    const now = Date.now();
    const oneHourAgo = now - 3600_000;
    const recentRows = rows.filter(
      (r) => new Date(r.created_at).getTime() > oneHourAgo
    );

    // Agent activity: group by agent, count ops, find latest activity
    const agentMap = new Map<
      string,
      {
        ops: number;
        errors: number;
        lastSeen: string;
        lastOp: string;
        sessions: Set<string>;
        briefIds: Set<number>;
      }
    >();

    for (const row of rows) {
      const entry = agentMap.get(row.agent) ?? {
        ops: 0,
        errors: 0,
        lastSeen: row.created_at,
        lastOp: row.operation,
        sessions: new Set<string>(),
        briefIds: new Set<number>(),
      };
      entry.ops++;
      if (row.error_type) entry.errors++;
      if (row.created_at > entry.lastSeen) {
        entry.lastSeen = row.created_at;
        entry.lastOp = row.operation;
      }
      entry.sessions.add(row.session_id);
      if (row.brief_id) entry.briefIds.add(row.brief_id);
      agentMap.set(row.agent, entry);
    }

    const agentActivity = Array.from(agentMap.entries())
      .map(([agent, info]) => ({
        agent,
        ops: info.ops,
        errors: info.errors,
        lastSeen: info.lastSeen,
        lastOp: info.lastOp,
        activeSessions: info.sessions.size,
        briefIds: Array.from(info.briefIds),
      }))
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

    // Error summary
    const totalErrors = rows.filter((r) => r.error_type).length;
    const recentErrors = recentRows.filter((r) => r.error_type).length;

    // Throughput
    const opsLastHour = recentRows.length;
    const uniqueSessionsLastHour = new Set(recentRows.map((r) => r.session_id)).size;

    return NextResponse.json({
      logs: rows,
      summary: {
        totalLogs: rows.length,
        opsLastHour,
        uniqueSessionsLastHour,
        totalErrors,
        recentErrors,
        agentActivity,
      },
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/execution-log]", msg);
    return NextResponse.json({ error: msg, logs: [], summary: null }, { status: 500 });
  }
}
