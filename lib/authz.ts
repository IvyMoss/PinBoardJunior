/**
 * PinBoard Junior — centralized authorization resolver.
 *
 * This is the single source of truth the APPLICATION uses to answer
 * "can user X do action Y on object Z" (instructions.md §5.2). The database
 * (RLS, see supabase/migrations/0002_rls.sql) is the ultimate enforcer; this
 * module mirrors that logic so the app can make the same decisions for
 * rendering (what to show, what controls to enable) without round-tripping.
 *
 * Two rules dominate every function here:
 *   1. DEFAULT DENY. We start from "no" and only return "yes" when a rule
 *      explicitly grants access. There is no implicit allow.
 *   2. MORE RESTRICTIVE WINS. When an idea is viewed through a board, the
 *      effective visibility is the more restrictive of the two. An idea is
 *      never shown above its own tier.
 *
 * Keep this module PURE (no I/O). Callers fetch the rows; this decides.
 */

export type Visibility = "private" | "shared" | "circle" | "public";
export type Permission = "view" | "comment" | "edit";

/** Restrictiveness order. Lower = more restrictive. */
const VIS_RANK: Record<Visibility, number> = {
  private: 0,
  shared: 1,
  circle: 2,
  public: 3,
};

/** Permission strength. Higher = more capable. view ⊂ comment ⊂ edit. */
const PERM_RANK: Record<Permission, number> = {
  view: 1,
  comment: 2,
  edit: 3,
};

export interface Viewer {
  /** Authenticated user id, or null for an anonymous/public visitor. */
  userId: string | null;
  /** Circle ids the viewer belongs to. */
  circleIds?: string[];
}

export interface Share {
  targetType: "user" | "circle";
  targetId: string;
  permission: Permission;
}

export interface Idea {
  id: string;
  ownerId: string;
  visibility: Visibility;
  /** Set when visibility === "circle". */
  circleId?: string | null;
  shares?: Share[];
}

export interface Board {
  id: string;
  ownerId: string;
  visibility: Visibility;
  circleId?: string | null;
  shares?: Share[];
}

/** The more restrictive (lower-ranked) of two visibilities. */
export function moreRestrictive(a: Visibility, b: Visibility): Visibility {
  return VIS_RANK[a] <= VIS_RANK[b] ? a : b;
}

function viewerMatchesShare(viewer: Viewer, s: Share): boolean {
  if (s.targetType === "user") return viewer.userId !== null && s.targetId === viewer.userId;
  return (viewer.circleIds ?? []).includes(s.targetId);
}

/** Highest permission the viewer is granted by an object's share list, or null. */
function sharePermission(viewer: Viewer, shares: Share[] | undefined): Permission | null {
  let best: Permission | null = null;
  for (const s of shares ?? []) {
    if (!viewerMatchesShare(viewer, s)) continue;
    if (best === null || PERM_RANK[s.permission] > PERM_RANK[best]) best = s.permission;
  }
  return best;
}

function isCircleMember(viewer: Viewer, circleId: string | null | undefined): boolean {
  return !!circleId && (viewer.circleIds ?? []).includes(circleId);
}

/**
 * The permission a viewer holds on an idea purely on the idea's own merits
 * (its visibility, circle, and shares) — ignoring any board context.
 * Owner check is handled by the caller. Returns null for no access.
 */
function ideaOwnGrant(viewer: Viewer, idea: Idea): Permission | null {
  // Private grants nothing to non-owners, even with a stale share row.
  if (idea.visibility === "private") return null;

  // Circle and public members may comment by default; an explicit share is
  // still required to edit. Anonymous (unauthenticated) visitors can only
  // ever view — commenting requires an account.
  let granted: Permission | null = null;
  if (idea.visibility === "public") {
    granted = viewer.userId !== null ? "comment" : "view";
  } else if (idea.visibility === "circle" && isCircleMember(viewer, idea.circleId)) {
    granted = "comment";
  }
  // `shared` grants nothing on its own — it needs an explicit share. Shares can
  // raise the permission up to edit on any non-private idea.
  const sp = sharePermission(viewer, idea.shares);
  if (sp !== null && (granted === null || PERM_RANK[sp] > PERM_RANK[granted])) {
    granted = sp;
  }
  return granted;
}

/**
 * The permission level a viewer effectively holds on an idea, optionally
 * viewed through a board. Returns null when the viewer has no access at all.
 *
 * `board` is omitted for direct access (e.g. the idea's own detail page);
 * pass it when the idea is being viewed inside a board.
 *
 * "More restrictive wins" is enforced as two INDEPENDENT gates, exactly as
 * the database RLS does it: you must be able to read the idea on its own
 * merits AND be able to read the board it is viewed through. The board only
 * gates access; it never elevates the permission you hold on the idea.
 */
export function resolvePermission(
  viewer: Viewer,
  idea: Idea,
  board?: Board,
): Permission | null {
  // Owner of the idea always has full control over their own idea.
  if (viewer.userId !== null && idea.ownerId === viewer.userId) return "edit";

  const own = ideaOwnGrant(viewer, idea);
  if (own === null) return null;
  if (!board) return own;

  // Viewed through a board: no path unless the board itself is readable.
  if (resolveBoardPermission(viewer, board) === null) return null;
  return own;
}

/** Permission a viewer holds on a board itself (not its contained ideas). */
export function resolveBoardPermission(viewer: Viewer, board: Board): Permission | null {
  if (viewer.userId !== null && board.ownerId === viewer.userId) return "edit";

  let granted: Permission | null = null;
  if (board.visibility === "public") granted = "view";
  else if (board.visibility === "circle" && isCircleMember(viewer, board.circleId)) granted = "view";

  if (board.visibility !== "private") {
    const sp = sharePermission(viewer, board.shares);
    if (sp !== null && (granted === null || PERM_RANK[sp] > PERM_RANK[granted])) granted = sp;
  }
  return granted;
}

/** Does the viewer hold at least `required` permission on the idea? */
export function can(
  required: Permission,
  viewer: Viewer,
  idea: Idea,
  board?: Board,
): boolean {
  const held = resolvePermission(viewer, idea, board);
  return held !== null && PERM_RANK[held] >= PERM_RANK[required];
}

export const canView = (v: Viewer, i: Idea, b?: Board) => can("view", v, i, b);
export const canComment = (v: Viewer, i: Idea, b?: Board) => can("comment", v, i, b);
export const canEdit = (v: Viewer, i: Idea, b?: Board) => can("edit", v, i, b);
