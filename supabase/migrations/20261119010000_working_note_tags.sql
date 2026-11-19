-- PREPARED ONLY for Philipp's review. No existing table, paper, photograph,
-- entry, file, bucket, position or saved photo tag is changed by this migration.
create function public.working_note_tags_valid(value jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
begin
 if jsonb_typeof(value) <> 'object' or pg_column_size(value)>4096 then return false; end if;
 if not (value ?& array['imageTypes','weather','timeOfDay','area']) or
    exists(select 1 from jsonb_object_keys(value) k where k not in ('imageTypes','weather','timeOfDay','area')) then return false; end if;
 if jsonb_typeof(value->'imageTypes') <> 'array' or jsonb_typeof(value->'weather') <> 'array' or
    jsonb_typeof(value->'timeOfDay') <> 'string' or jsonb_typeof(value->'area') <> 'string' then return false; end if;
 return jsonb_array_length(value->'imageTypes')<=6 and jsonb_array_length(value->'weather')<=6
  and value->'imageTypes' <@ '["light-shadow-patterns","reflected-light-facades","light-reflected-windows-facades","reflections-water","reflections-windows-facades","light-scattering"]'::jsonb
  and value->'weather' <@ '["clear","partly-cloudy","overcast","precipitation","humid","windy"]'::jsonb
  and value->>'timeOfDay' in ('','early-morning','morning','midday','afternoon','evening','night')
  and value->>'area' in ('','industrial','residential','city-centre','waterfront','park-nature','mixed-use');
exception when others then return false;
end;
$$;
revoke all on function public.working_note_tags_valid(jsonb) from public;
grant execute on function public.working_note_tags_valid(jsonb) to authenticated;
create table public.correspondence_paper_tags (
 sheet_id text primary key check (sheet_id in ('room','contributors') or sheet_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
 tags jsonb not null check (public.working_note_tags_valid(tags))
);
alter table public.correspondence_paper_tags enable row level security;
create policy "Read tags on accessible working notes" on public.correspondence_paper_tags
 for select to authenticated using (
  sheet_id in ('room','contributors') or exists(select 1 from public.correspondence_papers p where p.id::text=sheet_id)
 );
create policy "Tag accessible working notes" on public.correspondence_paper_tags
 for insert to authenticated with check (
  sheet_id in ('room','contributors') or exists(select 1 from public.correspondence_papers p where p.id::text=sheet_id)
 );
create policy "Revise tags on accessible working notes" on public.correspondence_paper_tags
 for update to authenticated using (
  sheet_id in ('room','contributors') or exists(select 1 from public.correspondence_papers p where p.id::text=sheet_id)
 ) with check (
  sheet_id in ('room','contributors') or exists(select 1 from public.correspondence_papers p where p.id::text=sheet_id)
 );
revoke all on public.correspondence_paper_tags from anon,authenticated;
grant select,insert,update on public.correspondence_paper_tags to authenticated;
-- No delete permission. Existing paper visibility (including archival) remains
-- governed by its existing RLS; no policies on existing tables are changed.
