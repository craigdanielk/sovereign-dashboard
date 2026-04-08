// Linear-style design system colour values
// Maps to theme tokens in globals.css

export const COLOUR_VALUES: Record<string, string> = {
  // Accent
  "accent": "#7C3AED",
  "accent-hover": "#6D28D9",

  // Status (muted, not neon)
  "accent-green": "#10B981",
  "accent-green-dim": "#059669",
  "accent-lime": "#10B981",
  "accent-yellow": "#F59E0B",
  "accent-red": "#EF4444",
  "accent-blue": "#6366F1",
  "accent-purple": "#7C3AED",
  "accent-cyan": "#6366F1",
  "accent-orange": "#F59E0B",

  // Text
  "text-primary": "#E5E5E5",
  "text-secondary": "#A0A0A0",
  "text-muted": "#6B6B6B",
  "text-tertiary": "#6B6B6B",

  // Status semantic
  "status-todo": "#6B6B6B",
  "status-progress": "#F59E0B",
  "status-done": "#10B981",
  "status-cancelled": "#EF4444",
  "status-blocked": "#EF4444",

  // Priority
  "priority-urgent": "#EF4444",
  "priority-high": "#F59E0B",
  "priority-medium": "#6366F1",
  "priority-low": "#6B6B6B",
};

export function getStatusColour(status: string): string {
  const map: Record<string, string> = {
    QUEUED: COLOUR_VALUES["accent-blue"],
    CLAIMED: COLOUR_VALUES["accent-yellow"],
    COMPLETED: COLOUR_VALUES["accent-green"],
    FAILED: COLOUR_VALUES["accent-red"],
    PENDING: COLOUR_VALUES["text-muted"],
    SUPERSEDED: COLOUR_VALUES["accent-purple"],
    IN_PROGRESS: COLOUR_VALUES["accent-yellow"],
    DONE: COLOUR_VALUES["accent-green"],
    BLOCKED: COLOUR_VALUES["accent-red"],
    DRAFT: COLOUR_VALUES["text-muted"],
    GO: COLOUR_VALUES["accent-green"],
    GAP: COLOUR_VALUES["accent-yellow"],
    SKIP: COLOUR_VALUES["accent-red"],
  };
  return map[status] || COLOUR_VALUES["text-muted"];
}

export function getPriorityColour(priority: string): string {
  const map: Record<string, string> = {
    P0: COLOUR_VALUES["priority-urgent"],
    P1: COLOUR_VALUES["priority-high"],
    P2: COLOUR_VALUES["priority-medium"],
    P3: COLOUR_VALUES["priority-low"],
  };
  return map[priority] || COLOUR_VALUES["text-muted"];
}

export function getPlatformColour(platform: string): string {
  const map: Record<string, string> = {
    gmail: COLOUR_VALUES["accent-red"],
    slack: COLOUR_VALUES["accent-purple"],
    monday: COLOUR_VALUES["accent-yellow"],
    whatsapp: COLOUR_VALUES["accent-green"],
    linkedin: COLOUR_VALUES["accent-blue"],
    github: COLOUR_VALUES["text-primary"],
  };
  return map[platform.toLowerCase()] || COLOUR_VALUES["text-muted"];
}

export function getWorkspaceColour(colourToken: string): string {
  return COLOUR_VALUES[colourToken] || COLOUR_VALUES["accent"];
}

export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Agent type colour mapping for event stream
export function getAgentColour(agent: string): string {
  const a = agent.toUpperCase();
  if (a === "SOVEREIGN" || a === "SOVEREIGN-R17") return COLOUR_VALUES["accent-green"];
  if (a === "FORGE" || a === "DELIVER") return COLOUR_VALUES["accent-blue"];
  if (a === "RECON" || a === "PRISM") return COLOUR_VALUES["accent-blue"];
  if (a === "SCRIBE" || a === "LORE") return COLOUR_VALUES["accent-purple"];
  if (a === "KIRA" || a === "COMPASS") return COLOUR_VALUES["accent-yellow"];
  if (a === "VERIFY" || a === "PULSE") return COLOUR_VALUES["accent-yellow"];
  return COLOUR_VALUES["accent"];
}
