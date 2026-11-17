-- PREPARED ONLY. Requires the earlier paper migrations. Do not apply without specific approval.
-- Existing content and positions are left intact; no historical edit dates are invented.
alter table public.correspondence_papers
 add column category text check(category in ('references','messages')),
 add column updated_at timestamptz;
alter table public.correspondence_papers alter column updated_at set default now();
create function public.edit_working_note(paper_id uuid,paper_title text,paper_material text,paper_shared boolean,paper_category text)
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
 set title=btrim(paper_title),material=paper_material,shared=paper_shared,category=paper_category
 where p.id=paper_id returning p.*;
end;
$$;
revoke all on function public.edit_working_note(uuid,text,text,boolean,text) from public,anon;
grant execute on function public.edit_working_note(uuid,text,text,boolean,text) to authenticated;


create function public.date_working_note_change() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.title,new.material,new.shared,new.category) is distinct from (old.title,old.material,old.shared,old.category) then
  new.updated_at=clock_timestamp();
 end if;
 return new;
end; $$;
create trigger date_working_note_change before update on public.correspondence_papers
 for each row execute function public.date_working_note_change();

create function public.date_working_note_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.correspondence_papers set updated_at=clock_timestamp() where id=new.paper_id;
 return new;
end; $$;
revoke all on function public.date_working_note_entry() from public,anon,authenticated;
create trigger date_working_note_entry after insert or update of content on public.correspondence_entries
 for each row execute function public.date_working_note_entry();
