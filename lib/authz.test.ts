import { describe, it, expect } from "vitest";
import {
  canView,
  canComment,
  canEdit,
  resolvePermission,
  moreRestrictive,
  type Idea,
  type Board,
  type Viewer,
} from "./authz";

// ── actors ─────────────────────────────────────────────────────────────────
const OWNER = "user-owner";
const BOB = "user-bob";
const STRANGER = "user-stranger";
const ANON: Viewer = { userId: null };

const owner: Viewer = { userId: OWNER };
const bob: Viewer = { userId: BOB };
const stranger: Viewer = { userId: STRANGER };

function idea(over: Partial<Idea> = {}): Idea {
  return { id: "idea-1", ownerId: OWNER, visibility: "private", ...over };
}
function board(over: Partial<Board> = {}): Board {
  return { id: "board-1", ownerId: OWNER, visibility: "private", ...over };
}

describe("default deny", () => {
  it("anonymous viewer cannot see a private idea", () => {
    expect(canView(ANON, idea())).toBe(false);
  });
  it("a stranger cannot see a private idea", () => {
    expect(canView(stranger, idea())).toBe(false);
  });
  it("a stranger cannot see a shared idea they were not granted", () => {
    expect(canView(stranger, idea({ visibility: "shared" }))).toBe(false);
  });
});

describe("owner", () => {
  it("can always view, comment and edit their own idea", () => {
    const i = idea();
    expect(canView(owner, i)).toBe(true);
    expect(canComment(owner, i)).toBe(true);
    expect(canEdit(owner, i)).toBe(true);
  });
});

describe("public tier", () => {
  it("anyone may view a public idea", () => {
    expect(canView(stranger, idea({ visibility: "public" }))).toBe(true);
    expect(canView(ANON, idea({ visibility: "public" }))).toBe(true);
  });
  it("an authenticated viewer may comment on a public idea by default", () => {
    expect(canComment(stranger, idea({ visibility: "public" }))).toBe(true);
  });
  it("a public idea is not editable without an explicit grant", () => {
    expect(canEdit(stranger, idea({ visibility: "public" }))).toBe(false);
  });
  it("an anonymous visitor may only view, not comment", () => {
    expect(canView(ANON, idea({ visibility: "public" }))).toBe(true);
    expect(canComment(ANON, idea({ visibility: "public" }))).toBe(false);
  });
});

describe("shared tier", () => {
  it("a directly shared user gets exactly their granted permission", () => {
    const i = idea({
      visibility: "shared",
      shares: [{ targetType: "user", targetId: BOB, permission: "comment" }],
    });
    expect(canView(bob, i)).toBe(true);
    expect(canComment(bob, i)).toBe(true);
    expect(canEdit(bob, i)).toBe(false); // granted comment, not edit
  });
  it("an edit grant allows editing", () => {
    const i = idea({
      visibility: "shared",
      shares: [{ targetType: "user", targetId: BOB, permission: "edit" }],
    });
    expect(canEdit(bob, i)).toBe(true);
  });
  it("a grant to one user does not leak to another", () => {
    const i = idea({
      visibility: "shared",
      shares: [{ targetType: "user", targetId: BOB, permission: "edit" }],
    });
    expect(canView(stranger, i)).toBe(false);
  });
});

describe("circle tier", () => {
  const i = idea({ visibility: "circle", circleId: "circle-x" });
  it("a circle member may view and comment by default", () => {
    const member: Viewer = { userId: BOB, circleIds: ["circle-x"] };
    expect(canView(member, i)).toBe(true);
    expect(canComment(member, i)).toBe(true);
    expect(canEdit(member, i)).toBe(false);
  });
  it("a non-member may not", () => {
    const outsider: Viewer = { userId: BOB, circleIds: ["circle-y"] };
    expect(canView(outsider, i)).toBe(false);
  });
});

// ── the load-bearing security guarantees ───────────────────────────────────
describe("more-restrictive resolution through a board", () => {
  it("a PRIVATE idea is NOT visible through a PUBLIC board", () => {
    const i = idea({ visibility: "private" });
    const b = board({ ownerId: OWNER, visibility: "public" });
    expect(canView(stranger, i, b)).toBe(false);
    expect(canView(ANON, i, b)).toBe(false);
  });

  it("a PUBLIC idea is NOT exposed through a PRIVATE board to outsiders", () => {
    const i = idea({ visibility: "public" });
    const b = board({ ownerId: OWNER, visibility: "private" });
    // The board itself is private to everyone but its owner, so an outsider
    // has no path to the idea through it.
    expect(canView(stranger, i, b)).toBe(false);
  });

  it("a PUBLIC idea on a CIRCLE board is visible only to circle members", () => {
    const i = idea({ visibility: "public" });
    const b = board({ visibility: "circle", circleId: "circle-x" });
    const member: Viewer = { userId: BOB, circleIds: ["circle-x"] };
    const outsider: Viewer = { userId: STRANGER, circleIds: [] };
    expect(canView(member, i, b)).toBe(true);
    expect(canView(outsider, i, b)).toBe(false);
  });

  it("the idea owner still sees their own idea through someone else's board", () => {
    const i = idea({ ownerId: OWNER, visibility: "private" });
    const b = board({ ownerId: STRANGER, visibility: "public" });
    expect(canView(owner, i, b)).toBe(true);
  });
});

describe("demotion immediately revokes", () => {
  it("revokes a previously-shared viewer when the idea is pulled back to private", () => {
    const shares = [{ targetType: "user" as const, targetId: BOB, permission: "edit" as const }];
    const shared = idea({ visibility: "shared", shares });
    expect(canView(bob, shared)).toBe(true);

    // Owner demotes to private. The stale share row must NOT keep granting access.
    const demoted = idea({ visibility: "private", shares });
    expect(canView(bob, demoted)).toBe(false);
    expect(canEdit(bob, demoted)).toBe(false);
  });
});

describe("share is capped by board context", () => {
  it("a share does not survive being viewed through a private board", () => {
    const shares = [{ targetType: "user" as const, targetId: BOB, permission: "edit" as const }];
    const i = idea({ visibility: "shared", shares });
    const privateBoard = board({ ownerId: OWNER, visibility: "private" });
    // Bob can see it directly...
    expect(canView(bob, i)).toBe(true);
    // ...but not through a board he cannot read.
    expect(canView(bob, i, privateBoard)).toBe(false);
  });
});

describe("moreRestrictive helper", () => {
  it("picks the lower tier", () => {
    expect(moreRestrictive("public", "private")).toBe("private");
    expect(moreRestrictive("shared", "circle")).toBe("shared");
    expect(moreRestrictive("public", "public")).toBe("public");
  });
});

describe("resolvePermission returns null on no access", () => {
  it("not a leaky boolean", () => {
    expect(resolvePermission(stranger, idea())).toBeNull();
  });
});
