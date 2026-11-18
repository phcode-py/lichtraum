-- PREPARED ONLY. Coordinate application with Philipp; do not apply during code upload.
-- New companion rows only. No existing photograph, file or walk is rewritten.
create function public.valid_photo_tracing(value jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare stroke jsonb; point jsonb; total integer := 0;
begin
 if jsonb_typeof(value) <> 'array' or jsonb_array_length(value) > 200 then return false; end if;
 for stroke in select * from jsonb_array_elements(value) loop
  if jsonb_typeof(stroke) <> 'object' or not (stroke ? 'points') or jsonb_typeof(stroke->'points') <> 'array' then return false; end if;
  if jsonb_array_length(stroke->'points') < 1 or jsonb_array_length(stroke->'points') > 2500 then return false; end if;
  total := total + jsonb_array_length(stroke->'points');
  if total > 20000 then return false; end if;
  for point in select * from jsonb_array_elements(stroke->'points') loop
   if jsonb_typeof(point) <> 'array' or jsonb_array_length(point) <> 2 then return false; end if;
   if jsonb_typeof(point->0) <> 'number' or jsonb_typeof(point->1) <> 'number' then return false; end if;
   if (point->>0)::numeric < 0 or (point->>0)::numeric > 1 or (point->>1)::numeric < 0 or (point->>1)::numeric > 1 then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create table public.photo_tracings (
 photo_id uuid not null references public.photos(id) on delete cascade,
 image_key text not null,
 owner uuid not null references auth.users(id) on delete cascade,
 author_name text not null check (char_length(author_name) <= 80),
 strokes jsonb not null default '[]'::jsonb check (public.valid_photo_tracing(strokes)),
 revision integer not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 primary key (photo_id,owner,image_key)
);
alter table public.photo_tracings enable row level security;
create policy "See tracings on accessible photographs" on public.photo_tracings for select to authenticated
 using (exists (select 1 from public.photos p where p.id=photo_id and p.key=image_key));
create policy "Draw a personal layer on an accessible photograph" on public.photo_tracings for insert to authenticated
 with check (owner=(select auth.uid()) and exists (select 1 from public.photos p where p.id=photo_id and p.key=image_key));
create policy "Edit only your own tracing layer" on public.photo_tracings for update to authenticated
 using (owner=(select auth.uid()) and exists (select 1 from public.photos p where p.id=photo_id and p.key=image_key))
 with check (owner=(select auth.uid()) and exists (select 1 from public.photos p where p.id=photo_id and p.key=image_key));
revoke all on public.photo_tracings from anon,authenticated;
grant select,insert,update on public.photo_tracings to authenticated;
revoke all on function public.valid_photo_tracing(jsonb) from public;
grant execute on function public.valid_photo_tracing(jsonb) to authenticated;
-- No DELETE permission or policy. Removing a photo follows its existing explicit deletion flow.
