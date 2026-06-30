export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", margin: 0 }}>PinBoard Junior</h1>
      <p style={{ color: "#666", maxWidth: 480, marginTop: "0.75rem" }}>
        Capture an idea the moment you have it — then choose who sees it.
        Private by default.
      </p>
      <a
        href="/vault"
        style={{
          marginTop: "1.5rem",
          padding: "0.65rem 1.25rem",
          background: "#111",
          color: "#fff",
          borderRadius: 8,
          textDecoration: "none",
          fontSize: "0.95rem",
        }}
      >
        Open your vault
      </a>
      <p style={{ color: "#aaa", fontSize: "0.85rem", marginTop: "2rem" }}>
        Phase 1 · private capture
      </p>
    </main>
  );
}
