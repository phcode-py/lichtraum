-- New correspondence papers only. Existing messages, photos, walks and files are untouched.
create table public.correspondence_papers (
 id uuid primary key default gen_random_uuid(),
 owner uuid not null default auth.uid() references auth.users(id),
 author_name text not null check (char_length(author_name) between 1 and 80),
 title text not null check (char_length(title) between 1 and 80),
 shared boolean not null default true,
 x double precision not null default 740 check (x between 0 and 10000),
 y double precision not null default 70 check (y between 0 and 10000),
 created_at timestamptz not null default now()
);
alter table public.correspondence_papers enable row level security;
revoke all on public.correspondence_papers from anon, authenticated;
grant select, insert on public.correspondence_papers to authenticated;
grant update (x,y) on public.correspondence_papers to authenticated;
create policy "Read own and shared papers" on public.correspondence_papers for select to authenticated using (owner=(select auth.uid()) or shared);
create policy "Create own papers" on public.correspondence_papers for insert to authenticated with check (owner=(select auth.uid()));
create policy "Move accessible papers" on public.correspondence_papers for update to authenticated using (owner=(select auth.uid()) or shared) with check (owner=(select auth.uid()) or shared);

create table public.correspondence_entries (
 id uuid primary key default gen_random_uuid(),
 paper_id uuid not null references public.correspondence_papers(id),
 owner uuid not null default auth.uid() references auth.users(id),
 author_name text not null check (char_length(author_name) between 1 and 80),
 content text not null check (char_length(content) between 1 and 800),
 created_at timestamptz not null default now()
);
create index correspondence_entries_paper_created on public.correspondence_entries(paper_id,created_at);
alter table public.correspondence_entries enable row level security;
revoke all on public.correspondence_entries from anon, authenticated;
grant select, insert on public.correspondence_entries to authenticated;
create policy "Read accessible paper entries" on public.correspondence_entries for select to authenticated using (exists(select 1 from public.correspondence_papers p where p.id=paper_id));
create policy "Append own entries to accessible papers" on public.correspondence_entries for insert to authenticated with check (owner=(select auth.uid()) and exists(select 1 from public.correspondence_papers p where p.id=paper_id));
