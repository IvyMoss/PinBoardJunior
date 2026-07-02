import type { SupabaseClient } from "@supabase/supabase-js";

type ObjectType = "idea" | "board";
type ShareTargetType = "user" | "circle";
type Permission = "view" | "comment" | "edit";

interface ShareRecord {
  id: string;
  target_type: ShareTargetType;
  target_id: string;
  permission: Permission;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  handle: string;
  display_name: string | null;
}

export interface ShareRow {
  id: string;
  targetType: ShareTargetType;
  targetId: string;
  label: string;
  detail: string;
  permission: Permission;
}

export async function loadShareRows(
  supabase: SupabaseClient,
  objectType: ObjectType,
  objectId: string,
): Promise<ShareRow[]> {
  const { data } = await supabase
    .from("shares")
    .select("id, target_type, target_id, permission, created_at")
    .eq("object_type", objectType)
    .eq("object_id", objectId)
    .order("created_at", { ascending: true });

  const shares = (data ?? []) as ShareRecord[];
  const userIds = shares.filter((s) => s.target_type === "user").map((s) => s.target_id);
  const profilesById = new Map<string, ProfileRecord>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name")
      .in("id", userIds);

    for (const profile of (profiles ?? []) as ProfileRecord[]) {
      profilesById.set(profile.id, profile);
    }
  }

  return shares.map((share) => {
    if (share.target_type === "user") {
      const profile = profilesById.get(share.target_id);
      return {
        id: share.id,
        targetType: share.target_type,
        targetId: share.target_id,
        label: profile ? `@${profile.handle}` : "Unknown user",
        detail: profile?.display_name ?? "Person",
        permission: share.permission,
      };
    }

    return {
      id: share.id,
      targetType: share.target_type,
      targetId: share.target_id,
      label: "Circle",
      detail: share.target_id,
      permission: share.permission,
    };
  });
}
