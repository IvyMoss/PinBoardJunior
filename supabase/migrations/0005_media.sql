-- PinBoard Junior — media layer (image capture), built reference-counted from
-- the start so it survives the re-pin/deletion semantics decided in §4A.
--
-- Key design choice: a stored asset is its OWN row (`media`), and an idea
-- POINTS at it (ideas.media_id). Many ideas (an origin and its future re-pins)
-- can reference the same media row. Deletion therefore unlinks; the bytes are
-- collected only when no idea references the media anymore. media_reference_count
-- below bypasses RLS so the count is correct even across other users' re-pins.

-- ── private bucket (size + type enforced at the storage layer too) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idea-media', 'idea-media', false, 10485760,  -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── media table ───────────────────────────────────────────────────────────
create table media (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles (id) on delete cascade,
  bucket       text not null default 'idea-media',
  path         text not null,            -- storage object key: "<owner>/<uuid>.<ext>"
  content_type text,
  byte_size    bigint,
  created_at   timestamptz not null default now(),
  unique (bucket, path)
);
create index media_owner_idx on media (owner_id);

-- ── link ideas to media (nullable; only image/file ideas use it) ───────────
alter table ideas add column media_id uuid references media (id) on delete set null;
create index ideas_media_idx on ideas (media_id);

-- ── reference count (security definer: counts across ALL users' ideas,
--    bypassing RLS, so GC never deletes an asset a re-pin still needs) ───────
create or replace function media_reference_count(mid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from ideas where media_id = mid;
$$;

-- ── RLS on media ───────────────────────────────────────────────────────────
alter table media enable row level security;
grant all on media to authenticated;

-- Phase 1: owner-only. (Phase 2 will widen reads to viewers of a referencing
-- idea, tied to the same visibility resolution as everything else.)
create policy media_select on media
  for select to authenticated using (owner_id = auth.uid());
create policy media_insert on media
  for insert to authenticated with check (owner_id = auth.uid());
create policy media_delete on media
  for delete to authenticated using (owner_id = auth.uid());

-- ── RLS on the storage objects themselves ──────────────────────────────────
-- Files live under a per-user folder ("<uid>/..."), so the first path segment
-- must equal the caller's id. This is the storage-layer twin of the table RLS.
create policy "idea-media read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'idea-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "idea-media insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'idea-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "idea-media delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'idea-media' and (storage.foldername(name))[1] = auth.uid()::text);
