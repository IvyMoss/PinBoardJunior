"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { createClient } from "@/utils/supabase/server";
import {
  MEDIA_BUCKET,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/media";

function fail(message: string): never {
  redirect(`/vault?error=${encodeURIComponent(message)}`);
}

export async function createIdea(formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const image = formData.get("image");
  const hasImage = image instanceof File && image.size > 0;

  // Capture beats organize — but don't save an empty idea.
  if (!body && !url && !hasImage) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let mediaId: string | null = null;
  let kind: "text" | "link" | "image" = url ? "link" : "text";

  if (hasImage) {
    const file = image as File;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      fail("That image type isn’t supported (use PNG, JPEG, WebP or GIF).");
    }
    if (file.size > MAX_IMAGE_BYTES) {
      fail("That image is over the 10 MB limit.");
    }

    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${user.id}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) {
      console.error("image upload failed:", upErr);
      fail(upErr.message);
    }

    const { data: media, error: mediaErr } = await supabase
      .from("media")
      .insert({
        owner_id: user.id,
        bucket: MEDIA_BUCKET,
        path,
        content_type: file.type,
        byte_size: file.size,
      })
      .select("id")
      .single();

    if (mediaErr || !media) {
      // Roll back the orphaned upload so storage doesn't leak.
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      console.error("media insert failed:", mediaErr);
      fail(mediaErr?.message ?? "Couldn’t save the image.");
    }

    mediaId = media.id;
    kind = "image";
  }

  // owner_id must equal auth.uid() or the RLS insert check rejects this.
  // visibility defaults to 'private' — secure by default.
  const { error } = await supabase.from("ideas").insert({
    owner_id: user.id,
    kind,
    body: body || null,
    url: url || null,
    media_id: mediaId,
    visibility: "private",
  });

  if (error) {
    console.error("createIdea failed:", error);
    fail(error.message);
  }

  revalidatePath("/vault");
}

export async function updateIdea(formData: FormData) {
  const id = String(formData.get("ideaId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  if (!id) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Preserve an image idea's kind/media — editing it just changes the caption.
  const { data: existing } = await supabase
    .from("ideas")
    .select("kind, media_id")
    .eq("id", id)
    .single();
  const isImage = existing?.kind === "image" && !!existing?.media_id;

  // A non-image idea must carry text or a link; an image idea may have neither.
  if (!isImage && !body && !url) {
    redirect(`/ideas/${id}?error=${encodeURIComponent("An idea can’t be empty.")}`);
  }

  // RLS update policy permits this only for the owner (or an edit-share).
  // media_id is intentionally not in the update set, so it is left untouched.
  const { error } = await supabase
    .from("ideas")
    .update({
      kind: isImage ? "image" : url && !body ? "link" : "text",
      body: body || null,
      url: url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("updateIdea failed:", error);
    redirect(`/ideas/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ideas/${id}`);
  revalidatePath("/vault");
  redirect(`/ideas/${id}?saved=1`);
}

export async function deleteIdea(formData: FormData) {
  const id = String(formData.get("ideaId") ?? "");
  if (!id) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Look up any attached media BEFORE removing the idea, so we can decide
  // whether the stored object is now unreferenced (see §4A).
  const { data: idea } = await supabase
    .from("ideas")
    .select("media_id, media:media_id ( bucket, path )")
    .eq("id", id)
    .single();

  // RLS delete policy is owner-only. Board placements cascade away via the
  // board_items FK (on delete cascade). This is the "unlink" step.
  const { error } = await supabase.from("ideas").delete().eq("id", id);

  if (error) {
    console.error("deleteIdea failed:", error);
    redirect(`/ideas/${id}?error=${encodeURIComponent(error.message)}`);
  }

  // Conditional GC: the asset is collected only when NO idea references it
  // anymore (origin or any user's re-pin). media_reference_count bypasses RLS
  // so a re-pin owned by someone else still keeps the bytes alive. This honors
  // the §4A rule: deletion never strands a copy someone else preserved.
  if (idea?.media_id) {
    const { data: refs } = await supabase.rpc("media_reference_count", {
      mid: idea.media_id,
    });
    if ((refs ?? 0) === 0) {
      const m = idea.media as unknown as { bucket: string; path: string } | null;
      if (m) await supabase.storage.from(m.bucket).remove([m.path]);
      await supabase.from("media").delete().eq("id", idea.media_id);
    }
  }

  revalidatePath("/vault");
  redirect("/vault");
}
