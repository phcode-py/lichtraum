-- Lichtraum: photographs, correspondence, and the private photo bucket.
-- Additive only: creates new tables, policies and a bucket. Safe to run once on a fresh project.

-- Photographs ---------------------------------------------------------------
create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null default 'Photographer' check (char_length(author_name) <= 80),
  title       text not null check (char_length(title) between 1 and 100),
  caption     text not null default '' check (char_length(caption) <= 600),
  place       text not null check (char_length(place) between 1 and 100),
  category    text not null default 'Reflection' check (category in ('Reflection', 'Light', 'Shadow', 'Other')),
  walk        text not null default '' check (char_length(walk) <= 100),
  shared      boolean not null default false,
  lat         double precision not null check (lat between 47.25 and 47.5),
  lng         double precision not null check (lng between 8.35 and 8.75),
  key         text not null unique,
  created_at  timestamptz not null default now()
);
create index photos_owner_created on public.photos (owner, created_at desc);
create index photos_shared_created on public.photos (created_at desc) where shared;

alter table public.photos enable row level security;

create policy "See own and shared photos" on public.photos
  for select to authenticated
  using (owner = (select auth.uid()) or shared);

create policy "Add own photos" on public.photos
  for insert to authenticated
  with check (owner = (select auth.uid()) and key like (select auth.uid())::text || '/%');

create policy "Delete own photos" on public.photos
  for delete to authenticated
  using (owner = (select auth.uid()));

-- Correspondence ------------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) <= 80),
  content     text not null check (char_length(content) between 1 and 800),
  created_at  timestamptz not null default now()
);
create index messages_created on public.messages (created_at desc);

alter table public.messages enable row level security;

create policy "Read correspondence" on public.messages
  for select to authenticated
  using (true);

create policy "Write own notes" on public.messages
  for insert to authenticated
  with check (owner = (select auth.uid()));

-- Contributors: counts every photograph (private ones too) without exposing them.
create function public.photo_contributors()
returns table (name text, count bigint, latest timestamptz)
language sql stable security definer set search_path = ''
as $$
  select (array_agg(p.author_name order by p.created_at desc))[1], count(*), max(p.created_at)
  from public.photos p
  group by p.owner
  order by max(p.created_at) desc
$$;
revoke execute on function public.photo_contributors() from public, anon;
grant execute on function public.photo_contributors() to authenticated;

-- Photo storage -------------------------------------------------------------
-- Private bucket; files live at <user id>/<uuid>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Upload into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "View own and shared photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.photos p where p.key = storage.objects.name and p.shared)
    )
  );

create policy "Delete from own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
