-- Member admission: new accounts wait until an admin admits them.
--
-- Adds a new `members` table (one row per account), admits every account that
-- exists when this runs (and makes them admins), and blocks accounts that are
-- not yet admitted from all tables, storage and database functions.
-- Deletes nothing and does not change any existing photo, walk, paper or file.
-- See docs/member-admission-setup.md for how to apply, check and undo.

-- 1. Who may use the atlas ---------------------------------------------------
create table public.members (
 user_id      uuid primary key references auth.users(id) on delete cascade,
 name         text not null default '' check (char_length(name) <= 80),
 email        text not null default '' check (char_length(email) <= 320),
 status       text not null default 'pending' check (status in ('pending','approved','declined')),
 is_admin     boolean not null default false,
 requested_at timestamptz not null default now(),
 decided_at   timestamptz,
 decided_by   uuid references auth.users(id) on delete set null
);
create index members_pending on public.members (requested_at) where status = 'pending';
alter table public.members enable row level security;
-- No direct table access at all; everything goes through the functions below.
revoke all on public.members from anon, authenticated;

-- Everyone already signed up is admitted and becomes an admin.
insert into public.members (user_id, name, email, status, is_admin, requested_at, decided_at)
select u.id,
       left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), ''), 80),
       coalesce(u.email, ''),
       'approved', true, u.created_at, now()
from auth.users u
on conflict (user_id) do nothing;

-- Every new sign-up becomes a pending join request.
create function public.request_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.members (user_id, name, email)
 values (new.id,
         left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1), ''), 80),
         left(coalesce(new.email, ''), 320))
 on conflict (user_id) do nothing;
 return new;
end;$$;
revoke all on function public.request_membership() from public, anon, authenticated;
create trigger request_membership after insert on auth.users
 for each row execute function public.request_membership();

-- 2. Helpers -----------------------------------------------------------------
create function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.members m where m.user_id = (select auth.uid()) and m.status = 'approved')
$$;
create function public.is_member_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.members m where m.user_id = (select auth.uid()) and m.status = 'approved' and m.is_admin)
$$;
revoke all on function public.is_member(), public.is_member_admin() from public, anon;
grant execute on function public.is_member(), public.is_member_admin() to authenticated;

-- The one call a waiting account may make: its own status.
create function public.my_membership() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('status', coalesce(m.status, 'pending'), 'admin', coalesce(m.status = 'approved' and m.is_admin, false))
 from (select 1) one left join public.members m on m.user_id = (select auth.uid())
$$;
revoke all on function public.my_membership() from public, anon;
grant execute on function public.my_membership() to authenticated;

-- 3. Admin actions -------------------------------------------------------------
create function public.join_requests() returns table(id uuid, name text, email text, requested_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_member_admin() then raise insufficient_privilege; end if;
 return query select m.user_id, m.name, m.email, m.requested_at
  from public.members m where m.status = 'pending' order by m.requested_at, m.user_id;
end;$$;

-- One admin deciding is enough. Returns the request's status afterwards and
-- whether this call made the decision (false when another admin was quicker).
create function public.decide_join_request(person uuid, admit boolean)
returns table(status text, decided boolean, decided_by_name text)
language plpgsql security definer set search_path = '' as $$
declare changed boolean;
begin
 if not public.is_member_admin() then raise insufficient_privilege; end if;
 if person is null or admit is null then raise invalid_parameter_value; end if;
 update public.members m
  set status = case when admit then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid()
  where m.user_id = person and m.status = 'pending';
 changed := found;
 return query select m.status, changed, coalesce(d.name, '')
  from public.members m left join public.members d on d.user_id = m.decided_by
  where m.user_id = person;
end;$$;
revoke all on function public.join_requests(), public.decide_join_request(uuid, boolean) from public, anon;
grant execute on function public.join_requests(), public.decide_join_request(uuid, boolean) to authenticated;

-- 4. Keep waiting accounts out of every table and every file ------------------
-- Restrictive policies are added on top of the existing ones (both must pass),
-- so none of the existing policies need to change.
do $$
declare t text;
begin
 foreach t in array array['photos','messages','walks','correspondence_papers','correspondence_entries',
  'photo_conditions','correspondence_sheet_settings','photo_organisation','photo_tracings',
  'walk_map_tracings','correspondence_paper_tags','walk_participants'] loop
  execute format('create policy "Admitted members only" on public.%I as restrictive for all to authenticated
   using ((select public.is_member())) with check ((select public.is_member()))', t);
 end loop;
end $$;
create policy "Admitted members only" on storage.objects as restrictive for all to authenticated
 using ((select public.is_member())) with check ((select public.is_member()));

-- People pickers (walk participants) only offer admitted members.
create or replace function public.search_walk_people(walk_id uuid,query text) returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.walks w where w.id=$1 and w.owner=auth.uid()) then raise insufficient_privilege; end if;
 if char_length(btrim($2)) not between 2 and 80 then return; end if;
 return query select u.id,left(btrim(u.raw_user_meta_data->>'full_name'),80) from auth.users u
  join public.members a on a.user_id=u.id and a.status='approved'
  where u.id<>auth.uid() and u.email_confirmed_at is not null and nullif(btrim(u.raw_user_meta_data->>'full_name'),'') is not null
  and position(lower(btrim($2)) in lower(u.raw_user_meta_data->>'full_name'))>0 order by u.raw_user_meta_data->>'full_name',u.id limit 20;
end;$$;
create or replace function public.set_walk_participants(walk_id uuid,people uuid[]) returns table(id uuid,name text)
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.walks w where w.id=$1 and w.owner=auth.uid() for update;
 if not found or auth.uid() is null then raise insufficient_privilege; end if;
 if $2 is null or cardinality($2)>20 or array_position($2,null) is not null or auth.uid()=any($2) then raise invalid_parameter_value; end if;
 if (select count(distinct u.id) from auth.users u join public.members a on a.user_id=u.id and a.status='approved' where u.id=any($2) and u.email_confirmed_at is not null)<>cardinality($2) then raise invalid_parameter_value; end if;
 update public.walk_participants m set active=false where m.walk_id=$1 and m.active;
 insert into public.walk_participants as member(walk_id,user_id,name,active)
  select $1,u.id,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'Photographer'),80),true from auth.users u where u.id=any($2)
  on conflict on constraint walk_participants_pkey do update set name=excluded.name,active=true;
 return query select m.user_id,m.name from public.walk_participants m where m.walk_id=$1 and m.active order by m.name,m.user_id;
end;$$;

-- 5. Keep waiting accounts out of every database function -----------------------
-- Several existing functions run with elevated rights and skip table policies.
-- This check runs before every API request instead of changing each function.
create function public.admitted_members_only() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
 if (select auth.uid()) is not null
    and coalesce(current_setting('request.path', true), '') <> '/rpc/my_membership'
    and not public.is_member() then
  raise insufficient_privilege using message = 'Your account is waiting to be admitted.';
 end if;
end;$$;
revoke all on function public.admitted_members_only() from public;
grant execute on function public.admitted_members_only() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.admitted_members_only';
notify pgrst, 'reload config';
