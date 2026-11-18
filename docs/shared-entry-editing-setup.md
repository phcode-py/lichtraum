# Working notes: shared entry editing

For Philipp to review before live database setup.

The existing `20261117070000_collaborative_paper_entries.sql` enables participants to rewrite or remove other authors' entries on accessible shared papers, retaining authorship and files. Private papers remain accessible only to their owner.

The newly prepared `20261118020000_shared_chat_entry_removal.sql` extends removal to the permanent chat. This is a **risky shared-data permission change**: signed-in participants may hide chat messages written by someone else. It adds a removal timestamp and filters hidden messages; it does not physically delete messages or reference files. The earlier collaborative-entry migration is a prerequisite.

No migration was applied during this change. Coordinate application with Philipp separately. Do not reset existing tables, files or preview storage. GitHub upload approval alone does not authorize applying this migration.

The single sheet pencil opens editing for all visible entries, including other authors' text and media. The trash icon marks an entry for removal; undo or cancel leaves it intact. Saving commits explicit edits. Earlier entries are accessible through “earlier entries”; history uses time/ID pagination so new messages do not shift the boundary.
