-- PREPARED ONLY. Notify Philipp and coordinate review/application separately.
-- Adds companion drawing rows and read access to their referenced sketch files.
-- Does not rewrite any existing walks, notes, images, buckets or policies.
create function public.valid_map_tracing_point(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
 return jsonb_typeof(value)='array' and jsonb_array_length(value)=2
 and jsonb_typeof(value->0)='number' and jsonb_typeof(value->1)='number'
 and abs((value->>0)::numeric)<=180 and abs((value->>1)::numeric)<=85;
exception when others then return false;
end $$;
create function public.valid_walk_map_tracing(value jsonb,author uuid) returns boolean
language plpgsql stable set search_path='' as $$
declare item jsonb;point jsonb;total integer:=0;ids text[]:='{}';
begin
 if jsonb_typeof(value) is distinct from 'object' or jsonb_typeof(value->'strokes') is distinct from 'array' or jsonb_typeof(value->'notes') is distinct from 'array' or jsonb_typeof(value->'sketches') is distinct from 'array' then return false;end if;
 if jsonb_array_length(value->'strokes')>200 or jsonb_array_length(value->'notes')>50 or jsonb_array_length(value->'sketches')>3 then return false;end if;
 for item in select * from jsonb_array_elements(value->'strokes') loop
  if jsonb_typeof(item->'points') is distinct from 'array' or jsonb_array_length(item->'points') not between 1 and 2500 then return false;end if;
  total:=total+jsonb_array_length(item->'points');if total>20000 then return false;end if;
  for point in select * from jsonb_array_elements(item->'points') loop if public.valid_map_tracing_point(point) is distinct from true then return false;end if;end loop;
 end loop;
 for item in select * from jsonb_array_elements(value->'notes') loop
  if jsonb_typeof(item->'id') is distinct from 'string' or (item->>'id') !~ '^[a-zA-Z0-9-]{1,80}$' or (item->>'id')=any(ids) or public.valid_map_tracing_point(item->'point') is distinct from true or jsonb_typeof(item->'text') is distinct from 'string' or char_length(btrim(item->>'text')) not between 1 and 600 then return false;end if;
  ids:=array_append(ids,item->>'id');
 end loop;
 for item in select * from jsonb_array_elements(value->'sketches') loop
  if jsonb_typeof(item->'id') is distinct from 'string' or (item->>'id') !~ '^[a-zA-Z0-9-]{1,80}$' or (item->>'id')=any(ids) or jsonb_typeof(item->'key') is distinct from 'string' or (item->>'key') !~ ('^'||author::text||'/[0-9a-f-]{36}$') or jsonb_typeof(item->'corners') is distinct from 'array' or jsonb_array_length(item->'corners')<>4 or jsonb_typeof(item->'opacity') is distinct from 'number' or (item->>'opacity')::numeric not between .05 and 1 or jsonb_typeof(item->'rotation') is distinct from 'number' or (item->>'rotation')::numeric not between -180 and 180 then return false;end if;
  ids:=array_append(ids,item->>'id');
  for point in select * from jsonb_array_elements(item->'corners') loop if public.valid_map_tracing_point(point) is distinct from true then return false;end if;end loop;
  if not exists(select 1 from storage.objects o where o.bucket_id='paper-references' and o.name=item->>'key' and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 10485760) then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;
create table public.walk_map_tracings(
 walk_id uuid not null references public.walks(id),
 owner uuid not null references auth.users(id),
 author_name text not null check(char_length(author_name)<=80),
 drawing jsonb not null check(public.valid_walk_map_tracing(drawing,owner)),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(walk_id,owner)
);
alter table public.walk_map_tracings enable row level security;
create policy "See map tracings on accessible walks" on public.walk_map_tracings for select to authenticated
 using(exists(select 1 from public.walks w where w.id=walk_id));
create policy "Add a personal map layer" on public.walk_map_tracings for insert to authenticated
 with check(owner=(select auth.uid()) and exists(select 1 from public.walks w where w.id=walk_id));
create policy "Edit a personal map layer" on public.walk_map_tracings for update to authenticated
 using(owner=(select auth.uid()) and exists(select 1 from public.walks w where w.id=walk_id))
 with check(owner=(select auth.uid()) and exists(select 1 from public.walks w where w.id=walk_id));
revoke all on public.walk_map_tracings from anon,authenticated;
grant select,insert,update on public.walk_map_tracings to authenticated;
create policy "Read sketch references on accessible walks" on storage.objects for select to authenticated
 using(bucket_id='paper-references' and exists(select 1 from public.walk_map_tracings t,jsonb_array_elements(t.drawing->'sketches') sketch where sketch->>'key'=storage.objects.name));
revoke all on function public.valid_map_tracing_point(jsonb),public.valid_walk_map_tracing(jsonb,uuid) from public;
grant execute on function public.valid_map_tracing_point(jsonb),public.valid_walk_map_tracing(jsonb,uuid) to authenticated;
-- No DELETE or overwrite grants. Hiding a layer changes only local presentation.
