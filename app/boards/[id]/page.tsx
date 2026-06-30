import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signPaths } from "@/lib/media";
import { addIdeaToBoard, removeIdeaFromBoard } from "../actions";

interface IdeaLite {
  id: string;
  kind: string;
  body: string | null;
  url: string | null;
  visibility: string;
  media: { bucket: string; path: string } | null;
}

export default async function BoardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS returns this row only if the viewer is allowed to see the board.
  const { data: board } = await supabase
    .from("boards")
    .select("id, title, visibility")
    .eq("id", id)
    .single();
  if (!board) notFound();

  // Ideas placed in this board. The join is gated by RLS on both tables, so a
  // private idea owned by someone else would simply not come back.
  const { data: itemRows } = await supabase
    .from("board_items")
    .select("idea_id, added_at, ideas(id, kind, body, url, visibility, media:media_id ( bucket, path ))")
    .eq("board_id", id)
    .order("added_at", { ascending: false });

  const items = (itemRows ?? [])
    .map((r) => (r as unknown as { ideas: IdeaLite | null }).ideas)
    .filter((i): i is IdeaLite => i !== null);

  const inBoard = new Set(items.map((i) => i.id));

  const signed = await signPaths(
    supabase,
    items.filter((i) => i.media?.path).map((i) => i.media!.path),
  );

  // The user's own ideas not already in this board — candidates to add.
  const { data: myIdeas } = await supabase
    .from("ideas")
    .select("id, kind, body, url, visibility")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const candidates = ((myIdeas ?? []) as IdeaLite[]).filter((i) => !inBoard.has(i.id));

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ marginBottom: "1.25rem" }}>
        <Link href="/boards" style={{ color: "#666", fontSize: "0.9rem" }}>
          ← Boards
        </Link>
        <h1 style={{ fontSize: "1.6rem", margin: "0.5rem 0 0.2rem" }}>{board.title}</h1>
        <small style={{ color: "#999" }}>{board.visibility}</small>
      </header>

      {error && <p style={errorBanner}>Couldn’t update board: {error}</p>}

      {/* Add an idea */}
      {candidates.length > 0 && (
        <form action={addIdeaToBoard} style={addRow}>
          <input type="hidden" name="boardId" value={board.id} />
          <select name="ideaId" required style={{ ...inputStyle, flex: 1 }}>
            <option value="">Add one of your ideas…</option>
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {labelFor(i)}
              </option>
            ))}
          </select>
          <button style={primaryBtn}>Add</button>
        </form>
      )}

      {/* Grid */}
      <section style={grid}>
        {items.length === 0 && (
          <p style={{ color: "#888" }}>This board is empty. Add an idea above.</p>
        )}
        {items.map((i) => (
          <article key={i.id} style={ideaCard}>
            {i.media?.path && signed[i.media.path] && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={signed[i.media.path]}
                alt={i.body ?? "Captured image"}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  marginBottom: "0.5rem",
                  display: "block",
                }}
              />
            )}
            {i.body && <p style={{ margin: "0 0 0.4rem" }}>{i.body}</p>}
            {i.url && (
              <p style={{ margin: "0 0 0.4rem", wordBreak: "break-all" }}>
                <span style={{ color: "#2563eb" }}>{i.url}</span>
              </p>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "0.3rem",
              }}
            >
              <Link href={`/ideas/${i.id}`} style={{ color: "#666", fontSize: "0.8rem" }}>
                Open
              </Link>
              <small style={{ color: "#999" }}>{i.visibility}</small>
              <form action={removeIdeaFromBoard}>
                <input type="hidden" name="boardId" value={board.id} />
                <input type="hidden" name="ideaId" value={i.id} />
                <button style={removeBtn} aria-label="Remove from board">
                  Remove
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function labelFor(i: IdeaLite): string {
  const text = i.body ?? i.url ?? "(untitled)";
  return text.length > 60 ? text.slice(0, 57) + "…" : text;
}

const inputStyle: React.CSSProperties = {
  padding: "0.6rem 0.7rem",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: "0.95rem",
  boxSizing: "border-box",
};
const addRow: React.CSSProperties = {
  display: "flex",
  gap: "0.6rem",
  marginBottom: "1.5rem",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "0.75rem",
};
const ideaCard: React.CSSProperties = {
  padding: "0.9rem 1rem",
  border: "1px solid #eee",
  borderRadius: 12,
};
const primaryBtn: React.CSSProperties = {
  padding: "0.6rem 1rem",
  borderRadius: 8,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.95rem",
};
const removeBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#c0392b",
  cursor: "pointer",
  fontSize: "0.8rem",
  textDecoration: "underline",
  padding: 0,
};
const errorBanner: React.CSSProperties = {
  color: "#c0392b",
  background: "#fdecea",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  marginBottom: "1rem",
};
