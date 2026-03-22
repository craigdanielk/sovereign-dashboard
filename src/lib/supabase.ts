import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_KEY;
    if (!url || !key) {
      throw new Error("Supabase env vars not set");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// Proxy that lazily initializes — avoids crash during Next.js static build
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
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
  payload: Record<string, unknown> | null;
  wsjf_score: number | null;
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
}
