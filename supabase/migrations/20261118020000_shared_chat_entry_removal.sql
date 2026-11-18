-- PREPARED ONLY. Philipp must review and apply separately.
-- Risky permission change: participants can hide anyone's chat entries.
-- Soft removal only: original rows, authorship and reference files remain stored.
-- Requires 20261117070000_collaborative_paper_entries.sql.
alter table public.messages add column if not exists deleted_at timestamptz;
create policy "Hide removed chat entries" on public.messages as restrictive
 for select to authenticated using (deleted_at is null);

create or replace function public.edit_room_entries(changes jsonb) returns setof public.messages
language plpgsql security definer set search_path='' as $$
declare change jsonb;current_entry public.messages%rowtype;new_key text;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first' using errcode='42501';end if;
 if jsonb_typeof(changes) is distinct from 'array' then raise exception 'Invalid entries' using errcode='22023';end if;
 if jsonb_array_length(changes) not between 1 and 100 then raise exception 'Invalid entries' using errcode='22023';end if;
 if jsonb_array_length(changes)<>(select count(distinct value->>'entryId') from jsonb_array_elements(changes)) then raise exception 'Duplicate entries' using errcode='22023';end if;
 for change in select value from jsonb_array_elements(changes) order by value->>'entryId' loop
  select e.* into current_entry from public.messages e where e.id=(change->>'entryId')::uuid and e.deleted_at is null for update;
  if not found then raise exception 'Entry unavailable' using errcode='42501';end if;
  if change->'delete'='true'::jsonb then
   return query update public.messages e set deleted_at=clock_timestamp(),updated_at=clock_timestamp() where e.id=current_entry.id returning e.*;
   continue;
  end if;
  if jsonb_typeof(change->'content') is distinct from 'string' or char_length(btrim(change->>'content')) not between 1 and 800 then raise exception 'Invalid entry text' using errcode='22023';end if;
  new_key=current_entry.image_key;
  if change ? 'imageKey' then
   new_key=change->>'imageKey';
   if new_key is not null and not public.paper_reference_can_attach(new_key) then raise exception 'Reference unavailable' using errcode='42501';end if;
  end if;
  return query update public.messages e set content=btrim(change->>'content'),image_key=new_key where e.id=current_entry.id returning e.*;
 end loop;
end; $$;
revoke all on function public.edit_room_entries(jsonb) from public,anon;
grant execute on function public.edit_room_entries(jsonb) to authenticated;

