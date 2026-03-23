// MIROFISH war-room terminal colour values
// Maps to theme tokens in globals.css

export const COLOUR_VALUES: Record<string, string> = {
  "accent-green": "#00ff41",
  "accent-green-dim": "#00cc33",
  "accent-lime": "#39ff14",
  "accent-yellow": "#ffb800",
  "accent-red": "#ff1744",
  "accent-blue": "#00b0ff",
  "accent-purple": "#b388ff",
  "accent-cyan": "#00e5ff",
  "accent-orange": "#ff6d00",
  "text-primary": "#d4d4d4",
  "text-secondary": "#737373",
  "text-muted": "#404040",
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
  };
  return map[status] || COLOUR_VALUES["text-muted"];
}

export function getPriorityColour(priority: string): string {
  const map: Record<string, string> = {
    P0: COLOUR_VALUES["accent-red"],
    P1: COLOUR_VALUES["accent-yellow"],
    P2: COLOUR_VALUES["accent-blue"],
    P3: COLOUR_VALUES["text-muted"],
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
  return COLOUR_VALUES[colourToken] || COLOUR_VALUES["accent-green"];
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
  if (a === "FORGE" || a === "DELIVER") return COLOUR_VALUES["accent-cyan"];
  if (a === "RECON" || a === "PRISM") return COLOUR_VALUES["accent-blue"];
  if (a === "SCRIBE" || a === "LORE") return COLOUR_VALUES["accent-purple"];
  if (a === "KIRA" || a === "COMPASS") return COLOUR_VALUES["accent-orange"];
  if (a === "VERIFY" || a === "PULSE") return COLOUR_VALUES["accent-yellow"];
  return COLOUR_VALUES["accent-lime"];
}
