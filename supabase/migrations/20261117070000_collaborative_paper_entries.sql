-- PREPARED ONLY. Coordinate live setup with Philipp; no migration is applied here.
-- Existing entries, authors, notes and files are retained. Edits are explicit and atomic per sheet.
alter table public.correspondence_entries add column updated_at timestamptz;
alter table public.correspondence_entries add column deleted_at timestamptz;
create policy "Hide removed paper entries" on public.correspondence_entries as restrictive
 for select to authenticated using (deleted_at is null);
create trigger date_removed_paper_entry after update of deleted_at on public.correspondence_entries
 for each row execute function public.date_working_note_entry();
alter table public.messages add column updated_at timestamptz;
create function public.date_paper_entry_edit() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp();return new;end; $$;
create trigger date_paper_entry_edit before update of content,image_key on public.correspondence_entries
 for each row execute function public.date_paper_entry_edit();
create trigger date_room_entry_edit before update of content,image_key on public.messages
 for each row execute function public.date_paper_entry_edit();

-- Original authorship stays fixed even when a collaborator attaches a new file in their own folder.
alter table public.correspondence_entries drop constraint if exists correspondence_entries_image_key_check;
alter table public.messages drop constraint if exists messages_image_key_check;
alter table public.correspondence_entries add constraint correspondence_entries_image_key_check check (image_key is null or image_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(\.(mp4|webm|mov))?$');
alter table public.messages add constraint messages_image_key_check check (image_key is null or image_key ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(\.(mp4|webm|mov))?$');

create function public.paper_reference_can_attach(reference_key text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and reference_key like (select auth.uid())::text||'/%'
 and exists(select 1 from storage.objects o where o.bucket_id='paper-references' and o.name=reference_key
  and ((o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 10485760)
    or (o.metadata->>'mimetype' in ('video/mp4','video/webm','video/quicktime') and (o.metadata->>'size')::bigint between 1 and 52428800)));
$$;
revoke all on function public.paper_reference_can_attach(text) from public,anon,authenticated;

create function public.edit_paper_entries(target_paper uuid,changes jsonb) returns setof public.correspondence_entries
language plpgsql security definer set search_path='' as $$
declare change jsonb;current_entry public.correspondence_entries%rowtype;new_key text;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first' using errcode='42501';end if;
 if jsonb_typeof(changes) is distinct from 'array' then raise exception 'Invalid entries' using errcode='22023';end if;
 if jsonb_array_length(changes) not between 1 and 100 then raise exception 'Invalid entries' using errcode='22023';end if;
 perform p.id from public.correspondence_papers p where p.id=target_paper and p.deleted_at is null and (p.owner=(select auth.uid()) or p.shared) for update;
 if not found then raise exception 'Paper unavailable' using errcode='42501';end if;
 if jsonb_array_length(changes)<>(select count(distinct value->>'entryId') from jsonb_array_elements(changes)) then raise exception 'Duplicate entries' using errcode='22023';end if;
 for change in select value from jsonb_array_elements(changes) order by value->>'entryId' loop
  select e.* into current_entry from public.correspondence_entries e where e.id=(change->>'entryId')::uuid and e.paper_id=target_paper and e.deleted_at is null for update;
  if not found then raise exception 'Entry unavailable' using errcode='42501';end if;
  if change->'delete'='true'::jsonb then
   return query update public.correspondence_entries e set deleted_at=clock_timestamp(),updated_at=clock_timestamp() where e.id=current_entry.id returning e.*;
   continue;
  end if;
  if jsonb_typeof(change->'content') is distinct from 'string' or char_length(btrim(change->>'content')) not between 1 and 800 then raise exception 'Invalid entry text' using errcode='22023';end if;
  new_key=current_entry.image_key;
  if change ? 'imageKey' then
   new_key=change->>'imageKey';
   if new_key is not null and not public.paper_reference_can_attach(new_key) then raise exception 'Reference unavailable' using errcode='42501';end if;
  end if;
  return query update public.correspondence_entries e set content=btrim(change->>'content'),image_key=new_key where e.id=current_entry.id returning e.*;
 end loop;
end; $$;
revoke all on function public.edit_paper_entries(uuid,jsonb) from public,anon;
grant execute on function public.edit_paper_entries(uuid,jsonb) to authenticated;

create function public.edit_room_entries(changes jsonb) returns setof public.messages
language plpgsql security definer set search_path='' as $$
declare change jsonb;current_entry public.messages%rowtype;new_key text;
begin
 if (select auth.uid()) is null then raise exception 'Sign in first' using errcode='42501';end if;
 if jsonb_typeof(changes) is distinct from 'array' then raise exception 'Invalid entries' using errcode='22023';end if;
 if jsonb_array_length(changes) not between 1 and 100 then raise exception 'Invalid entries' using errcode='22023';end if;
 if jsonb_array_length(changes)<>(select count(distinct value->>'entryId') from jsonb_array_elements(changes)) then raise exception 'Duplicate entries' using errcode='22023';end if;
 for change in select value from jsonb_array_elements(changes) order by value->>'entryId' loop
  if jsonb_typeof(change->'content') is distinct from 'string' or char_length(btrim(change->>'content')) not between 1 and 800 then raise exception 'Invalid entry text' using errcode='22023';end if;
  select e.* into current_entry from public.messages e where e.id=(change->>'entryId')::uuid for update;
  if not found then raise exception 'Entry unavailable' using errcode='42501';end if;
  if change->'delete'='true'::jsonb then raise exception 'Chat entries cannot be removed here' using errcode='22023';end if;
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

-- No direct image-key update grants, automatic storage deletion, or author changes.
