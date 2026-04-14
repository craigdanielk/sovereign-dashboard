import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.warn(
        "Supabase env vars not set — running in degraded mode. " +
          `Missing: ${[!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean).join(", ")}`
      );
      return null;
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// No-op stub: any property access returns a chainable function that resolves to
// { data: null, error: { message: "Supabase not configured" } }.
// This prevents crashes when env vars are missing at runtime.
const NO_OP_RESULT = { data: null, error: { message: "Supabase not configured" } };

function createNoOpChain(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = (..._args: unknown[]): unknown => createNoOpChain();
  fn.then = (resolve: (v: unknown) => unknown) => Promise.resolve(NO_OP_RESULT).then(resolve);
  return new Proxy(fn, {
    get(_target, prop) {
      if (prop === "then") return fn.then;
      return fn;
    },
  });
}

// Proxy that lazily initializes — avoids crash during Next.js static build.
// Returns no-op stubs when env vars are missing instead of throwing.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      return createNoOpChain();
    }
    return (client as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export interface ExecutionLog {
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
  actual_outcome: string | null;
  duration_ms: number | null;
  error_type: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BriefPayload {
  node_1_trigger?: {
    event: string;
    context: string;
    decision: string;
  };
  node_2_context?: {
    constraints: string[];
    stakeholders: string[];
    current_state: {
      complete: string[];
      not_built: string[];
      in_progress: string[];
    };
  };
  node_3_deliverables?: {
    definition_of_done: string[];
    acceptance_criteria: string[];
    out_of_scope: string[];
  };
  node_4_system_map?: {
    core_systems: string[];
    data_sources: string[];
    access_required: string[];
    required_agents: string[];
    required_capabilities: string[];
  };
  node_5_gap_analysis?: {
    critical_gaps: string[];
    non_blocking_gaps: string[];
  };
  node_6_execution_plan?: {
    steps: Array<{
      step: number;
      action: string;
      agent: string;
    }>;
    routing: string;
    complexity: string;
    estimated_hours: number | null;
  };
  [key: string]: any;
}

export interface Brief {
  id: number;
  name: string;
  priority: string;
  status: string;
  triggered_by: string | null;
  blocked_by: number[] | null;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  claimed_by: string | null;
  failure_reason: string | null;
  summary: string | null;
  payload: BriefPayload | null;
  wsjf_score: number | null;
  quality_grade: string | null;
  tenant_id: string | null; // Added tenant_id
}

export interface SessionRetrospective {
  id: number;
  session_id: string;
  created_at: string;
  brief_ids_claimed: number[] | null;
  brief_ids_completed: number[] | null;
  brief_ids_failed: number[] | null;
  total_duration_minutes: number | null;
  tool_calls_count: number | null;
  tool_calls_by_type: Record<string, number> | null;
  summary: string | null;
  health_score: number | null;
  working_directory: string | null;
  files_modified: string[] | null;
  files_created: string[] | null;
  errors_encountered: Record<string, unknown> | null;
  false_assumptions: Record<string, unknown> | null;
  data_quality: string | null;
  retrospective_tag: Record<string, unknown> | null;
  api_cost_estimate: number | null;
  model_used: string | null;
}
