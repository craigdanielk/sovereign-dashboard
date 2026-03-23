"use client";

// This page must be completely self-contained (own <html>/<body>) and
// must not import any component that calls useRouter/usePathname during SSR.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          background: "#0a0a0f",
          color: "#e4e4ef",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
            Something went wrong
          </h2>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              background: "#1a1a2e",
              border: "1px solid #2a2a40",
              color: "#e4e4ef",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
