-- Lets photographers correct when (and where) their own photograph was taken.
-- Prepared only: review and apply separately (see docs/photo-condition-edits-setup.md).
-- Risky change to existing storage: an owner's edit replaces the saved sun and weather
-- snapshot of that photograph. Nothing is deleted, and other people's records are untouched.
create policy "Correct conditions of own photos" on public.photo_conditions
  for update to authenticated
  using (exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid())))
  with check (exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid())));
grant update (snapshot) on public.photo_conditions to authenticated;
