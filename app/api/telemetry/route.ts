import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { withCache, jsonResponse } from "@/lib/cache";

export const dynamic = "force-dynamic";

interface RetroRow {
  id: number;
  session_id: string;
  created_at: string;
  summary: string | null;
  brief_ids_claimed: number[];
  brief_ids_completed: number[];
  brief_ids_failed: number[];
  brief_ids_deferred: number[];
  errors_encountered: Record<string, unknown>[];
  skills_missing: string[];
  skills_used: string[];
  tools_used: string[];
  tools_failed: Record<string, unknown>[];
  stale_data_found: Record<string, unknown>[];
  close_loop_violations: Record<string, unknown>[];
  new_workflows: Record<string, unknown>[];
  workflow_gaps: Record<string, unknown>[];
  health_score: number | null;
  total_duration_minutes: number | null;
  token_usage_input: number | null;
  token_usage_output: number | null;
  api_cost_estimate: number | null;
}

interface CostRow {
  id: number;
  created_at: string;
  agent: string;
  operation: string;
  model: string;
  estimated_cost_usd: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  client_slug: string | null;
}

interface TelemetryData {
  // Session metrics
  totalSessions: number;
  completedBriefs: number;
  failedBriefs: number;
  deferredBriefs: number;
  avgHealthScore: number | null;

  // Error analysis
  errorRate: number;
  topErrors: { error: string; count: number }[];
  topFailedTools: { tool: string; count: number }[];

  // Skill gaps
  topMissingSkills: { skill: string; count: number }[];

  // Cost breakdown
  dailyCosts: { date: string; cost: number; calls: number }[];
  perAgentCost: { agent: string; cost: number; calls: number; tokens: number }[];
  perClientCost: { client: string; cost: number; calls: number }[];
  totalCost: number;
  todayCost: number;

  // Completion rate
  completionRate: number;

  // Recent sessions
  recentSessions: {
    session_id: string;
    created_at: string;
    summary: string | null;
    health_score: number | null;
    completed: number;
    failed: number;
    errors: number;
    missing_skills: number;
  }[];

  fetchedAt: string;
}

export async function GET() {
  try {
    const result = await withCache<TelemetryData>("telemetry", async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceISO = since.toISOString();

      // Fetch retrospectives and cost_log in parallel
      const [retroRes, costRes] = await Promise.all([
        supabase
          .from("session_retrospectives")
          .select(
            "id,session_id,created_at,summary,brief_ids_claimed,brief_ids_completed," +
            "brief_ids_failed,brief_ids_deferred,errors_encountered,skills_missing," +
            "skills_used,tools_used,tools_failed,stale_data_found," +
            "close_loop_violations,new_workflows,workflow_gaps," +
            "health_score,total_duration_minutes,token_usage_input," +
            "token_usage_output,api_cost_estimate"
          )
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("cost_log")
          .select(
            "id,created_at,agent,operation,model,estimated_cost_usd," +
            "input_tokens,output_tokens,client_slug"
          )
          .gte("created_at", sinceISO)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);

      if (retroRes.error) throw new Error(retroRes.error.message);
      if (costRes.error) throw new Error(costRes.error.message);

      const retros = (retroRes.data ?? []) as unknown as RetroRow[];
      const costs = (costRes.data ?? []) as unknown as CostRow[];

      // --- Session metrics ---
      const totalSessions = retros.length;
      const completedBriefs = retros.reduce(
        (sum, r) => sum + (r.brief_ids_completed?.length ?? 0), 0
      );
      const failedBriefs = retros.reduce(
        (sum, r) => sum + (r.brief_ids_failed?.length ?? 0), 0
      );
      const deferredBriefs = retros.reduce(
        (sum, r) => sum + (r.brief_ids_deferred?.length ?? 0), 0
      );
      const healthScores = retros
        .map((r) => r.health_score)
        .filter((s): s is number => s !== null);
      const avgHealthScore =
        healthScores.length > 0
          ? Math.round(
              (healthScores.reduce((a, b) => a + b, 0) / healthScores.length) * 10
            ) / 10
          : null;

      // --- Error analysis ---
      const errorCounts = new Map<string, number>();
      for (const r of retros) {
        for (const err of r.errors_encountered ?? []) {
          const key = typeof err === "string" ? err : JSON.stringify(err).slice(0, 80);
          errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
        }
      }
      const topErrors = Array.from(errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const toolFailCounts = new Map<string, number>();
      for (const r of retros) {
        for (const tf of r.tools_failed ?? []) {
          const key = typeof tf === "string" ? tf : (tf as Record<string, unknown>).tool as string ?? JSON.stringify(tf).slice(0, 50);
          toolFailCounts.set(key, (toolFailCounts.get(key) ?? 0) + 1);
        }
      }
      const topFailedTools = Array.from(toolFailCounts.entries())
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const sessionsWithErrors = retros.filter(
        (r) => (r.errors_encountered?.length ?? 0) > 0
      ).length;
      const errorRate = totalSessions > 0 ? sessionsWithErrors / totalSessions : 0;

      // --- Missing skills ---
      const skillCounts = new Map<string, number>();
      for (const r of retros) {
        for (const skill of r.skills_missing ?? []) {
          skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
        }
      }
      const topMissingSkills = Array.from(skillCounts.entries())
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // --- Cost breakdown ---
      const dailyMap = new Map<string, { cost: number; calls: number }>();
      const agentMap = new Map<string, { cost: number; calls: number; tokens: number }>();
      const clientMap = new Map<string, { cost: number; calls: number }>();

      for (const c of costs) {
        const date = c.created_at.slice(0, 10);
        const d = dailyMap.get(date) ?? { cost: 0, calls: 0 };
        d.cost += c.estimated_cost_usd ?? 0;
        d.calls += 1;
        dailyMap.set(date, d);

        const a = agentMap.get(c.agent) ?? { cost: 0, calls: 0, tokens: 0 };
        a.cost += c.estimated_cost_usd ?? 0;
        a.calls += 1;
        a.tokens += (c.input_tokens ?? 0) + (c.output_tokens ?? 0);
        agentMap.set(c.agent, a);

        const slug = c.client_slug || "internal";
        const cl = clientMap.get(slug) ?? { cost: 0, calls: 0 };
        cl.cost += c.estimated_cost_usd ?? 0;
        cl.calls += 1;
        clientMap.set(slug, cl);
      }

      const dailyCosts = Array.from(dailyMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const perAgentCost = Array.from(agentMap.entries())
        .map(([agent, v]) => ({ agent, ...v }))
        .sort((a, b) => b.cost - a.cost);

      const perClientCost = Array.from(clientMap.entries())
        .map(([client, v]) => ({ client, ...v }))
        .sort((a, b) => b.cost - a.cost);

      const totalCost = costs.reduce(
        (sum, c) => sum + (c.estimated_cost_usd ?? 0), 0
      );
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayCost = costs
        .filter((c) => c.created_at.startsWith(todayStr))
        .reduce((sum, c) => sum + (c.estimated_cost_usd ?? 0), 0);

      // --- Completion rate ---
      const totalAttempted = completedBriefs + failedBriefs;
      const completionRate =
        totalAttempted > 0 ? completedBriefs / totalAttempted : 0;

      // --- Recent sessions ---
      const recentSessions = retros.slice(0, 20).map((r) => ({
        session_id: r.session_id,
        created_at: r.created_at,
        summary: r.summary,
        health_score: r.health_score,
        completed: r.brief_ids_completed?.length ?? 0,
        failed: r.brief_ids_failed?.length ?? 0,
        errors: r.errors_encountered?.length ?? 0,
        missing_skills: r.skills_missing?.length ?? 0,
      }));

      return {
        totalSessions,
        completedBriefs,
        failedBriefs,
        deferredBriefs,
        avgHealthScore,
        errorRate,
        topErrors,
        topFailedTools,
        topMissingSkills,
        dailyCosts,
        perAgentCost,
        perClientCost,
        totalCost,
        todayCost,
        completionRate,
        recentSessions,
        fetchedAt: new Date().toISOString(),
      };
    });

    return jsonResponse(result.data, result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/telemetry]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
