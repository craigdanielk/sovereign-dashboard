"use client";

/**
 * Amber banner shown when the dashboard is serving stale cached data
 * because Supabase is unreachable.
 */
export function StaleBanner({ cachedAt }: { cachedAt: string }) {
  let label: string;
  try {
    const d = new Date(cachedAt);
    label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    label = cachedAt;
  }

  return (
    <div
      className="w-full px-4 py-2 text-center text-[11px] font-medium tracking-wide"
      style={{
        background: "rgba(255,159,10,0.12)",
        color: "var(--orange)",
        borderBottom: "1px solid rgba(255,159,10,0.18)",
        fontFamily: "var(--font-mono)",
      }}
    >
      Data from {label} — connection lost
    </div>
  );
}
