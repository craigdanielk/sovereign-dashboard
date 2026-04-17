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
  tenant_id: string;
  client_slug: string;
  slug: string | null;
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
  due_date: string | null;
  assigned_to: string | null;
  estimated_hours: number | null;
  created_at: string;
  updated_at: string | null;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Constants ────────────────────────────────────────────────────

const CANONICAL_STATUSES = [
  "backlog", "open", "in_progress", "in_review", "blocked", "complete", "cancelled",
] as const;

type TaskStatus = (typeof CANONICAL_STATUSES)[number];

const KANBAN_COLS = [
  { key: "backlog",     label: "BACKLOG",     color: "#4B4B6B" },
  { key: "open",        label: "OPEN",        color: "#6366F1" },
  { key: "in_progress", label: "IN PROGRESS", color: "#F59E0B" },
  { key: "in_review",   label: "IN REVIEW",   color: "#8B5CF6" },
  { key: "blocked",     label: "BLOCKED",     color: "#EF4444" },
  { key: "complete",    label: "COMPLETE",     color: "#10B981" },
  { key: "cancelled",   label: "CANCELLED",   color: "#6B7280" },
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

function TaskCard({
  task,
  selected,
  onClick,
  onStatusChange,
}: {
  task: Task;
  selected: boolean;
  onClick: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusOpen) return;
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusOpen]);

  const currentCol = KANBAN_COLS.find((c) => c.key === task.status);

  return (
    <div
      onClick={onClick}
      className="rounded border p-2.5 cursor-pointer transition-all"
      style={{
        background: selected ? "#1A1237" : "#111111",
        borderColor: selected ? "#7C3AED" : "#1E1E1E",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-medium text-[#E5E5E5] leading-snug flex-1 mr-1">
          {task.title}
        </div>
        {/* Status chip — click to change */}
        <div className="relative flex-shrink-0" ref={statusRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setStatusOpen((o) => !o); }}
            className="text-[7px] font-bold tracking-wider px-1.5 py-0.5 rounded border transition-all hover:brightness-125"
            style={{
              color: currentCol?.color ?? "#666",
              borderColor: `${currentCol?.color ?? "#666"}44`,
              background: `${currentCol?.color ?? "#666"}11`,
            }}
          >
            {currentCol?.label ?? task.status.toUpperCase()}
          </button>
          {statusOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-50 rounded border py-1 shadow-lg"
              style={{ background: "#1A1A1A", borderColor: "#2A2A2A", minWidth: 120 }}
            >
              {KANBAN_COLS.map((col) => (
                <button
                  key={col.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (col.key !== task.status) onStatusChange(task.id, col.key as TaskStatus);
                    setStatusOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1 text-[9px] font-medium hover:bg-[#222222] transition-colors flex items-center gap-1.5"
                  style={{ color: col.key === task.status ? col.color : "#888" }}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: col.color }} />
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>
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
      {isPromotable(task) && task.status !== "complete" && task.status !== "cancelled" && (
        <div className="mt-1 flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-[#7C3AED] animate-pulse" />
          <span className="text-[8px] text-[#7C3AED]">ready to promote</span>
        </div>
      )}
    </div>
  );
}

// ── TaskDetailPanel ───────────────────────────────────────────────

const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3", "P4"] as const;

function TaskDetailPanel({
  task,
  onClose,
  onRefresh,
  onStatusChange,
}: {
  task: Task;
  onClose: () => void;
  onRefresh: () => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgCount = messages.filter((m) => m.role === "user").length;

  // Editable fields
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? "");
  const [editAssignedTo, setEditAssignedTo] = useState(task.assigned_to ?? "");
  const [editHours, setEditHours] = useState(task.estimated_hours?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reset editable fields when task changes
  useEffect(() => {
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ?? "");
    setEditAssignedTo(task.assigned_to ?? "");
    setEditHours(task.estimated_hours?.toString() ?? "");
    setDirty(false);
  }, [task.id, task.title, task.description, task.priority, task.due_date, task.assigned_to, task.estimated_hours]);

  // Track dirty state
  useEffect(() => {
    const changed =
      editTitle !== task.title ||
      editDesc !== (task.description ?? "") ||
      editPriority !== task.priority ||
      editDueDate !== (task.due_date ?? "") ||
      editAssignedTo !== (task.assigned_to ?? "") ||
      editHours !== (task.estimated_hours?.toString() ?? "");
    setDirty(changed);
  }, [editTitle, editDesc, editPriority, editDueDate, editAssignedTo, editHours, task]);

  async function saveFields() {
    if (!dirty || saving) return;
    setSaving(true);
    const updates: Record<string, unknown> = {
      title: editTitle.trim() || task.title,
      description: editDesc.trim() || null,
      priority: editPriority,
      due_date: editDueDate || null,
      assigned_to: editAssignedTo.trim() || null,
      estimated_hours: editHours ? parseFloat(editHours) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (error) {
      showToast(`Save failed: ${error.message}`);
    } else {
      showToast("Saved");
      onRefresh();
    }
    setSaving(false);
  }

  useEffect(() => {
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

      {/* Editable metadata */}
      <div className="flex-shrink-0 px-4 py-3 border-b space-y-2 overflow-y-auto" style={{ borderColor: "#1E1E1E", maxHeight: 280 }}>
        {/* Title */}
        <input
          className="w-full bg-transparent text-[11px] font-semibold text-[#E5E5E5] leading-snug outline-none border-b border-transparent focus:border-[#7C3AED44] pb-0.5"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveFields}
        />

        {/* Status + Priority row */}
        <div className="flex items-center gap-2">
          <select
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[9px] text-[#888] px-1.5 py-0.5 outline-none focus:border-[#7C3AED44]"
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          >
            {KANBAN_COLS.map((col) => (
              <option key={col.key} value={col.key}>{col.label}</option>
            ))}
          </select>
          <select
            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[9px] text-[#888] px-1.5 py-0.5 outline-none focus:border-[#7C3AED44]"
            value={editPriority}
            onChange={(e) => { setEditPriority(e.target.value); }}
            onBlur={saveFields}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {task.source && (
            <span
              className="text-[8px] font-bold px-1.5 py-0.5 rounded"
              style={{ color: sourceColour(task.source), background: `${sourceColour(task.source)}22` }}
            >
              {task.source.toUpperCase()}
            </span>
          )}
          {task.wsjf_score != null && (
            <span className="text-[8px] font-mono text-[#444444]">WSJF {task.wsjf_score.toFixed(1)}</span>
          )}
        </div>

        {/* Description */}
        <textarea
          className="w-full bg-[#0D0D0D] border border-[#1E1E1E] rounded text-[10px] text-[#888] leading-relaxed px-2 py-1.5 outline-none focus:border-[#7C3AED44] resize-none"
          rows={2}
          placeholder="Description..."
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onBlur={saveFields}
        />

        {/* Due date, Assigned to, Estimated hours */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[8px] text-[#444] uppercase tracking-wider block mb-0.5">Due</label>
            <input
              type="date"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[9px] text-[#888] px-1.5 py-0.5 outline-none focus:border-[#7C3AED44]"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              onBlur={saveFields}
            />
          </div>
          <div>
            <label className="text-[8px] text-[#444] uppercase tracking-wider block mb-0.5">Assigned</label>
            <input
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[9px] text-[#888] px-1.5 py-0.5 outline-none focus:border-[#7C3AED44]"
              placeholder="—"
              value={editAssignedTo}
              onChange={(e) => setEditAssignedTo(e.target.value)}
              onBlur={saveFields}
            />
          </div>
          <div>
            <label className="text-[8px] text-[#444] uppercase tracking-wider block mb-0.5">Est. hrs</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded text-[9px] text-[#888] px-1.5 py-0.5 outline-none focus:border-[#7C3AED44]"
              placeholder="—"
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
              onBlur={saveFields}
            />
          </div>
        </div>

        {/* Save button + signals */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-[8px] font-mono text-[#333333]">{msgCount} signals</span>
            </div>
            {promotable && task.status !== "complete" && task.status !== "cancelled" && (
              <div className="flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-[#7C3AED]" />
                <span className="text-[8px] text-[#7C3AED]">threshold met</span>
              </div>
            )}
          </div>
          {dirty && (
            <button
              onClick={saveFields}
              disabled={saving}
              className="text-[8px] font-bold tracking-wider px-2 py-0.5 rounded border border-[#10B98144] text-[#10B981] hover:bg-[#10B98111] transition-all disabled:opacity-40"
            >
              {saving ? "SAVING..." : "SAVE"}
            </button>
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
        {promotable && task.status !== "complete" && task.status !== "cancelled" && (
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
    if (!activeTenant) return;
    setLoading(true);
    // Query by exact tenant_id — each tenant shows only its own tasks.
    // Sub-tenant tasks are viewed by selecting that sub-tenant in the switcher.
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("tenant_id", activeTenant)
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }, [activeTenant]);

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

  const handleStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    if (selectedTask?.id === taskId) setSelectedTask((t) => t ? { ...t, status: newStatus } : t);

    const { error } = await supabase
      .from("tasks")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (error) {
      console.error("[status-change] failed:", error);
      fetchTasks(); // revert on error
    }
  }, [fetchTasks, selectedTask?.id]);

  const tasksByCol = KANBAN_COLS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.key] = tasks.filter((t) => t.status === col.key);
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
                        onStatusChange={handleStatusChange}
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
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}
