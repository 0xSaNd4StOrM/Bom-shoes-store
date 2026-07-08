-- Allow admins to INSERT the store_settings singleton, so an upsert works too.
--
-- store_settings was created with an admin-only UPDATE policy and NO insert
-- policy, on the assumption that clients only ever UPDATE the migration-seeded
-- row. Any client code that used `.upsert()` (INSERT ... ON CONFLICT) therefore
-- hit "new row violates row-level security policy for table store_settings",
-- because the INSERT arm has no policy -- even though the row already exists and
-- the operation would resolve to an UPDATE.
--
-- Adding an admin INSERT policy is safe: the table's CHECK (id = the fixed
-- singleton uuid) means the only row that can ever exist is that one row, so an
-- admin upsert can only ever create/replace the singleton, never inject extra
-- rows, and non-admins are blocked by the WITH CHECK. This makes the table
-- tolerant of both `.update()` and `.upsert()` client code.
create policy "Admins can insert store settings"
  on public.store_settings for insert
  with check (public.is_admin());
