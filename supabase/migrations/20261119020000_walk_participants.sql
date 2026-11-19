-- PREPARED ONLY. Philipp must review the new access before applying.
-- No existing row or stored file is changed. Existing photo privacy is preserved.
create table public.walk_participants (
 walk_id uuid not null references public.walks(id) on delete cascade,
 user_id uuid not null references auth.users(id),
 name text not null check(char_length(name) between 1 and 80),
 active boolean not null default true,
 primary key(walk_id,user_id)
);
alter table public.walk_participants enable row level security;
create function public.is_walk_participant(walk_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.walk_participants m where m.walk_id=$1 and m.user_id=(select auth.uid()) and m.active)
$$;
revoke all on function public.is_walk_participant(uuid) from public,anon;
grant execute on function public.is_walk_participant(uuid) to authenticated;
create policy "Read walks joined by invitation" on public.walks for select to authenticated using(public.is_walk_participant(id));
create policy "Read participants of visible walks" on public.walk_participants for select to authenticated using(exists(select 1 from public.walks w where w.id=walk_id));
revoke all on public.walk_participants from anon,authenticated;
grant select on public.walk_participants to authenticated;
create function public.visible_walk_participants() returns table(walk_id uuid,user_id uuid,name text)
language sql stable security invoker set search_path='' as $$select m.walk_id,m.user_id,m.name from public.walk_participants m where m.active$$;
revoke all on function public.visible_walk_participants() from public,anon;
grant execute on function public.visible_walk_participants() to authenticated;
create function public.search_walk_people(walk_id uuid,query text) returns table(id uuid,name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.walks w where w.id=$1 and w.owner=auth.uid()) then raise insufficient_privilege; end if;
 if char_length(btrim($2)) not between 2 and 80 then return; end if;
 return query select u.id,left(btrim(u.raw_user_meta_data->>'full_name'),80) from auth.users u
  where u.id<>auth.uid() and u.email_confirmed_at is not null and nullif(btrim(u.raw_user_meta_data->>'full_name'),'') is not null
  and position(lower(btrim($2)) in lower(u.raw_user_meta_data->>'full_name'))>0 order by u.raw_user_meta_data->>'full_name',u.id limit 20;
end;$$;
create function public.set_walk_participants(walk_id uuid,people uuid[]) returns table(id uuid,name text)
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.walks w where w.id=$1 and w.owner=auth.uid() for update;
 if not found or auth.uid() is null then raise insufficient_privilege; end if;
 if $2 is null or cardinality($2)>20 or array_position($2,null) is not null or auth.uid()=any($2) then raise invalid_parameter_value; end if;
 if (select count(distinct u.id) from auth.users u where u.id=any($2) and u.email_confirmed_at is not null)<>cardinality($2) then raise invalid_parameter_value; end if;
 update public.walk_participants m set active=false where m.walk_id=$1 and m.active;
 insert into public.walk_participants as member(walk_id,user_id,name,active)
  select $1,u.id,left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'Photographer'),80),true from auth.users u where u.id=any($2)
  on conflict on constraint walk_participants_pkey do update set name=excluded.name,active=true;
 return query select m.user_id,m.name from public.walk_participants m where m.walk_id=$1 and m.active order by m.name,m.user_id;
end;$$;
create function public.edit_joined_walk(walk_id uuid,walk_title text,walk_description text,walk_started timestamptz,walk_ended timestamptz,walk_distance double precision,walk_duration integer)
returns setof public.walks language plpgsql security definer set search_path='' as $$
declare current_walk public.walks;
begin
 select w.* into current_walk from public.walks w where w.id=$1 for update;
 if not found or auth.uid() is null or not public.is_walk_participant($1) then raise insufficient_privilege; end if;
 if $2 is not null and char_length(btrim($2)) not between 1 and 100 then raise invalid_parameter_value; end if;
 if $3 is not null and char_length($3)>2000 then raise invalid_parameter_value; end if;
 if num_nonnulls($4,$5,$6,$7)>0 then
  if num_nonnulls($4,$5,$6,$7)<>4 or current_walk.status<>'ended' or $4<'1940-01-01'::timestamptz or $5<$4 or $5>now()+interval '1 minute' or $6 not between 0 and 1000000 or $7<0 or $7>extract(epoch from $5-$4) then raise invalid_parameter_value; end if;
 end if;
 if num_nonnulls($2,$3,$4,$5,$6,$7)=0 then raise invalid_parameter_value; end if;
 return query update public.walks w set title=coalesce(btrim($2),w.title),description=coalesce($3,w.description),started_at=coalesce($4,w.started_at),ended_at=coalesce($5,w.ended_at),distance_m=coalesce($6,w.distance_m),duration_s=coalesce($7,w.duration_s) where w.id=$1 returning w.*;
end;$$;
revoke all on function public.search_walk_people(uuid,text),public.set_walk_participants(uuid,uuid[]),public.edit_joined_walk(uuid,text,text,timestamptz,timestamptz,double precision,integer) from public,anon;
grant execute on function public.search_walk_people(uuid,text),public.set_walk_participants(uuid,uuid[]),public.edit_joined_walk(uuid,text,text,timestamptz,timestamptz,double precision,integer) to authenticated;
-- Only the RPC can write memberships. Participants have no direct walk UPDATE,
-- recording, sharing or DELETE grant. Explicit removal deactivates membership;
-- it does not delete walks, photographs, annotations or files.

-- Contributing a new photo requires membership; existing photo READ policies
-- and every existing photograph's privacy remain unchanged.
create policy "Attach new photos to created or joined walks" on public.photos
 as restrictive for insert to authenticated with check (
 walk='' or exists(select 1 from public.walks w where w.id::text=photos.walk and (w.owner=(select auth.uid()) or public.is_walk_participant(w.id)))
 );
