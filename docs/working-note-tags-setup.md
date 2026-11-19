# Working notes tags — setup for Philipp

Each saved sheet, including Messages, can be tagged independently with the same light/image, time, weather and area categories as Light atlas. Tags belong to the sheet; this does not alter tags on photographs or automatically infer anything from uploaded reference images.

The board filter combines section, normal/tracing paper and tags. Multiple light/image tags or weather tags match any selected option within that group; different groups must all match. “Without tags” finds sheets with no assigned tags. Filtering hides sheets and pans to the first match; it never moves or saves their positions.

**Prepared only:** review and separately apply `20261119010000_working_note_tags.sql` before online tag saving. It creates one companion table and a validation function. It does not rewrite any existing sheet, message, photo, file, storage setting or saved tag. Existing sheets initially have no tags. The UI remains usable without setup and explains why tag saving is unavailable.

**Permission addition to review:** signed-in participants may read and revise tags on any sheet they can already access, matching shared Working notes collaboration. Private-sheet access follows existing paper RLS; the built-in Messages sheet has shared tags. This grants access only to the new metadata, with no delete grants or changes to existing table/storage permissions. Existing archived-paper policies remain prerequisites for hiding archived sheets and their tags.

No migration has been applied or hosted service deployed by the coding agent. Coordinate setup with Philipp separately from a code upload. No notification has been sent outside this workspace.
