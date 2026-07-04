-- AdminUsers.tsx disables the role <select> for the signed-in admin's own
-- row, but that's a DOM attribute, not enforcement: any client can still
-- call supabase.from('profiles').update({ role: ... }).eq('id', <own id>)
-- directly (browser console, raw PostgREST request) and change their own
-- role. Enforce the "can't touch your own role" rule at the data layer
-- instead, where every write path -- UI, console, script -- has to go
-- through it.
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() is null for service-role/backend calls that carry no user
  -- JWT (e.g. admin scripts) -- those are intentionally not restricted here.
  if auth.uid() is not null and auth.uid() = OLD.id and NEW.role is distinct from OLD.role then
    raise exception 'You cannot change your own role.';
  end if;
  return NEW;
end;
$$;

comment on function public.prevent_self_role_change() is
  'Blocks a profiles.role UPDATE where the caller is changing their own row''s role, so self-demotion/self-promotion can''t happen via a direct API call even though the admin UI already disables the control client-side.';

create trigger prevent_self_role_change
  before update on public.profiles
  for each row execute function public.prevent_self_role_change();
