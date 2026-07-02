"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type ObjectType = "idea" | "board";
type Permission = "view" | "comment" | "edit";

const TABLE_FOR: Record<ObjectType, "ideas" | "boards"> = {
  idea: "ideas",
  board: "boards",
};

function parseObjectType(value: FormDataEntryValue | null): ObjectType | null {
  return value === "idea" || value === "board" ? value : null;
}

function parsePermission(value: FormDataEntryValue | null): Permission {
  return value === "comment" || value === "edit" ? value : "view";
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  const path = String(value ?? "/vault");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/vault";
}

function withStatus(path: string, key: string, message: string): string {
  const glue = path.includes("?") ? "&" : "?";
  return `${path}${glue}${key}=${encodeURIComponent(message)}`;
}

async function requireOwner(
  supabase: ReturnType<typeof createClient>,
  objectType: ObjectType,
  objectId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from(TABLE_FOR[objectType])
    .select("owner_id")
    .eq("id", objectId)
    .single();

  return (data as { owner_id?: string } | null)?.owner_id === userId;
}

async function currentUserOrLogin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function makeObjectPrivate(formData: FormData) {
  const objectType = parseObjectType(formData.get("objectType"));
  const objectId = String(formData.get("objectId") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  if (!objectType || !objectId) return;

  const supabase = createClient(await cookies());
  const user = await currentUserOrLogin(supabase);
  if (!(await requireOwner(supabase, objectType, objectId, user.id))) {
    redirect(withStatus(returnTo, "shareError", "Only the owner can manage sharing."));
  }

  const { error: updateError } = await supabase
    .from(TABLE_FOR[objectType])
    .update({ visibility: "private", circle_id: null, updated_at: new Date().toISOString() })
    .eq("id", objectId);

  if (updateError) {
    console.error("makeObjectPrivate failed:", updateError);
    redirect(withStatus(returnTo, "shareError", updateError.message));
  }

  const { error: deleteError } = await supabase
    .from("shares")
    .delete()
    .eq("object_type", objectType)
    .eq("object_id", objectId);

  if (deleteError) {
    console.error("clear shares failed:", deleteError);
    redirect(withStatus(returnTo, "shareError", deleteError.message));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "shared", "private"));
}

export async function shareObjectWithUser(formData: FormData) {
  const objectType = parseObjectType(formData.get("objectType"));
  const objectId = String(formData.get("objectId") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  const permission = parsePermission(formData.get("permission"));
  const handle = String(formData.get("handle") ?? "")
    .trim()
    .replace(/^@+/, "");

  if (!objectType || !objectId || !handle) return;

  const supabase = createClient(await cookies());
  const user = await currentUserOrLogin(supabase);
  if (!(await requireOwner(supabase, objectType, objectId, user.id))) {
    redirect(withStatus(returnTo, "shareError", "Only the owner can manage sharing."));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("handle", handle)
    .single();

  if (profileError || !profile) {
    redirect(withStatus(returnTo, "shareError", `No @${handle} profile found.`));
  }

  const target = profile as { id: string; handle: string };
  if (target.id === user.id) {
    redirect(withStatus(returnTo, "shareError", "You already own this."));
  }

  const { error: shareError } = await supabase.from("shares").upsert(
    {
      object_type: objectType,
      object_id: objectId,
      target_type: "user",
      target_id: target.id,
      permission,
    },
    { onConflict: "object_type,object_id,target_type,target_id" },
  );

  if (shareError) {
    console.error("shareObjectWithUser failed:", shareError);
    redirect(withStatus(returnTo, "shareError", shareError.message));
  }

  const { error: visibilityError } = await supabase
    .from(TABLE_FOR[objectType])
    .update({ visibility: "shared", circle_id: null, updated_at: new Date().toISOString() })
    .eq("id", objectId);

  if (visibilityError) {
    console.error("share visibility update failed:", visibilityError);
    redirect(withStatus(returnTo, "shareError", visibilityError.message));
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "shared", target.handle));
}

export async function removeShare(formData: FormData) {
  const objectType = parseObjectType(formData.get("objectType"));
  const objectId = String(formData.get("objectId") ?? "");
  const shareId = String(formData.get("shareId") ?? "");
  const returnTo = safeReturnTo(formData.get("returnTo"));
  if (!objectType || !objectId || !shareId) return;

  const supabase = createClient(await cookies());
  const user = await currentUserOrLogin(supabase);
  if (!(await requireOwner(supabase, objectType, objectId, user.id))) {
    redirect(withStatus(returnTo, "shareError", "Only the owner can manage sharing."));
  }

  const { error: deleteError } = await supabase
    .from("shares")
    .delete()
    .eq("id", shareId)
    .eq("object_type", objectType)
    .eq("object_id", objectId);

  if (deleteError) {
    console.error("removeShare failed:", deleteError);
    redirect(withStatus(returnTo, "shareError", deleteError.message));
  }

  const { data: remaining } = await supabase
    .from("shares")
    .select("id")
    .eq("object_type", objectType)
    .eq("object_id", objectId)
    .limit(1);

  if ((remaining ?? []).length === 0) {
    const { error: visibilityError } = await supabase
      .from(TABLE_FOR[objectType])
      .update({ visibility: "private", circle_id: null, updated_at: new Date().toISOString() })
      .eq("id", objectId);
    if (visibilityError) {
      console.error("removeShare visibility update failed:", visibilityError);
      redirect(withStatus(returnTo, "shareError", visibilityError.message));
    }
  }

  revalidatePath(returnTo);
  redirect(withStatus(returnTo, "shared", "updated"));
}
