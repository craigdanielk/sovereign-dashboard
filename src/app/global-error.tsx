"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0a0a0a",
          color: "#d4d4d4",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1rem", color: "#ff1744", marginBottom: "1rem" }}>
            SYSTEM ERROR
          </h2>
          <button
            onClick={() => unstable_retry()}
            style={{
              padding: "0.5rem 1rem",
              background: "#141414",
              border: "1px solid #1e1e1e",
              color: "#00ff41",
              borderRadius: "0.25rem",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontFamily: "monospace",
            }}
          >
            RETRY
          </button>
        </div>
      </body>
    </html>
  );
}
