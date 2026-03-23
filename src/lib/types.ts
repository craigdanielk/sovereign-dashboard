// ── Tab definitions ─────────────────────────────────────────────
export interface TabDef {
  key: string;
  label: string;
  shortLabel: string;
  path: string;
}

export const TABS: TabDef[] = [
  { key: "root", label: "Root", shortLabel: "ROOT", path: "/" },
  { key: "north-star", label: "North Star", shortLabel: "NS", path: "/north-star" },
  { key: "battlefield", label: "Battlefield", shortLabel: "BF", path: "/battlefield" },
  { key: "recon", label: "RECON", shortLabel: "RCN", path: "/recon" },
  { key: "r17", label: "R17", shortLabel: "R17", path: "/r17" },
  { key: "comms", label: "Comms", shortLabel: "COM", path: "/comms" },
  { key: "artifacts", label: "Artifacts", shortLabel: "ART", path: "/artifacts" },
  { key: "command", label: "Command", shortLabel: "CMD", path: "/command" },
];

// ── Workspace types (Root tab cards) ────────────────────────────
export interface Workspace {
  slug: string;
  name: string;
  colour: string;
  description: string;
  icon: string;
  supabaseTable?: string;
  statusField?: string;
}

export const WORKSPACES: Workspace[] = [
  {
    slug: "north-star",
    name: "North Star",
    colour: "accent-green",
    description: "BRIEFs, agents, strategic goals",
    icon: "NS",
    supabaseTable: "briefs",
    statusField: "status",
  },
  {
    slug: "r17",
    name: "R17 Ventures",
    colour: "accent-purple",
    description: "Client projects and deliverables",
    icon: "R17",
    supabaseTable: "r17_briefs",
    statusField: "status",
  },
  {
    slug: "battlefield",
    name: "Battlefield",
    colour: "accent-cyan",
    description: "System graph, agents, workflows",
    icon: "BF",
    supabaseTable: "execution_log",
  },
  {
    slug: "comms",
    name: "Comms Hub",
    colour: "accent-yellow",
    description: "Unified communications inbox",
    icon: "CH",
    supabaseTable: "communications",
  },
];

// ── Data types for Supabase tables ──────────────────────────────
export interface WorkspacePin {
  id: number;
  workspace_slug: string;
  item_type: string;
  item_id: number;
  position: number;
  created_at: string;
}

export interface R17Brief {
  id: number;
  client_slug: string;
  client_name: string;
  name: string;
  status: string;
  priority: string;
  wsjf_score: number | null;
  created_at: string;
  updated_at: string | null;
  payload: Record<string, unknown> | null;
}

export interface Task {
  id: number;
  workspace_slug: string;
  title: string;
  status: string;
  priority: string;
  platform: string | null;
  assignee: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Communication {
  id: number;
  platform: string;
  sender: string;
  subject: string;
  preview: string;
  thread_id: string | null;
  client_slug: string | null;
  is_read: boolean;
  is_actioned: boolean;
  created_at: string;
}

export interface CommsThread {
  id: string;
  platform: string;
  subject: string;
  last_message_at: string;
  message_count: number;
  client_slug: string | null;
}

export interface Artifact {
  id: number;
  type: string;
  name: string;
  url: string | null;
  brief_id: number | null;
  workspace_slug: string | null;
  status: string | null;
  created_at: string;
}

export interface FeedSource {
  id: number;
  name: string;
  url: string | null;
  source_type: string;
  status: string;
  last_fetched_at: string | null;
  created_at: string;
}

export interface PatternDetection {
  id: number;
  feed_source_id: number | null;
  pattern_type: string;
  signal: string;
  confidence: number | null;
  client_slug: string | null;
  status: string;
  created_at: string;
  payload: Record<string, unknown> | null;
}

export interface Contact {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  platform: string | null;
  client_slug: string | null;
  created_at: string;
}

// ── Status/Priority colour maps ─────────────────────────────────
export const STATUS_COLOURS: Record<string, string> = {
  QUEUED: "accent-blue",
  CLAIMED: "accent-yellow",
  COMPLETED: "accent-green",
  FAILED: "accent-red",
  PENDING: "text-muted",
  SUPERSEDED: "accent-purple",
  IN_PROGRESS: "accent-yellow",
  DONE: "accent-green",
  BLOCKED: "accent-red",
  DRAFT: "text-muted",
  GO: "accent-green",
  GAP: "accent-yellow",
  SKIP: "accent-red",
};

export const PRIORITY_COLOURS: Record<string, string> = {
  P0: "accent-red",
  P1: "accent-yellow",
  P2: "accent-blue",
  P3: "text-muted",
};

export const PLATFORM_COLOURS: Record<string, string> = {
  gmail: "accent-red",
  slack: "accent-purple",
  monday: "accent-yellow",
  whatsapp: "accent-green",
  linkedin: "accent-blue",
  github: "text-primary",
};
