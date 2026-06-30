"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function createBoard(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Private by default, like everything else. RLS insert check requires
  // owner_id === auth.uid().
  const { data, error } = await supabase
    .from("boards")
    .insert({ owner_id: user.id, title, visibility: "private" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createBoard failed:", error);
    redirect(`/boards?error=${encodeURIComponent(error?.message ?? "unknown error")}`);
  }

  redirect(`/boards/${data.id}`);
}

export async function addIdeaToBoard(formData: FormData) {
  const boardId = String(formData.get("boardId") ?? "");
  const ideaId = String(formData.get("ideaId") ?? "");
  if (!boardId || !ideaId) return;

  const supabase = createClient(await cookies());
  // board_items_write policy requires the caller to own (or have edit on) the
  // board; ideas RLS already guaranteed they could see the idea to pick it.
  const { error } = await supabase
    .from("board_items")
    .insert({ board_id: boardId, idea_id: ideaId });

  if (error) {
    console.error("addIdeaToBoard failed:", error);
    redirect(`/boards/${boardId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/boards/${boardId}`);
}

export async function removeIdeaFromBoard(formData: FormData) {
  const boardId = String(formData.get("boardId") ?? "");
  const ideaId = String(formData.get("ideaId") ?? "");
  if (!boardId || !ideaId) return;

  const supabase = createClient(await cookies());
  const { error } = await supabase
    .from("board_items")
    .delete()
    .eq("board_id", boardId)
    .eq("idea_id", ideaId);

  if (error) {
    console.error("removeIdeaFromBoard failed:", error);
    redirect(`/boards/${boardId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/boards/${boardId}`);
}
