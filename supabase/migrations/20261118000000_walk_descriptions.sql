-- Prepared only: coordinate application with Philipp. Existing walks and routes are retained.
alter table public.walks add column if not exists description text not null default '';
alter table public.walks add constraint walks_description_length check (char_length(description) <= 2000) not valid;
alter table public.walks validate constraint walks_description_length;
-- Existing owner-only writes and own/shared read policies continue to apply.
