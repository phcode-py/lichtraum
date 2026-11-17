-- PREPARED ONLY. Review separately before applying to the live database.
-- Adds a paper-material choice. Existing papers appear as opaque white paper.
-- No titles, entries, positions, sharing settings or stored files are changed.
alter table public.correspondence_papers
  add column material text not null default 'opaque'
  check (material in ('opaque', 'tracing'));
