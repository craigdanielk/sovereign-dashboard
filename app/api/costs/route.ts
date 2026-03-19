import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface CostRow {
  id: number;
  created_at: string;
  agent: string;
  operation: string;
  model: string;
  provider: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  session_id: string | null;
}

interface AgentSummary {
  agent: string;
  total_cost: number;
  total_calls: number;
  total_tokens: number;
}

interface DailyTotal {
  date: string;
  total_cost: number;
  total_calls: number;
}

interface CostsData {
  rows: CostRow[];
  agentSummary: AgentSummary[];
  dailyTotals: DailyTotal[];
  monthTotal: number;
  todayTotal: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<CostsData>("costs", async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const { data, error } = await supabase
        .from("cost_log")
        .select(
          "id, created_at, agent, operation, model, provider, input_tokens, output_tokens, total_tokens, estimated_cost_usd, session_id"
        )
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message);

      const rows: CostRow[] = data ?? [];

      // Aggregate by agent
      const agentMap = new Map<string, AgentSummary>();
      for (const row of rows) {
        const existing = agentMap.get(row.agent) ?? {
          agent: row.agent,
          total_cost: 0,
          total_calls: 0,
          total_tokens: 0,
        };
        existing.total_cost += row.estimated_cost_usd ?? 0;
        existing.total_calls += 1;
        existing.total_tokens += row.total_tokens ?? 0;
        agentMap.set(row.agent, existing);
      }
      const agentSummary = Array.from(agentMap.values()).sort(
        (a, b) => b.total_cost - a.total_cost
      );

      // Daily totals (last 30 days)
      const dailyMap = new Map<string, DailyTotal>();
      for (const row of rows) {
        const date = row.created_at.slice(0, 10);
        const existing = dailyMap.get(date) ?? {
          date,
          total_cost: 0,
          total_calls: 0,
        };
        existing.total_cost += row.estimated_cost_usd ?? 0;
        existing.total_calls += 1;
        dailyMap.set(date, existing);
      }
      const dailyTotals = Array.from(dailyMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      const monthTotal = rows.reduce(
        (sum, r) => sum + (r.estimated_cost_usd ?? 0),
        0
      );

      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTotal = rows
        .filter((r) => r.created_at.startsWith(todayStr))
        .reduce((sum, r) => sum + (r.estimated_cost_usd ?? 0), 0);

      return {
        rows,
        agentSummary,
        dailyTotals,
        monthTotal,
        todayTotal,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/costs]", msg);
    return NextResponse.json(
      {
        error: msg,
        rows: [],
        agentSummary: [],
        dailyTotals: [],
        monthTotal: 0,
        todayTotal: 0,
      },
      { status: 500 }
    );
  }
}
