-- PinBoard Junior — table privileges for the API roles.
--
-- RLS decides WHICH ROWS a user may touch; GRANTs decide whether the role may
-- touch the table AT ALL. Both are required. Supabase exposes the database
-- through the `authenticated` (logged-in) and `anon` (logged-out) roles, so
-- they need table privileges. RLS still gates every row, so granting broad
-- table access here does NOT weaken security — a non-owner role cannot bypass
-- the policies in 0002.

grant usage on schema public to anon, authenticated;

-- Logged-in users: full table access, fully constrained by RLS.
grant all on all tables in schema public to authenticated;

-- Apply the same to any tables added by later migrations.
alter default privileges in schema public
  grant all on tables to authenticated;
