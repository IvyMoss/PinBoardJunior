-- PinBoard Junior — auto-create a profile when a user signs up.
--
-- `profiles` holds the app-visible identity and is the owner FK for every
-- object. Without this, a freshly signed-up user has an auth.users row but no
-- profile, and any insert (ideas, boards) would fail its FK. This trigger
-- closes that gap so signup → capture works with no extra step.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base  text;
  final text;
  n     int := 0;
begin
  -- Prefer an explicit handle from signup metadata; else the email local part.
  base  := coalesce(nullif(new.raw_user_meta_data ->> 'handle', ''),
                    split_part(new.email, '@', 1));
  final := base;

  -- Handles are unique. On collision, append an incrementing suffix.
  loop
    begin
      insert into public.profiles (id, handle, display_name)
      values (new.id, final, new.raw_user_meta_data ->> 'display_name');
      exit;
    exception when unique_violation then
      n := n + 1;
      if n > 50 then raise; end if;   -- give up rather than loop forever
      final := base || n::text;
    end;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
