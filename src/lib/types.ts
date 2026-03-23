// ── Workspace types ──────────────────────────────────────────────
export interface Workspace {
  slug: string;
  name: string;
  colour: string; // tailwind colour token e.g. "accent-cyan"
  description: string;
  icon: string; // text icon/emoji
  pinCount?: number;
}

// Static workspace definitions (root whiteboard cards)
export const WORKSPACES: Workspace[] = [
  {
    slug: "north-star",
    name: "North Star",
    colour: "accent-cyan",
    description: "Strategic goals, OKRs, and long-term vision",
    icon: "NS",
  },
  {
    slug: "r17",
    name: "R17 Ventures",
    colour: "accent-purple",
    description: "Client projects, briefs, and deliverables",
    icon: "R17",
  },
  {
    slug: "champion-grip",
    name: "Champion Grip",
    colour: "accent-green",
    description: "Product development and operations",
    icon: "CG",
  },
  {
    slug: "comms-hub",
    name: "Comms Hub",
    colour: "accent-yellow",
    description: "Unified communications across all platforms",
    icon: "CH",
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
