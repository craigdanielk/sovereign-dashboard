"use client";

// Next.js 16 prerenders this page outside the root layout context.
// Must not import or depend on any providers, hooks, or context.
// Keep this file as minimal as possible — no imports beyond React.

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#0a0a0a", color: "#d4d4d4", fontFamily: "monospace" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: "1rem", color: "#ff1744" }}>SYSTEM ERROR</h2>
            <button onClick={() => reset()} style={{ padding: "0.5rem 1rem", background: "#141414", border: "1px solid #1e1e1e", color: "#00ff41", borderRadius: "0.25rem", cursor: "pointer" }}>
              RETRY
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
