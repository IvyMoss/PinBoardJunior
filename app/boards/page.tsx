import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createBoard } from "./actions";

interface BoardRow {
  id: string;
  title: string;
  visibility: string;
  created_at: string;
}

export default async function BoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string }>;
}) {
  const { error, deleted } = await searchParams;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: boards } = await supabase
    .from("boards")
    .select("id, title, visibility, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (boards ?? []) as BoardRow[];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Your boards</h1>
        <Link href="/vault" style={{ color: "#666", fontSize: "0.9rem" }}>
          ← Vault
        </Link>
      </header>

      {error && (
        <p style={errorBanner}>Couldn’t create board: {error}</p>
      )}
      {deleted && <p style={okBanner}>Board deleted. Your ideas were kept.</p>}

      <form action={createBoard} style={captureCard}>
        <input name="title" placeholder="New board title…" required style={inputStyle} />
        <button style={primaryBtn}>Create board</button>
      </form>

      <section style={{ marginTop: "1.75rem", display: "grid", gap: "0.75rem" }}>
        {rows.length === 0 && (
          <p style={{ color: "#888" }}>No boards yet. Create one above.</p>
        )}
        {rows.map((b) => (
          <Link key={b.id} href={`/boards/${b.id}`} style={{ textDecoration: "none" }}>
            <article style={boardCard}>
              <strong style={{ color: "#111" }}>{b.title}</strong>
              <small style={{ color: "#999", display: "block", marginTop: "0.2rem" }}>
                {b.visibility}
              </small>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
  width: "100%",
  boxSizing: "border-box",
};
const captureCard: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
  padding: "1rem",
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fafafa",
};
const boardCard: React.CSSProperties = {
  padding: "0.9rem 1rem",
  border: "1px solid #eee",
  borderRadius: 12,
};
const primaryBtn: React.CSSProperties = {
  padding: "0.6rem",
  borderRadius: 8,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.95rem",
};
const errorBanner: React.CSSProperties = {
  color: "#c0392b",
  background: "#fdecea",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  marginBottom: "1rem",
};
const okBanner: React.CSSProperties = {
  color: "#1e7e34",
  background: "#eaf6ec",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  marginBottom: "1rem",
};
