export default function NotFound() {
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
          <h2 style={{ fontSize: "1rem", color: "#ff1744", marginBottom: "0.5rem" }}>
            404
          </h2>
          <p style={{ fontSize: "0.75rem", color: "#666" }}>Page not found</p>
        </div>
      </body>
    </html>
  );
}
