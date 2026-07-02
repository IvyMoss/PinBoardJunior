import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signPaths } from "@/lib/media";
import { updateIdea } from "../../vault/actions";
import { DeleteIdeaButton } from "./DeleteIdeaButton";
import { SharePanel } from "@/app/share/SharePanel";
import { loadShareRows } from "@/app/share/data";

export default async function IdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; shareError?: string; shared?: string }>;
}) {
  const { id } = await params;
  const { error, saved, shareError, shared } = await searchParams;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, owner_id, kind, body, url, visibility, updated_at, media:media_id ( bucket, path )")
    .eq("id", id)
    .single();
  if (!idea) notFound();

  const media = (idea as unknown as { media: { bucket: string; path: string } | null }).media;
  const signed = media?.path ? (await signPaths(supabase, [media.path]))[media.path] : null;

  // Only the owner gets the editing UI. RLS still enforces this on write, but
  // hiding the controls keeps the UI honest for view/comment-only viewers.
  const canEdit = idea.owner_id === user.id;
  const shares = canEdit ? await loadShareRows(supabase, "idea", idea.id) : [];
  const { data: profile } = canEdit
    ? await supabase.from("profiles").select("handle").eq("id", user.id).single()
    : { data: null };
  const viewerHandle = (profile as { handle?: string } | null)?.handle ?? null;
  const returnTo = `/ideas/${idea.id}`;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <Link href="/vault" style={{ color: "#666", fontSize: "0.9rem" }}>
        ← Vault
      </Link>

      {error && <p style={errorBanner}>{error}</p>}
      {saved && <p style={okBanner}>Saved.</p>}
      {shareError && <p style={errorBanner}>{shareError}</p>}
      {shared && <p style={okBanner}>Sharing updated.</p>}

      {signed && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={signed}
          alt={idea.body ?? "Captured image"}
          style={{
            width: "100%",
            borderRadius: 12,
            marginTop: "1rem",
            display: "block",
          }}
        />
      )}

      {canEdit ? (
        <>
          <form action={updateIdea} style={{ ...card, marginTop: "1rem" }}>
            <input type="hidden" name="ideaId" value={idea.id} />
            <label style={lbl}>Idea</label>
            <textarea
              name="body"
              rows={4}
              defaultValue={idea.body ?? ""}
              placeholder="Your idea…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <label style={lbl}>Link</label>
            <input
              name="url"
              type="url"
              defaultValue={idea.url ?? ""}
              placeholder="https://…"
              style={inputStyle}
            />
            <button style={primaryBtn}>Save changes</button>
          </form>

          <div style={{ marginTop: "1.5rem" }}>
            <DeleteIdeaButton ideaId={idea.id} />
          </div>

          <SharePanel
            objectType="idea"
            objectId={idea.id}
            visibility={idea.visibility}
            shares={shares}
            returnTo={returnTo}
            viewerHandle={viewerHandle}
          />
        </>
      ) : (
        <article style={{ ...card, marginTop: "1rem" }}>
          {idea.body && <p style={{ margin: "0 0 0.5rem" }}>{idea.body}</p>}
          {idea.url && (
            <p style={{ wordBreak: "break-all", color: "#2563eb" }}>{idea.url}</p>
          )}
          <small style={{ color: "#999" }}>
            {idea.visibility} · read-only
          </small>
        </article>
      )}

      <p style={{ color: "#bbb", fontSize: "0.8rem", marginTop: "1.5rem" }}>
        Visibility: {idea.visibility}
      </p>
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
const card: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  padding: "1rem",
  border: "1px solid #eee",
  borderRadius: 12,
};
const lbl: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};
const primaryBtn: React.CSSProperties = {
  padding: "0.6rem",
  borderRadius: 8,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontSize: "0.95rem",
  marginTop: "0.3rem",
};
const errorBanner: React.CSSProperties = {
  color: "#c0392b",
  background: "#fdecea",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  marginTop: "1rem",
};
const okBanner: React.CSSProperties = {
  color: "#1e7e34",
  background: "#eaf6ec",
  padding: "0.7rem 0.9rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  marginTop: "1rem",
};
