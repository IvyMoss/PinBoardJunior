-- PinBoard Junior — Phase 0 schema
-- Core objects: profiles, ideas, boards, board_items, shares, circles.
-- Design rules (see instructions.md §2-§4):
--   * Unguessable IDs everywhere (uuid v4), never sequential integers.
--   * Every idea and every board carries its own `visibility`.
--   * The DB is the source of truth for who can see what (RLS in 0002).

-- ── Enums ────────────────────────────────────────────────────────────────
create type visibility as enum ('private', 'shared', 'circle', 'public');

-- Permission a share grants to its target. Ordered least → most.
create type permission as enum ('view', 'comment', 'edit');

-- What kind of principal a share points at.
create type share_target_type as enum ('user', 'circle');

-- ── profiles ─────────────────────────────────────────────────────────────
-- Mirror of auth.users we are allowed to read/join. The owner of everything.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text unique not null,
  display_name text,
  created_at  timestamptz not null default now()
);

-- ── circles ──────────────────────────────────────────────────────────────
create table circles (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table circle_members (
  circle_id   uuid not null references circles (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  is_moderator boolean not null default false,
  joined_at   timestamptz not null default now(),
  primary key (circle_id, user_id)
);

-- ── ideas ────────────────────────────────────────────────────────────────
-- One object, many homes. An idea exists once; boards reference it.
create table ideas (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles (id) on delete cascade,
  kind        text not null default 'text',          -- text | image | link | ...
  body        text,                                   -- verbal ideas are first-class
  media_path  text,                                   -- object-storage key, never bytes
  url         text,                                   -- for link captures
  visibility  visibility not null default 'private',  -- secure by default
  circle_id   uuid references circles (id) on delete set null, -- set when visibility = circle
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── boards ───────────────────────────────────────────────────────────────
create table boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles (id) on delete cascade,
  title       text not null,
  visibility  visibility not null default 'private',
  circle_id   uuid references circles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── board_items ──────────────────────────────────────────────────────────
-- The many-to-many seam. An idea appears in a board without duplication.
create table board_items (
  board_id    uuid not null references boards (id) on delete cascade,
  idea_id     uuid not null references ideas (id) on delete cascade,
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  primary key (board_id, idea_id)
);

-- ── shares (the ACL table) ───────────────────────────────────────────────
-- Grants a principal a permission on an idea or a board. Drives the
-- `shared` tier. Absence of a row = no access (default deny).
create table shares (
  id           uuid primary key default gen_random_uuid(),
  object_type  text not null check (object_type in ('idea', 'board')),
  object_id    uuid not null,
  target_type  share_target_type not null,
  target_id    uuid not null,            -- profiles.id or circles.id
  permission   permission not null default 'view',
  created_at   timestamptz not null default now(),
  unique (object_type, object_id, target_type, target_id)
);

-- ── indexes ──────────────────────────────────────────────────────────────
create index ideas_owner_idx       on ideas (owner_id);
create index boards_owner_idx      on boards (owner_id);
create index board_items_idea_idx  on board_items (idea_id);
create index shares_lookup_idx     on shares (object_type, object_id);
create index shares_target_idx     on shares (target_type, target_id);
create index circle_members_user_idx on circle_members (user_id);
