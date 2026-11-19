# Shared walk participants — review for Philipp

The creator can search registered people by their account name and add them to a walk. Those people see the same walk in their journal, can edit its name/description and finished dates/totals, and add their own photographs. Names remain attached to each photograph's author. GPS recording and route changes, sharing, deletion and participant management remain creator-only. No email or external invitation is sent.

**Risky access change requiring review:** `20261119020000_walk_participants.sql` permits explicitly added people to read the walk even when it is private, and to update the listed details. Only the creator can grant/revoke membership, in a locked transaction. Removed people lose participant access unless existing general sharing still gives them read access. The separate member function permits only a fixed list of detail fields; it cannot change ownership, privacy, recording state or route.

The name search exposes confirmed registered account IDs and display names only to a signed-in creator searching within their own walk. It does not return email addresses or authentication metadata. Creator and participant functions recheck permissions in the database; the HTTP API checks sign-in/origin and validates requests too.

**Existing photo privacy is unchanged:** adding people to a walk does not grant access to private photographs already attached to it. A photograph is still visible according to its author's existing sharing choice. Participants can attach their own photos, but cannot edit anyone else's photo or change its sharing. Existing photo conditions, tags and drawing policies continue to follow the photo's access. A new restrictive INSERT policy requires creator/member access when attaching a new photograph to a walk; it does not restrict ordinary photos or modify any existing photograph.

Membership rows follow their walk: the creator’s existing explicit walk-removal action also removes that walk’s new membership metadata. It does not remove photographs or files. No removal is performed by this migration or development work.

Prepared only; no migration has been applied and no existing rows or stored files changed. This needs existing walk/description migrations, plus separate map-tracing setup if desired. Coordinate review/application with Philipp separately from a GitHub upload. No hosted services have been deployed or messages sent outside this workspace.
