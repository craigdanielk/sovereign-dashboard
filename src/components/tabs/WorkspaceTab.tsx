"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useTenant, NORTH_STAR_ID } from "@/lib/tenant-context";

// ── Types ────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  slug: string;
  name: string;
  tenant_id: string;
  workspace_type: string;
}

interface Task {
  id: string;
  workspace_id: string;
  client_slug: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  source_id: string | null;
  wsjf_score: number | null;
  business_value: number | null;
  time_criticality: number | null;
  system_leverage: number | null;
  job_size: number | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Constants ────────────────────────────────────────────────────

const KANBAN_COLS = [
  { key: "TODO",        label: "TO DO",       color: "#4B4B6B" },
  { key: "IN_PROGRESS", label: "IN PROGRESS", color: "#F59E0B" },
  { key: "BRIEF_READY", label: "BRIEF READY", color: "#7C3AED" },
  { key: "DONE",        label: "DONE",        color: "#10B981" },
] as const;

const SOURCE_COLOURS: Record<string, string> = {
  "brief-failure": "#EF4444",
  "conversation":  "#7C3AED",
  "email":         "#3B82F6",
  "whatsapp":      "#10B981",
  "manual":        "#6B7280",
};

function sourceColour(s: string | null): string {
  return SOURCE_COLOURS[s ?? ""] ?? "#6B7280";
}

function timeAgo(ts: string | null): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// Promotion: wsjf_score >= 5 or no score but high business_value
function isPromotable(task: Task): boolean {
  if (task.wsjf_score != null) return task.wsjf_score >= 5;
  return (task.business_value ?? 0) >= 6;
}

// ── TaskCard ─────────────────────────────────────────────────────

function TaskCard({ task, selected, onClick }: { task: Task; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="rounded border p-2.5 cursor-pointer transition-all"
      style={{
        background: selected ? "#1A1237" : "#111111",
        borderColor: selected ? "#7C3AED" : "#1E1E1E",
      }}
    >
      <div className="text-[10px] font-medium text-[#E5E5E5] leading-snug mb-1.5">
        {task.title}
      </div>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          {task.source && (
            <span
              className="text-[8px] font-bold px-1 py-0.5 rounded"
              style={{ color: sourceColour(task.source), background: `${sourceColour(task.source)}22` }}
            >
              {task.source.toUpperCase()}
            </span>
          )}
          {task.wsjf_score != null && (
            <span className="text-[8px] font-mono text-[#555555]">
              W:{task.wsjf_score.toFixed(1)}
            </span>
          )}
        </div>
        <span className="text-[8px] text-[#333333]">{timeAgo(task.created_at)}</span>
      </div>
      {isPromotable(task) && task.status !== "BRIEF_READY" && task.status !== "DONE" && (
        <div className="mt-1 flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-[#7C3AED] animate-pulse" />
          <span className="text-[8px] text-[#7C3AED]">ready to promote</span>
        </div>
      )}
    </div>
  );
}

// ── TaskDetailPanel ───────────────────────────────────────────────

function TaskDetailPanel({
  task,
  onClose,
  onRefresh,
}: {
  task: Task;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgCount = messages.filter((m) => m.role === "user").length;

  useEffect(() => {
    // Seed system context when task changes
    setMessages([{
      id: "sys-0",
      role: "assistant",
      content: `Task context loaded: **${task.title}**\n\nSource: ${task.source ?? "unknown"} | WSJF: ${task.wsjf_score?.toFixed(1) ?? "N/A"} | Client: ${task.client_slug}\n\nHow can I help plan this task?`,
    }]);
    setInput("");
  }, [task.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: text };
    const asstId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { id: asstId, role: "assistant", content: "" }]);

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role !== "assistant" || m.content !== "")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/genesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          systemPrompt: `You are a planning assistant. Task: "${task.title}". Description: ${task.description ?? "none"}. Client: ${task.client_slug}. Help plan execution for this task.`,
        }),
      });

      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === asstId ? { ...m, content: buf } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === asstId ? { ...m, content: "[Error — genesis API unavailable]" } : m)
      );
    } finally {
      setSending(false);
    }
  }

  async function handlePromote() {
    setPromoting(true);
    try {
      const res = await fetch("/api/promote-task-to-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(`BRIEF #${json.brief_id} queued — ${json.name}`);
        onRefresh();
        onClose();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } finally {
      setPromoting(false);
    }
  }

  const promotable = isPromotable(task);

  return (
    <div
      className="flex flex-col flex-shrink-0 border-l"
      style={{ width: 380, background: "#0D0D0D", borderColor: "#1E1E1E" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b"
        style={{ height: 40, borderColor: "#1E1E1E" }}
      >
        <span className="text-[10px] font-bold tracking-widest uppercase text-[#7C3AED]">
          Task Detail
        </span>
        <button onClick={onClose} className="text-[#333333] hover:text-[#666666] transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Metadata */}
      <div className="flex-shrink-0 px-4 py-3 border-b space-y-2" style={{ borderColor: "#1E1E1E" }}>
        <div className="text-[11px] font-semibold text-[#E5E5E5] leading-snug">{task.title}</div>
        <div className="flex flex-wrap items-center gap-2">
          {task.source && (
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: sourceColour(task.source), background: `${sourceColour(task.source)}22` }}
            >
              {task.source.toUpperCase()}
            </span>
          )}
          <span className="text-[8px] font-mono text-[#444444]">{task.priority}</span>
          {task.wsjf_score != null && (
            <span className="text-[8px] font-mono text-[#444444]">WSJF {task.wsjf_score.toFixed(1)}</span>
          )}
          <span className="text-[8px] text-[#333333]">{task.client_slug}</span>
        </div>
        {task.description && (
          <p className="text-[10px] text-[#555555] leading-relaxed line-clamp-3">{task.description}</p>
        )}
        {/* Research signals counter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[8px] font-mono text-[#333333]">{msgCount} signals</span>
          </div>
          {promotable && task.status !== "BRIEF_READY" && task.status !== "DONE" && (
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-[#7C3AED]" />
              <span className="text-[8px] text-[#7C3AED]">threshold met</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar"
        style={{ minHeight: 0 }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-[10px] leading-relaxed px-2.5 py-2 rounded ${
              m.role === "user"
                ? "bg-[#1A1237] text-[#C4B5FD] ml-4"
                : "bg-[#111111] text-[#888888] mr-4 border border-[#1E1E1E]"
            }`}
          >
            {m.content || <span className="animate-pulse">▊</span>}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t p-3 space-y-2" style={{ borderColor: "#1E1E1E" }}>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#111111] border border-[#1E1E1E] rounded px-2.5 py-1.5 text-[10px] text-[#E5E5E5] outline-none focus:border-[#7C3AED44]"
            placeholder="Plan this task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-2.5 py-1 text-[9px] font-bold tracking-widest border border-[#2A2A2A] text-[#444444] hover:text-[#7C3AED] hover:border-[#7C3AED44] rounded transition-all disabled:opacity-30"
          >
            {sending ? "..." : "SEND"}
          </button>
        </div>

        {/* Promote */}
        {promotable && task.status !== "BRIEF_READY" && task.status !== "DONE" && (
          <button
            onClick={handlePromote}
            disabled={promoting}
            className="w-full py-1.5 text-[9px] font-bold tracking-widest border border-[#7C3AED44] text-[#7C3AED] rounded hover:bg-[#7C3AED11] transition-all disabled:opacity-40"
          >
            {promoting ? "QUEUING BRIEF..." : "→ PROMOTE TO BRIEF"}
          </button>
        )}
      </div>

      {toast && (
        <div className="absolute bottom-4 right-4 bg-[#141414] border border-[#10B981] text-[#10B981] text-[10px] px-3 py-2 rounded z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── WorkspaceTab ──────────────────────────────────────────────────

export default function WorkspaceTab() {
  const { activeTenant, activeTenantIds } = useTenant();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset board when tenant changes
  useEffect(() => {
    setSelectedTask(null);
    setTasks([]);
  }, [activeTenant]);

  // Fetch workspaces for the active tenant by tenant_id + type
  useEffect(() => {
    async function load() {
      if (!activeTenant) return;
      const { data } = await supabase
        .from("workspaces")
        .select("id, slug, name, tenant_id, workspace_type")
        .eq("tenant_id", activeTenant)
        .eq("workspace_type", "ops")
        .order("name");
      if (!data || data.length === 0) return;
      const list = data as Workspace[];
      setWorkspaces(list);
      setSelectedWs(list[0]);
    }
    load();
  }, [activeTenant]);

  const fetchTasks = useCallback(async () => {
    if (!activeTenant || activeTenantIds.length === 0) return;
    setLoading(true);
    // Query across the full subtree: active tenant + all descendants
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .in("tenant_id", activeTenantIds)
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }, [activeTenant, activeTenantIds]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime: subscribe to tasks for this tenant
  useEffect(() => {
    if (!activeTenant) return;

    // Supabase realtime only supports single-value filters — subscribe broadly,
    // fetchTasks re-queries with the full activeTenantIds array
    const ch = supabase.channel("workspace-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks)
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeTenant, fetchTasks]);

  const tasksByCol = KANBAN_COLS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) =>
      col.key === "BRIEF_READY"
        ? t.status === "BRIEF_READY" || t.status === "BRIEF_QUEUED"
        : t.status === col.key
    );
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#111111]">
      {/* Workspace switcher header */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 border-b"
        style={{ height: 40, borderColor: "#1E1E1E" }}
      >
        <span className="text-[10px] font-bold tracking-widest uppercase text-[#333333]">
          Workspace
        </span>
        <div className="flex gap-1.5">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { setSelectedWs(ws); setSelectedTask(null); }}
              className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded border transition-all"
              style={{
                borderColor: selectedWs?.id === ws.id ? "#7C3AED" : "#1E1E1E",
                color: selectedWs?.id === ws.id ? "#7C3AED" : "#444444",
                background: selectedWs?.id === ws.id ? "#7C3AED11" : "transparent",
              }}
            >
              {ws.name.toUpperCase()}
            </button>
          ))}
          {workspaces.length === 0 && (
            <span className="text-[9px] text-[#333333]">No workspaces</span>
          )}
        </div>
        {loading && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" />}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
          <div className="flex gap-2.5 h-full" style={{ minWidth: "max-content" }}>
            {KANBAN_COLS.map((col) => {
              const colTasks = tasksByCol[col.key] ?? [];
              return (
                <div
                  key={col.key}
                  className="flex flex-col rounded border"
                  style={{ width: 220, background: "#0D0D0D", borderColor: "#1E1E1E" }}
                >
                  {/* Column header */}
                  <div
                    className="flex-shrink-0 flex items-center justify-between px-2.5 py-2 border-b"
                    style={{ borderColor: "#1E1E1E" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                      <span className="text-[9px] font-bold tracking-widest" style={{ color: col.color }}>
                        {col.label}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#333333] font-mono">{colTasks.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selected={selectedTask?.id === task.id}
                        onClick={() => setSelectedTask((t) => t?.id === task.id ? null : task)}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-center text-[9px] text-[#222222] py-6">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane */}
        {selectedTask && (
          <TaskDetailPanel
            key={selectedTask.id}
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onRefresh={fetchTasks}
          />
        )}
      </div>
    </div>
  );
}
