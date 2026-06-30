-- PinBoard Junior — Phase 0 Row Level Security
--
-- This is the data-layer half of the "security without friction" bet
-- (instructions.md §2, §5A.2). Every table is default-deny: RLS is enabled
-- with NO permissive policy until one is written here. The client never
-- decides visibility; Postgres enforces it on every read and write.
--
-- "Resolve to the more restrictive of idea and board" is an EMERGENT
-- property here, not special-case code: to see an idea inside a board you
-- must independently pass the board's policy (to read the board_item) AND
-- the idea's policy (to read the idea). A private idea on a public board is
-- therefore never returned — the idea policy denies it regardless of the
-- board. The TypeScript resolver in lib/authz.ts mirrors this same logic for
-- the app's own rendering decisions.

-- ── helper functions (security definer = run with table owner rights, so
--    they may read base tables without recursively triggering RLS) ─────────

create or replace function perm_rank(p permission)
returns int language sql immutable as $$
  select case p when 'view' then 1 when 'comment' then 2 when 'edit' then 3 end
$$;

create or replace function fn_is_circle_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from circle_members m
    where m.circle_id = cid and m.user_id = auth.uid()
  )
$$;

create or replace function fn_has_share(otype text, oid uuid, minperm permission)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shares s
    where s.object_type = otype
      and s.object_id   = oid
      and perm_rank(s.permission) >= perm_rank(minperm)
      and (
        (s.target_type = 'user'   and s.target_id = auth.uid())
        or
        (s.target_type = 'circle' and fn_is_circle_member(s.target_id))
      )
  )
$$;

create or replace function fn_can_read_board(bid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from boards b
    where b.id = bid
      and (
        b.owner_id = auth.uid()
        or b.visibility = 'public'
        or (b.visibility = 'circle' and fn_is_circle_member(b.circle_id))
        -- a share never grants access to a private object (demotion revokes)
        or (b.visibility <> 'private' and fn_has_share('board', b.id, 'view'))
      )
  )
$$;

-- ── enable RLS (default deny) ────────────────────────────────────────────
alter table profiles       enable row level security;
alter table circles        enable row level security;
alter table circle_members enable row level security;
alter table ideas          enable row level security;
alter table boards         enable row level security;
alter table board_items    enable row level security;
alter table shares         enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────
create policy profiles_select on profiles
  for select to authenticated using (true);             -- handles are discoverable
create policy profiles_insert on profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ── circles ──────────────────────────────────────────────────────────────
create policy circles_select on circles
  for select to authenticated
  using (owner_id = auth.uid() or fn_is_circle_member(id));
create policy circles_insert on circles
  for insert to authenticated with check (owner_id = auth.uid());
create policy circles_update on circles
  for update to authenticated using (owner_id = auth.uid());
create policy circles_delete on circles
  for delete to authenticated using (owner_id = auth.uid());

create policy circle_members_select on circle_members
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- ── ideas ────────────────────────────────────────────────────────────────
create policy ideas_select on ideas
  for select to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'circle' and fn_is_circle_member(circle_id))
    or (visibility <> 'private' and fn_has_share('idea', id, 'view'))
  );
create policy ideas_insert on ideas
  for insert to authenticated with check (owner_id = auth.uid());
create policy ideas_update on ideas
  for update to authenticated
  using (owner_id = auth.uid() or (visibility <> 'private' and fn_has_share('idea', id, 'edit')))
  with check (owner_id = auth.uid() or (visibility <> 'private' and fn_has_share('idea', id, 'edit')));
create policy ideas_delete on ideas
  for delete to authenticated using (owner_id = auth.uid());

-- ── boards ───────────────────────────────────────────────────────────────
create policy boards_select on boards
  for select to authenticated
  using (
    owner_id = auth.uid()
    or visibility = 'public'
    or (visibility = 'circle' and fn_is_circle_member(circle_id))
    or (visibility <> 'private' and fn_has_share('board', id, 'view'))
  );
create policy boards_insert on boards
  for insert to authenticated with check (owner_id = auth.uid());
create policy boards_update on boards
  for update to authenticated
  using (owner_id = auth.uid() or (visibility <> 'private' and fn_has_share('board', id, 'edit')))
  with check (owner_id = auth.uid() or (visibility <> 'private' and fn_has_share('board', id, 'edit')));
create policy boards_delete on boards
  for delete to authenticated using (owner_id = auth.uid());

-- ── board_items ──────────────────────────────────────────────────────────
-- You may see the placement only if you can read the board. Whether you can
-- read the IDEA is enforced separately by the ideas policy above — that join
-- is where "more restrictive wins" actually happens.
create policy board_items_select on board_items
  for select to authenticated using (fn_can_read_board(board_id));
create policy board_items_write on board_items
  for all to authenticated
  using (exists (select 1 from boards b
                 where b.id = board_id
                   and (b.owner_id = auth.uid() or fn_has_share('board', b.id, 'edit'))))
  with check (exists (select 1 from boards b
                 where b.id = board_id
                   and (b.owner_id = auth.uid() or fn_has_share('board', b.id, 'edit'))));

-- ── shares ───────────────────────────────────────────────────────────────
-- Only the owner of the underlying object may grant or see its shares.
create policy shares_owner_all on shares
  for all to authenticated
  using (
    (object_type = 'idea'  and exists (select 1 from ideas  i where i.id = object_id and i.owner_id = auth.uid()))
    or (object_type = 'board' and exists (select 1 from boards b where b.id = object_id and b.owner_id = auth.uid()))
  )
  with check (
    (object_type = 'idea'  and exists (select 1 from ideas  i where i.id = object_id and i.owner_id = auth.uid()))
    or (object_type = 'board' and exists (select 1 from boards b where b.id = object_id and b.owner_id = auth.uid()))
  );
