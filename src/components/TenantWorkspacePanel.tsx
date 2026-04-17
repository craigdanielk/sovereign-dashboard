"use client";

import { useEffect, useState, useCallback } from "react";
import { getStatusColour, getPriorityColour, getPlatformColour, withAlpha } from "@/lib/colours";

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkspaceTenant {
  id: string;
  slug: string;
  name: string;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  client_slug: string;
  project_id: string | null;
  created_at: string;
  wsjf_score: number | null;
  tags: string[] | null;
  brief_id: string | null;
}

interface Project {
  id: string;
  name: string;
}

interface CommRow {
  id: number;
  platform: string;
  subject: string | null;
  sent_at: string | null;
  from_address: string | null;
}

interface WorkspacePayload {
  tenant: WorkspaceTenant;
  projects: Project[];
  tasks: Task[];
  comms: CommRow[];
}

interface BriefDraft {
  task: Task;
  name: string;
  priority: string;
  description: string;
}

const KANBAN_COLS: { key: string; label: string }[] = [
  { key: "backlog",      label: "BACKLOG"      },
  { key: "open",         label: "OPEN"         },
  { key: "in_progress",  label: "IN PROGRESS"  },
  { key: "in_review",    label: "IN REVIEW"    },
  { key: "blocked",      label: "BLOCKED"      },
  { key: "complete",     label: "COMPLETE"     },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const TAG_COLOURS = [
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#db2777", // pink
];

function tagColour(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_COLOURS[hash % TAG_COLOURS.length];
}

function timeAgo(ts: string | null): string {
  if (!ts) return "--";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TaskKanbanCard({
  task,
  onConvert,
  onClick,
}: {
  task: Task;
  onConvert: (t: Task) => void;
  onClick: (t: Task) => void;
}) {
  const statusCol   = getStatusColour(task.status);
  const priorityCol = getPriorityColour(task.priority);
  const tags        = task.tags ?? [];

  return (
    <div
      className="relative px-2 py-1.5 rounded border border-border bg-bg-card hover:bg-bg-card-hover transition-colors cursor-pointer"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      onClick={() => onClick(task)}
    >
      {/* WSJF badge — top-right */}
      {task.wsjf_score !== null && task.wsjf_score !== undefined && (
        <span
          className="absolute top-1 right-1 text-[7px] font-bold px-1 py-px rounded"
          style={{ backgroundColor: withAlpha("#00ff41", 0.15), color: "#00ff41" }}
        >
          {Number.isInteger(task.wsjf_score)
            ? task.wsjf_score
            : task.wsjf_score.toFixed(1)}
        </span>
      )}

      <div className="flex items-start justify-between gap-1 mb-0.5 pr-6">
        <span
          className="text-[9px] font-bold shrink-0 mt-0.5"
          style={{ color: priorityCol }}
        >
          {task.priority}
        </span>
        <span className="text-[10px] text-text-primary flex-1 leading-tight line-clamp-2">
          {task.title}
        </span>
      </div>

      <div className="flex items-center justify-between gap-1 mt-1">
        <div className="flex items-center gap-1.5">
          {task.source && (
            <span
              className="text-[8px] px-1 py-px rounded"
              style={{
                color: getPlatformColour(task.source),
                backgroundColor: withAlpha(getPlatformColour(task.source), 0.15),
              }}
            >
              {task.source.toUpperCase()}
            </span>
          )}
          <span
            className="text-[8px] font-bold"
            style={{ color: statusCol }}
          >
            {task.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-text-muted">{timeAgo(task.created_at)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onConvert(task); }}
            className="text-[8px] px-1.5 py-px rounded border transition-colors"
            style={{
              color: "#00ff41",
              borderColor: "#00ff41",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = withAlpha("#00ff41", 0.12);
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
          >
            → BRIEF
          </button>
        </div>
      </div>

      {/* Tags chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5 mt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[7px] px-1 py-px rounded"
              style={{
                color: tagColour(tag),
                backgroundColor: withAlpha(tagColour(tag), 0.15),
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefModal({
  draft,
  onClose,
  onConfirm,
  submitting,
}: {
  draft: BriefDraft;
  onClose: () => void;
  onConfirm: (d: BriefDraft) => void;
  submitting: boolean;
}) {
  const [name, setName]     = useState(draft.name);
  const [priority, setPriority] = useState(draft.priority);
  const [description, setDescription] = useState(draft.description);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded border p-4 space-y-3"
        style={{
          backgroundColor: "#0a0a0a",
          borderColor: "#00ff41",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold" style={{ color: "#00ff41" }}>
            CONVERT TO BRIEF
          </span>
          <button
            onClick={onClose}
            className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <div>
            <label className="block text-[9px] text-text-muted mb-0.5">BRIEF NAME</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:outline-none focus:border-[#00ff41] transition-colors"
              style={{ fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label className="block text-[9px] text-text-muted mb-0.5">PRIORITY</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-transparent border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:outline-none focus:border-[#00ff41] transition-colors"
              style={{ fontFamily: "inherit" }}
            >
              {["P0", "P1", "P2", "P3"].map((p) => (
                <option key={p} value={p} style={{ backgroundColor: "#0a0a0a" }}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-text-muted mb-0.5">DESCRIPTION</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-transparent border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:outline-none focus:border-[#00ff41] transition-colors resize-none"
              style={{ fontFamily: "inherit" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <span className="text-[8px] text-text-muted flex-1">
            ⚠ HITL gate — Craig will be notified before insert
          </span>
          <button
            onClick={onClose}
            className="text-[9px] px-2 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors"
            style={{ fontFamily: "inherit" }}
          >
            CANCEL
          </button>
          <button
            onClick={() => onConfirm({ ...draft, name, priority, description })}
            disabled={submitting || !name.trim()}
            className="text-[9px] px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              color: "#00ff41",
              borderColor: "#00ff41",
              fontFamily: "inherit",
            }}
          >
            {submitting ? "QUEUING…" : "QUEUE BRIEF"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TenantWorkspacePanelProps {
  tenantId: string | null;
}

export default function TenantWorkspacePanel({ tenantId }: TenantWorkspacePanelProps) {
  const [payload, setPayload]           = useState<WorkspacePayload | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [draft, setDraft]               = useState<BriefDraft | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const effectiveTenantId = tenantId === null || tenantId === "all" ? "all" : tenantId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspace?tenant_id=${encodeURIComponent(effectiveTenantId)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: WorkspacePayload = await res.json();
      setPayload(data);
      // Auto-select first project if none selected
      if (!activeProjectId && data.projects?.length > 0) {
        setActiveProjectId(data.projects[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [effectiveTenantId, activeProjectId]);

  // Reset project selection when tenant changes
  useEffect(() => {
    setActiveProjectId(null);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  function openConvertModal(task: Task) {
    const slug = slugify(task.title);
    setDraft({
      task,
      name: `BRIEF::${slug}::${today()}`,
      priority: task.priority || "P1",
      description: task.description || task.title,
    });
  }

  async function handleQueueBrief(d: BriefDraft) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspace/create-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id:     d.task.id,
          tenant_id:   effectiveTenantId,
          title:       d.name,
          description: d.description,
          priority:    d.priority,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setDraft(null);
      setToast("BRIEF queued — HITL approval pending");
      setTimeout(() => setToast(null), 4000);
      load();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Queue failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  const mono: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: "#0a0a0a",
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40" style={mono}>
        <span className="text-[10px] text-text-muted animate-pulse">LOADING WORKSPACE…</span>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2" style={mono}>
        <span className="text-[10px] text-accent-red">{error || "No data"}</span>
        <button
          onClick={load}
          className="text-[9px] px-2 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors"
          style={{ fontFamily: "inherit" }}
        >
          RETRY
        </button>
      </div>
    );
  }

  const { tenant, projects = [], tasks, comms } = payload;
  const filteredTasks = activeProjectId
    ? tasks.filter((t) => t.project_id === activeProjectId)
    : tasks;
  const tasksByCol = KANBAN_COLS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.key] = filteredTasks
      .filter((t) => t.status === col.key)
      .sort((a, b) => {
        if (a.wsjf_score !== null && b.wsjf_score !== null) return b.wsjf_score - a.wsjf_score;
        if (a.wsjf_score !== null) return -1;
        if (b.wsjf_score !== null) return 1;
        return 0;
      });
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={mono}>

      {/* Header */}
      <div
        className="shrink-0 px-3 py-1.5 border-b border-border flex items-center justify-between"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-muted font-bold tracking-wider">WORKSPACE</span>
          <span className="text-[10px] font-bold" style={{ color: "#00ff41" }}>
            {tenant.name.toUpperCase()}
          </span>
          <span className="text-[9px] text-text-muted">{tenant.slug}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-text-muted">{filteredTasks.length} tasks</span>
          <button
            onClick={load}
            className="text-[9px] text-text-muted hover:text-text-primary transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Project tabs */}
      {projects.length > 1 && (
        <div
          className="shrink-0 flex items-center gap-1 px-3 py-1 border-b border-border overflow-x-auto"
          style={{ backgroundColor: "#0a0a0a" }}
        >
          <button
            onClick={() => setActiveProjectId(null)}
            style={{
              fontSize: 10,
              padding: "3px 8px",
              borderRadius: 4,
              border: !activeProjectId ? "1px solid #2A2A2A" : "1px solid transparent",
              background: !activeProjectId ? "#1A1A1A" : "transparent",
              color: !activeProjectId ? "#C4C4C4" : "#525252",
              cursor: "pointer",
              fontWeight: !activeProjectId ? 600 : 400,
              whiteSpace: "nowrap",
            }}
          >
            All ({tasks.length})
          </button>
          {projects.map((p) => {
            const isActive = activeProjectId === p.id;
            const count = tasks.filter((t) => t.project_id === p.id).length;
            const label = p.name
              .replace(` — Default Project`, "")
              .replace(` -- Default Project`, "")
              .replace(tenant.name, "").trim()
              || p.name;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                style={{
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: isActive ? "1px solid #2A2A2A" : "1px solid transparent",
                  background: isActive ? "#1A1A1A" : "transparent",
                  color: isActive ? "#C4C4C4" : "#525252",
                  cursor: "pointer",
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Kanban board */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        <div className="text-[9px] text-text-muted font-bold tracking-wider mb-1.5 px-1">
          TASK BOARD
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {KANBAN_COLS.map((col) => {
            const colTasks = tasksByCol[col.key] || [];
            const colColor = getStatusColour(col.key);
            return (
              <div key={col.key} className="flex flex-col min-h-0">
                {/* Column header */}
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded mb-1 border-b"
                  style={{ borderColor: withAlpha(colColor, 0.4) }}
                >
                  <span
                    className="text-[8px] font-bold tracking-wider"
                    style={{ color: colColor }}
                  >
                    {col.label}
                  </span>
                  <span
                    className="text-[8px] ml-auto"
                    style={{ color: withAlpha(colColor, 0.7) }}
                  >
                    {colTasks.length}
                  </span>
                </div>

                {/* Task cards */}
                <div className="space-y-1">
                  {colTasks.map((task) => (
                    <TaskKanbanCard
                      key={task.id}
                      task={task}
                      onConvert={openConvertModal}
                      onClick={setSelectedTask}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="px-1.5 py-2 text-[8px] text-text-muted text-center border border-dashed border-border rounded">
                      —
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="shrink-0 mx-2 border-t border-border my-1" />

      {/* Comms subpanel */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        <div className="text-[9px] text-text-muted font-bold tracking-wider mb-1.5 px-1">
          COMMS INBOX
          <span className="ml-2 font-normal">{comms.length} messages</span>
        </div>

        {comms.length === 0 ? (
          <div className="text-[9px] text-text-muted text-center py-4 border border-dashed border-border rounded">
            No inbound comms for this tenant
          </div>
        ) : (
          <div className="space-y-0.5">
            {comms.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2 px-2 py-1 rounded border border-border bg-bg-card hover:bg-bg-card-hover transition-colors"
              >
                <span
                  className="text-[8px] font-bold shrink-0 w-14 truncate"
                  style={{ color: getPlatformColour(row.platform || "") }}
                >
                  {(row.platform || "?").toUpperCase()}
                </span>
                <span className="text-[9px] text-text-primary flex-1 truncate">
                  {row.subject || "(no subject)"}
                </span>
                <span className="text-[8px] text-text-muted shrink-0">
                  {timeAgo(row.sent_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convert to BRIEF modal */}
      {draft && (
        <BriefModal
          draft={draft}
          onClose={() => setDraft(null)}
          onConfirm={handleQueueBrief}
          submitting={submitting}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded border text-[10px]"
          style={{
            backgroundColor: "#0a0a0a",
            borderColor: "#00ff41",
            color: "#00ff41",
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
