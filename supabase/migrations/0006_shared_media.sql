-- Shared image ideas need the same authorization boundary as text ideas.
-- Phase 1 media was owner-only; this widens reads to any authenticated viewer
-- who can read at least one idea referencing the media row.

create or replace function fn_can_read_media(mbucket text, mpath text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from media m
    where m.bucket = mbucket
      and m.path = mpath
      and (
        m.owner_id = auth.uid()
        or exists (
          select 1
          from ideas i
          where i.media_id = m.id
            and (
              i.owner_id = auth.uid()
              or i.visibility = 'public'
              or (i.visibility = 'circle' and fn_is_circle_member(i.circle_id))
              or (i.visibility <> 'private' and fn_has_share('idea', i.id, 'view'))
            )
        )
      )
  )
$$;

drop policy if exists media_select on media;
create policy media_select on media
  for select to authenticated using (fn_can_read_media(bucket, path));

drop policy if exists "idea-media read own" on storage.objects;
create policy "idea-media read visible idea media" on storage.objects
  for select to authenticated
  using (bucket_id = 'idea-media' and fn_can_read_media(bucket_id, name));
