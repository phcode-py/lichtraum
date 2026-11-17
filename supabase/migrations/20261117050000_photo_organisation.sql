-- PREPARED ONLY: new companion metadata. No existing photo table, record, file,
-- conditions snapshot or bucket is altered, rewritten or removed.
create table public.photo_organisation (
 photo_id uuid primary key references public.photos(id) on delete cascade,
 tags jsonb not null check (jsonb_typeof(tags) = 'object')
);
alter table public.photo_organisation enable row level security;
create policy "Read tags of visible photos" on public.photo_organisation
 for select to authenticated using (exists (select 1 from public.photos p where p.id = photo_id));
create policy "Tag own photographs" on public.photo_organisation
 for insert to authenticated with check (exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid())));
create policy "Revise own photo tags" on public.photo_organisation
 for update to authenticated
 using (exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid())))
 with check (exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid())));
revoke all on public.photo_organisation from anon, authenticated;
grant select, insert, update on public.photo_organisation to authenticated;
-- No delete policy or delete permission is added. An explicitly deleted photo
-- follows the existing photo deletion flow and removes its companion metadata.
