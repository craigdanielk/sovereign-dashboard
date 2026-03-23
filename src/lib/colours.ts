// CSS colour values for dynamic usage (avoiding Tailwind dynamic class generation issues)
// These map to the theme tokens defined in globals.css

export const COLOUR_VALUES: Record<string, string> = {
  "accent-green": "#22c55e",
  "accent-yellow": "#eab308",
  "accent-red": "#ef4444",
  "accent-blue": "#3b82f6",
  "accent-purple": "#a855f7",
  "accent-cyan": "#06b6d4",
  "text-primary": "#e4e4ef",
  "text-secondary": "#8888a0",
  "text-muted": "#555570",
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
  return COLOUR_VALUES[colourToken] || COLOUR_VALUES["accent-cyan"];
}

export function withAlpha(hex: string, alpha: number): string {
  // Convert hex to rgba
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
