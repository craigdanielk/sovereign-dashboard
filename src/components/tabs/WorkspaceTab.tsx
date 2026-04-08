"use client";

import { useEffect, useState, useCallback } from "react";
import { getStatusColour, getPriorityColour, getPlatformColour, withAlpha } from "@/lib/colours";

// ── Types ────────────────────────────────────────────────────────

interface WorkspaceInfo {
  id: string;
  slug: string;
  name: string;
  color: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  source: string | null;
  created_at: string;
  updated_at: string | null;
}

interface CommRow {
  id: string;
  platform: string;
  subject: string;
  body_preview: string;
  contact_name: string;
  sent_at: string;
  status: string;
  direction: string;
}

interface TenantSwitcherItem {
  id: string;
  slug: string;
  name: string;
}

interface BriefDraft {
  taskId: string;
  title: string;
  description: string;
  priority: string;
}

// ── Constants ────────────────────────────────────────────────────

const KANBAN_COLUMNS = ["TODO", "IN_PROGRESS", "DONE", "BRIEF_QUEUED"] as const;
type KanbanStatus = (typeof KANBAN_COLUMNS)[number];

const COLUMN_LABELS: Record<KanbanStatus, string> = {
  TODO: "TO DO",
  IN_PROGRESS: "IN PROGRESS",
  DONE: "DONE",
  BRIEF_QUEUED: "BRIEF QUEUED",
};

// ── TenantWorkspacePanel ─────────────────────────────────────────

interface TenantWorkspacePanelProps {
  workspaceId: string;
}

function TenantWorkspacePanel({ workspaceId }: TenantWorkspacePanelProps) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [comms, setComms] = useState<CommRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefDraft, setBriefDraft] = useState<BriefDraft | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace?workspace_id=${encodeURIComponent(workspaceId)}`);
      if (!res.ok) return;
      const json = await res.json();
      setWorkspace(json.workspace ?? null);
      setTasks(json.tasks ?? []);
      setComms(json.comms ?? []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openBriefModal(task: TaskRow) {
    setBriefDraft({
      taskId: task.id,
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
    });
  }

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  async function handleQueueBrief() {
    if (!briefDraft || !workspace) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/workspace/create-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspace.id,
          task_id: briefDraft.taskId,
          title: briefDraft.title,
          description: briefDraft.description,
          priority: briefDraft.priority,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setBriefDraft(null);
        showToast(`BRIEF queued: ${json.name}`);
      } else {
        showToast(`Error: ${json.error}`);
      }
    } finally {
      setSubmitting(false);
    }
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

  const tasksByStatus = KANBAN_COLUMNS.reduce<Record<KanbanStatus, TaskRow[]>>(
    (acc, col) => {
      acc[col] = tasks.filter((t) => t.status === col);
      return acc;
    },
    { TODO: [], IN_PROGRESS: [], DONE: [], BRIEF_QUEUED: [] }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <span className="text-[10px] text-text-muted animate-pulse">LOADING WORKSPACE...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-2">
        <div className="flex gap-2 h-full min-w-max">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col];
            return (
              <div
                key={col}
                className="flex flex-col w-56 shrink-0 bg-bg-card rounded border border-border"
              >
                {/* Column header */}
                <div className="px-2.5 py-1.5 border-b border-border flex items-center justify-between">
                  <span className="text-[9px] font-bold tracking-wider text-text-muted">
                    {COLUMN_LABELS[col]}
                  </span>
                  <span className="text-[9px] text-text-muted">{colTasks.length}</span>
                </div>

                {/* Task cards */}
                <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onConvertToBrief={openBriefModal}
                      timeAgo={timeAgo}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-[9px] text-text-muted text-center py-4">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comms subpanel */}
      <div className="shrink-0 border-t border-border">
        <div className="px-3 py-1.5 flex items-center gap-2 border-b border-border">
          <span className="text-[9px] font-bold tracking-wider text-text-muted">COMMS</span>
          <span className="text-[9px] text-text-muted">{comms.length}</span>
        </div>
        {comms.length === 0 ? (
          <p className="text-[10px] text-text-muted text-center py-4">No communications</p>
        ) : (
          <div className="overflow-y-auto max-h-36 divide-y divide-border">
            {comms.map((c) => (
              <div key={c.id} className="px-3 py-1.5 flex items-center gap-3 hover:bg-bg-card-hover">
                <span
                  className="text-[9px] font-bold shrink-0 w-12"
                  style={{ color: getPlatformColour(c.platform) }}
                >
                  {c.platform.toUpperCase()}
                </span>
                <span className="text-[10px] text-text-primary flex-1 truncate">{c.subject}</span>
                {c.contact_name && (
                  <span className="text-[9px] text-text-muted shrink-0">{c.contact_name}</span>
                )}
                <span className="text-[9px] text-text-muted shrink-0">{timeAgo(c.sent_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convert-to-BRIEF modal */}
      {briefDraft && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-bg-secondary border border-border rounded w-96 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-accent-green">
                QUEUE BRIEF
              </span>
              <button
                onClick={() => setBriefDraft(null)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[9px] text-text-muted block mb-0.5">TITLE</label>
                <input
                  className="w-full bg-bg-card border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:border-accent-green outline-none"
                  value={briefDraft.title}
                  onChange={(e) =>
                    setBriefDraft((d) => d && { ...d, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[9px] text-text-muted block mb-0.5">DESCRIPTION</label>
                <textarea
                  className="w-full bg-bg-card border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:border-accent-green outline-none resize-none"
                  rows={3}
                  value={briefDraft.description}
                  onChange={(e) =>
                    setBriefDraft((d) => d && { ...d, description: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-[9px] text-text-muted block mb-0.5">PRIORITY</label>
                <select
                  className="bg-bg-card border border-border rounded px-2 py-1 text-[10px] text-text-primary focus:border-accent-green outline-none"
                  value={briefDraft.priority}
                  onChange={(e) =>
                    setBriefDraft((d) => d && { ...d, priority: e.target.value })
                  }
                >
                  {["P0", "P1", "P2", "P3"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[9px] text-accent-yellow border border-accent-yellow/30 rounded px-2 py-1.5 bg-accent-yellow/5">
              HITL GATE — BRIEF will be created with status QUEUED and supervision_mode HITL.
              It will NOT auto-execute without manual approval.
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBriefDraft(null)}
                className="px-3 py-1 text-[10px] border border-border text-text-muted rounded hover:text-text-primary transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleQueueBrief}
                disabled={submitting || !briefDraft.title.trim()}
                className="px-3 py-1 text-[10px] border border-accent-green text-accent-green rounded hover:bg-accent-green/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "QUEUING..." : "QUEUE BRIEF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-bg-card border border-accent-green text-accent-green text-[10px] px-3 py-2 rounded z-50">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

// ── TaskCard (internal) ──────────────────────────────────────────

interface TaskCardInternalProps {
  task: TaskRow;
  onConvertToBrief: (task: TaskRow) => void;
  timeAgo: (ts: string | null) => string;
}

function TaskCard({ task, onConvertToBrief, timeAgo }: TaskCardInternalProps) {
  const priorityCol = getPriorityColour(task.priority);
  const statusCol = getStatusColour(task.status);

  return (
    <div className="bg-bg-primary rounded border border-border p-2 space-y-1 group">
      <div className="flex items-start gap-1.5">
        <span
          className="text-[9px] font-bold shrink-0 mt-0.5"
          style={{ color: priorityCol }}
        >
          {task.priority}
        </span>
        <span className="text-[10px] text-text-primary leading-snug flex-1">{task.title}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[9px] px-1 py-0.5 rounded"
            style={{ color: statusCol, backgroundColor: withAlpha(statusCol, 0.15) }}
          >
            {task.status}
          </span>
          {task.source && (
            <span className="text-[9px] text-text-muted">{task.source}</span>
          )}
        </div>
        <span className="text-[9px] text-text-muted">{timeAgo(task.created_at)}</span>
      </div>

      <button
        onClick={() => onConvertToBrief(task)}
        className="w-full text-[9px] py-0.5 border border-border text-text-muted rounded hover:border-accent-green hover:text-accent-green transition-colors opacity-0 group-hover:opacity-100"
      >
        → BRIEF
      </button>
    </div>
  );
}

// ── WorkspaceTab (exported) ──────────────────────────────────────

export default function WorkspaceTab() {
  const [tenants, setTenants] = useState<TenantSwitcherItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      setLoadingTenants(true);
      try {
        const res = await fetch("/api/workspace/tenants");
        if (!res.ok) return;
        const json = await res.json();
        const items: TenantSwitcherItem[] = json.workspaces ?? [];
        setTenants(items);
        if (items.length > 0) setSelectedId(items[0].id);
      } finally {
        setLoadingTenants(false);
      }
    }
    fetchTenants();
  }, []);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tenant switcher */}
      <div className="shrink-0 px-3 py-1.5 border-b border-border flex items-center gap-2 overflow-x-auto">
        <span className="text-[9px] text-text-muted font-bold tracking-wider shrink-0 mr-1">
          WORKSPACE
        </span>
        {loadingTenants ? (
          <span className="text-[9px] text-text-muted animate-pulse">Loading...</span>
        ) : (
          tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
                selectedId === t.id
                  ? "border-accent-green text-accent-green bg-accent-green/10"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-border-bright"
              }`}
            >
              {t.name}
            </button>
          ))
        )}
        {!loadingTenants && tenants.length === 0 && (
          <span className="text-[10px] text-text-muted">No workspaces configured</span>
        )}
      </div>

      {/* Panel */}
      {selectedId ? (
        <TenantWorkspacePanel workspaceId={selectedId} />
      ) : (
        <div className="flex items-center justify-center flex-1">
          <span className="text-[10px] text-text-muted">Select a workspace above</span>
        </div>
      )}
    </div>
  );
}
