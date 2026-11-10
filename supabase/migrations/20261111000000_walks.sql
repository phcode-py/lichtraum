-- Recorded walks, and editing your own photographs (impressions).
-- Additive only: a new table, a function and a new policy. No existing rows or columns change.

create table public.walks (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) <= 80),
  title       text not null default '' check (char_length(title) <= 100),
  status      text not null default 'recording' check (status in ('recording', 'paused', 'ended')),
  shared      boolean not null default true,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  distance_m  double precision not null default 0 check (distance_m >= 0),
  duration_s  integer not null default 0 check (duration_s >= 0),
  -- GPS track: [[lng, lat, unix seconds, segment], ...]; a new segment starts after each pause.
  path        jsonb not null default '[]'::jsonb check (jsonb_typeof(path) = 'array' and jsonb_array_length(path) <= 50000),
  created_at  timestamptz not null default now()
);
create index walks_started on public.walks (started_at desc);
create index walks_owner_status on public.walks (owner, status);

alter table public.walks enable row level security;

create policy "See own and shared walks" on public.walks
  for select to authenticated
  using (owner = (select auth.uid()) or shared);

create policy "Start own walks" on public.walks
  for insert to authenticated
  with check (owner = (select auth.uid()));

create policy "Update own walks" on public.walks
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()));

-- Appends GPS points to a walk that is still open. Runs with the caller's rights, so RLS applies.
create function public.append_walk_points(walk_id uuid, points jsonb, distance double precision, duration integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.walks
     set path = path || points,
         distance_m = greatest(distance, 0),
         duration_s = greatest(duration, 0)
   where id = walk_id
     and owner = (select auth.uid())
     and status <> 'ended'
     and jsonb_typeof(points) = 'array'
$$;
revoke execute on function public.append_walk_points(uuid, jsonb, double precision, integer) from public, anon;
grant execute on function public.append_walk_points(uuid, jsonb, double precision, integer) to authenticated;

-- Photographs can be edited by their owner (title, caption, picture, sharing).
create policy "Edit own photos" on public.photos
  for update to authenticated
  using (owner = (select auth.uid()))
  with check (owner = (select auth.uid()) and key like (select auth.uid())::text || '/%');
