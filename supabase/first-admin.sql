-- Run in SQL Editor AFTER this Gmail has signed in through Google once.
-- This is an owner operation, never exposed as a website endpoint.
do $$
declare admin_id uuid;
begin
  select id into admin_id from auth.users
  where lower(email) = 'phungquangthai123ok@gmail.com'
    and email_confirmed_at is not null
    and exists(select 1 from auth.identities where user_id = auth.users.id and provider='google');
  if admin_id is null then
    raise exception 'Gmail admin must sign in with Google first';
  end if;
  update public.profiles set role='admin' where id=admin_id;
  if not found then raise exception 'Apply schema.sql first'; end if;
end;
$$;
