-- PREPARED ONLY. Creates a separate private video bucket; leaves photos and all existing files unchanged.
-- Video posts use the existing photos table, with <owner>/<uuid>.mp4, .webm or .mov as key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "Upload videos into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "View own and shared videos" on storage.objects
  for select to authenticated
  using (bucket_id = 'videos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.photos p where p.key = storage.objects.name and p.shared)
  ));

create policy "Delete own video after confirmation" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = (select auth.uid())::text);
