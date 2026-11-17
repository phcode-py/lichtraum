-- PREPARED ONLY. Enables reference images alongside notes; does not change existing notes/files.
alter table public.correspondence_entries add column image_key text
 check (image_key is null or image_key like owner::text || '/%');
alter table public.messages add column image_key text
 check (image_key is null or image_key like owner::text || '/%');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('paper-references','paper-references',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy "Upload own paper references" on storage.objects for insert to authenticated
 with check(bucket_id='paper-references' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Read accessible paper references" on storage.objects for select to authenticated
 using(bucket_id='paper-references' and (
  (storage.foldername(name))[1]=(select auth.uid())::text
  or exists(select 1 from public.correspondence_entries e where e.image_key=storage.objects.name)
  or exists(select 1 from public.messages m where m.image_key=storage.objects.name)
 ));
-- Existing note/table read policies restrict these EXISTS checks to accessible notes.
-- No overwrite or automatic file deletion policy is added.
