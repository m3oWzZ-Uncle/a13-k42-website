-- Run once in the SQL Editor of a NEW Supabase project.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'viewer' check (role in ('viewer', 'admin')),
  created_at timestamptz not null default now()
);
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('memory', 'milestone', 'note')),
  title text not null check (length(title) between 1 and 160),
  body text not null default '' check (length(body) <= 10000),
  happened_on date,
  image_path text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index entries_created_at_idx on public.entries(created_at desc);
alter table public.profiles enable row level security;
alter table public.entries enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, email, display_name, role)
  values(new.id, coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data->>'full_name', new.email, ''), 160), 'viewer');
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
-- Backfill users who logged in before this migration; metadata never sets roles.
insert into public.profiles(id, email, display_name)
select id, coalesce(email, ''), left(coalesce(raw_user_meta_data->>'full_name', email, ''),160)
from auth.users on conflict(id) do nothing;

revoke all on public.profiles, public.entries from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy entries_read on public.entries for select to authenticated using (true);
create policy entries_insert on public.entries for insert to authenticated
with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy entries_update on public.entries for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy entries_delete on public.entries for delete to authenticated
using ((select public.is_admin()));

-- Only this RPC can change roles from the website. Protect the last admin.
create function public.set_member_role(target_user uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare target_role text;
begin
  perform pg_advisory_xact_lock(134242);
  if not public.is_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  if new_role not in ('viewer','admin') or new_role is null then raise exception 'Invalid role'; end if;
  select role into target_role from public.profiles where id = target_user for update;
  if target_role is null then raise exception 'Account not found'; end if;
  if target_role = 'admin' and new_role = 'viewer'
    and (select count(*) from public.profiles where role='admin') <= 1 then
    raise exception 'Cannot remove the last admin';
  end if;
  update public.profiles set role = new_role where id = target_user;
end;
$$;
revoke all on function public.set_member_role(uuid,text) from public;
grant execute on function public.set_member_role(uuid,text) to authenticated;

-- Photos are PRIVATE. A signed-in member can view, only admins can write.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('class-photos','class-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy class_photos_read on storage.objects for select to authenticated
using (bucket_id = 'class-photos');
create policy class_photos_insert on storage.objects for insert to authenticated
with check (bucket_id = 'class-photos' and (select public.is_admin()));
create policy class_photos_update on storage.objects for update to authenticated
using (bucket_id = 'class-photos' and (select public.is_admin()))
with check (bucket_id = 'class-photos' and (select public.is_admin()));
create policy class_photos_delete on storage.objects for delete to authenticated
using (bucket_id = 'class-photos' and (select public.is_admin()));
commit;
