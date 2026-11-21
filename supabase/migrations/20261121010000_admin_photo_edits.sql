-- Admins may edit every photograph they can see (their own and all shared ones):
-- picture, title, place and pin, time taken, walk, description, tags and sharing.
-- Owners may now also correct the time taken of photographs that already have a
-- sun and weather record (replaces the never-applied 20261120000000 proposal).
-- Deleting stays with the owner. Nothing is deleted or rewritten by this migration.

-- Nobody, admins included, can change who a photograph belongs to.
create function public.keep_photo_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.id is distinct from old.id or new.owner is distinct from old.owner or new.created_at is distinct from old.created_at then
  raise insufficient_privilege using message = 'A photograph keeps its owner and upload date.';
 end if;
 return new;
end;$$;
revoke all on function public.keep_photo_identity() from public, anon, authenticated;
create trigger keep_photo_identity before update on public.photos
 for each row execute function public.keep_photo_identity();

-- Photographs: admins edit; a new picture must sit in the owner's folder.
create policy "Admins edit visible photographs" on public.photos for update to authenticated
 using ((select public.is_member_admin()))
 with check ((select public.is_member_admin()) and key like owner::text || '/%');

-- Sun and weather snapshot: owners and admins may replace it (time taken).
grant update (snapshot) on public.photo_conditions to authenticated;
create policy "Owners and admins correct conditions" on public.photo_conditions for update to authenticated
 using (exists (select 1 from public.photos p where p.id = photo_id and (p.owner = (select auth.uid()) or (select public.is_member_admin()))))
 with check (exists (select 1 from public.photos p where p.id = photo_id and (p.owner = (select auth.uid()) or (select public.is_member_admin()))));
create policy "Admins attach conditions to visible photographs" on public.photo_conditions for insert to authenticated
 with check ((select public.is_member_admin()) and exists (select 1 from public.photos p where p.id = photo_id));

-- Tags: admins may tag any photograph they can see.
create policy "Admins tag visible photographs" on public.photo_organisation for insert to authenticated
 with check ((select public.is_member_admin()) and exists (select 1 from public.photos p where p.id = photo_id));
create policy "Admins revise tags of visible photographs" on public.photo_organisation for update to authenticated
 using ((select public.is_member_admin()) and exists (select 1 from public.photos p where p.id = photo_id))
 with check ((select public.is_member_admin()) and exists (select 1 from public.photos p where p.id = photo_id));

-- A replacement picture is uploaded into the owner's folder, so the owner keeps
-- seeing and controlling it. Admins can read back only files they uploaded themselves.
create policy "Admins upload replacement pictures" on storage.objects for insert to authenticated
 with check (bucket_id in ('photos', 'videos') and (select public.is_member_admin()));
create policy "Admins see pictures they uploaded" on storage.objects for select to authenticated
 using (bucket_id in ('photos', 'videos') and owner_id = (select auth.uid())::text and (select public.is_member_admin()));
