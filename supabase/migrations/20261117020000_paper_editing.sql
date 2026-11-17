-- PREPARED ONLY. Requires the earlier paper tables and paper-material migration.
-- Enables deliberate edits; applying this file does not edit any existing papers or notes.

-- Shared papers can be renamed/retyped by participants; privacy remains owner-only.
-- Keep the existing direct column grants restricted to x/y. Metadata goes through this function.
create function public.edit_correspondence_paper(paper_id uuid,paper_title text,paper_material text,paper_shared boolean)
returns setof public.correspondence_papers
language plpgsql security definer set search_path = ''
as $$
declare current_paper public.correspondence_papers%rowtype;
begin
 if (select auth.uid()) is null then return; end if;
 select p.* into current_paper from public.correspondence_papers p
 where p.id=paper_id and (p.owner=(select auth.uid()) or p.shared) for update;
 if not found then return; end if;
 if current_paper.owner<>(select auth.uid()) and paper_shared is distinct from current_paper.shared then
  raise exception 'Only the owner can change sharing' using errcode='42501';
 end if;
 return query update public.correspondence_papers p
 set title=btrim(paper_title),material=paper_material,shared=paper_shared
 where p.id=paper_id returning p.*;
end;
$$;
revoke all on function public.edit_correspondence_paper(uuid,text,text,boolean) from public,anon;
grant execute on function public.edit_correspondence_paper(uuid,text,text,boolean) to authenticated;

-- Built-in sheets keep their content sources and gain shared appearance settings.
create table public.correspondence_sheet_settings (
 id text primary key check (id in ('room','contributors')),
 title text not null check (char_length(title) between 1 and 80),
 material text not null check (material in ('opaque','tracing'))
);
alter table public.correspondence_sheet_settings enable row level security;
revoke all on public.correspondence_sheet_settings from anon,authenticated;
grant select,insert,update on public.correspondence_sheet_settings to authenticated;
create policy "Read built-in sheet settings" on public.correspondence_sheet_settings for select to authenticated using (true);
create policy "Create built-in sheet settings" on public.correspondence_sheet_settings for insert to authenticated with check (true);
create policy "Edit built-in sheet settings" on public.correspondence_sheet_settings for update to authenticated using (true) with check (true);

-- Notes remain attributed to their author. Only that author can correct their text.
grant update(content) on public.correspondence_entries to authenticated;
create policy "Edit own accessible entries" on public.correspondence_entries for update to authenticated
 using (owner=(select auth.uid()) and exists(select 1 from public.correspondence_papers p where p.id=paper_id))
 with check (owner=(select auth.uid()) and exists(select 1 from public.correspondence_papers p where p.id=paper_id));
grant update(content) on public.messages to authenticated;
create policy "Edit own room notes" on public.messages for update to authenticated
 using (owner=(select auth.uid())) with check (owner=(select auth.uid()));
