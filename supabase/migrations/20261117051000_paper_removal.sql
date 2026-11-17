-- PREPARED ONLY. No paper is removed by applying this migration.
-- Deliberate owner-confirmed removal hides a sheet; all notes and stored files are retained.
alter table public.correspondence_papers add column deleted_at timestamptz;
create policy "Hide removed papers" on public.correspondence_papers as restrictive
 for select to authenticated using (deleted_at is null);

create function public.archive_correspondence_paper(paper_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is null then return false; end if;
 update public.correspondence_papers p set deleted_at=clock_timestamp()
 where p.id=paper_id and p.owner=(select auth.uid()) and p.deleted_at is null;
 return found;
end; $$;
revoke all on function public.archive_correspondence_paper(uuid) from public,anon;
grant execute on function public.archive_correspondence_paper(uuid) to authenticated;

-- Existing metadata RPCs must also respect removed sheets under their privileged role.
create or replace function public.edit_correspondence_paper(paper_id uuid,paper_title text,paper_material text,paper_shared boolean)
returns setof public.correspondence_papers
language plpgsql security definer set search_path = ''
as $$
declare current_paper public.correspondence_papers%rowtype;
begin
 if (select auth.uid()) is null then return; end if;
 select p.* into current_paper from public.correspondence_papers p
 where p.id=paper_id and p.deleted_at is null and (p.owner=(select auth.uid()) or p.shared) for update;
 if not found then return; end if;
 if current_paper.owner<>(select auth.uid()) and paper_shared is distinct from current_paper.shared then
  raise exception 'Only the owner can change sharing' using errcode='42501';
 end if;
 return query update public.correspondence_papers p
 set title=btrim(paper_title),material=paper_material,shared=paper_shared
 where p.id=paper_id returning p.*;
end;
$$;

create or replace function public.edit_working_note(paper_id uuid,paper_title text,paper_material text,paper_shared boolean,paper_category text)
returns setof public.correspondence_papers
language plpgsql security definer set search_path = ''
as $$
declare current_paper public.correspondence_papers%rowtype;
begin
 if (select auth.uid()) is null then return; end if;
 select p.* into current_paper from public.correspondence_papers p
 where p.id=paper_id and p.deleted_at is null and (p.owner=(select auth.uid()) or p.shared) for update;
 if not found then return; end if;
 if current_paper.owner<>(select auth.uid()) and paper_shared is distinct from current_paper.shared then
  raise exception 'Only the owner can change sharing' using errcode='42501';
 end if;
 return query update public.correspondence_papers p
 set title=btrim(paper_title),material=paper_material,shared=paper_shared,category=paper_category
 where p.id=paper_id returning p.*;
end;
$$;
