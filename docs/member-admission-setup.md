# Member admission (join requests)

New accounts no longer get straight into the atlas. Someone who signs up sees a
"Your request is on its way" page until an admin admits them. Admins see one paper
per waiting person beside their Account paper, with **Admit** and **Decline**. One
admin answering is enough, and the paper then disappears for all admins.

## What the migration does

`supabase/migrations/20261121000000_member_admission.sql`

- Creates a new `members` table: one row per account with `status`
  (pending / approved / declined) and `is_admin`.
- Admits **every account that exists when it runs** and makes them admins
  (Mona, Philipp and Lena on 21 November 2026).
- Adds a database trigger: every new sign-up becomes a pending request.
- Adds an extra "Admitted members only" rule to every table and to file storage.
  It sits on top of the existing rules, which stay unchanged.
- Updates the walk-people search so it only offers admitted members.
- Adds a check before every API request (`pgrst.db_pre_request`), so waiting
  accounts also can't use database functions.

It deletes nothing and does not change existing photos, walks, papers or files.

## Apply

1. Supabase dashboard → SQL editor → paste the whole migration → Run.
2. Check that the three of you are admitted admins:
   ```sql
   select name, email, status, is_admin from public.members;
   ```
3. Check that the pre-request check is active:
   ```sql
   select rolconfig from pg_roles where rolname = 'authenticator';
   ```
   It should include `pgrst.db_pre_request=public.admitted_members_only`.
4. Only then upload the website code. **Order matters:** the site is closed by
   default and lets someone in only when the database explicitly answers
   "approved". Without the migration, everyone (admins too) would stay on the
   waiting page.

Make an admin later:
`update public.members set is_admin = true where email = '…';`

## Undo the request check (if the site misbehaves)

```sql
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
```

This turns off only the check before each request. The table rules and join
requests stay in place.
