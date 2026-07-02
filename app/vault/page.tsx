import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signPaths } from "@/lib/media";
import { createIdea } from "./actions";
import { signOut } from "../login/actions";

interface IdeaRow {
  id: string;
  kind: string;
  body: string | null;
  url: string | null;
  visibility: string;
  created_at: string;
  media: { bucket: string; path: string } | null;
}

interface ProfileRow {
  handle: string;
  display_name: string | null;
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: saveError } = await searchParams;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name")
    .eq("id", user.id)
    .single();
  const viewerProfile = profile as ProfileRow | null;

  // RLS would also surface other people's public ideas; the vault is *yours*,
  // so scope to your own.
  const { data: ideas } = await supabase
    .from("ideas")
    .select("id, kind, body, url, visibility, created_at, media:media_id ( bucket, path )")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const rows = (ideas ?? []) as unknown as IdeaRow[];

  // Mint short-lived signed URLs for any image ideas (private bucket).
  const signed = await signPaths(
    supabase,
    rows.filter((r) => r.media?.path).map((r) => r.media!.path),
  );

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
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Your vault</h1>
        <nav style={{ display: "flex", gap: "1rem", alignItems: "baseline" }}>
          <Link href="/boards" style={{ color: "#666", fontSize: "0.9rem" }}>
            Boards
          </Link>
          {viewerProfile?.handle && <span style={handlePill}>@{viewerProfile.handle}</span>}
          <form action={signOut}>
            <button style={linkBtn}>Sign out</button>
          </form>
        </nav>
      </header>

      {saveError && (
        <p
          style={{
            color: "#c0392b",
            background: "#fdecea",
            padding: "0.7rem 0.9rem",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          Couldn’t save: {saveError}
        </p>
      )}

      {/* Quick capture */}
      <form action={createIdea} style={captureCard}>
        <textarea
          name="body"
          placeholder="Capture an idea…"
          rows={3}
          style={{ ...inputStyle, resize: "vertical" }}
        />
        <input name="url" type="url" placeholder="…or paste a link" style={inputStyle} />
        <label style={{ fontSize: "0.85rem", color: "#666" }}>
          …or attach an image
          <input
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "block", marginTop: "0.3rem", fontSize: "0.85rem" }}
          />
        </label>
        <button style={primaryBtn}>Save · private</button>
      </form>

      {/* The vault */}
      <section style={{ marginTop: "1.75rem", display: "grid", gap: "0.75rem" }}>
        {rows.length === 0 && (
          <p style={{ color: "#888" }}>Nothing yet. Capture your first idea above.</p>
        )}
        {rows.map((idea) => (
          <Link
            key={idea.id}
            href={`/ideas/${idea.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article style={ideaCard}>
              {idea.media?.path && signed[idea.media.path] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signed[idea.media.path]}
                  alt={idea.body ?? "Captured image"}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    marginBottom: "0.5rem",
                    display: "block",
                  }}
                />
              )}
              {idea.body && <p style={{ margin: "0 0 0.4rem" }}>{idea.body}</p>}
              {idea.url && (
                <p style={{ margin: "0 0 0.4rem", wordBreak: "break-all" }}>
                  <span style={{ color: "#2563eb" }}>{idea.url}</span>
                </p>
              )}
              <small style={{ color: "#999" }}>
                {idea.visibility} · {new Date(idea.created_at).toLocaleString()}
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
const ideaCard: React.CSSProperties = {
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
const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#666",
  cursor: "pointer",
  fontSize: "0.9rem",
  textDecoration: "underline",
};
const handlePill: React.CSSProperties = {
  color: "#333",
  border: "1px solid #ddd",
  borderRadius: 999,
  padding: "0.2rem 0.5rem",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
