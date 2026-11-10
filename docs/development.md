# Development and hosting

Lichtraum is a Next.js app. Vercel hosts it; Supabase provides sign-in, the Postgres database, and photo storage.

## Local preview

1. Node.js 22.13 or newer.
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase dashboard → Project Settings → API). The publishable key is public by design; access is enforced by row-level security.
3. `npm install`, then `npm run dev`, and open http://localhost:3000.

## How it fits together

| Piece | Where |
| --- | --- |
| Pages and UI | `app/`, `components/` |
| API routes | `app/api/photos`, `app/api/community` |
| Supabase clients | `lib/supabase/server.ts`, `lib/supabase/client.ts` |
| Session refresh | `proxy.ts` (Next.js 16's renamed middleware) |
| Sign-in | `app/signin` (password, or email link as fallback), `app/password`, `app/auth/callback`, `app/auth/signout` |
| Database and storage setup | `supabase/migrations/` |

- **The whole site is private.** `proxy.ts` sends signed-out visitors to `/signin` (APIs answer 401); only `/signin` and `/auth/*` are open.
- **Sign-in** is email + password (`app/signin`). Accounts are confirmed automatically (Supabase setting `mailer_autoconfirm`), so no email is sent. "Forgot or no password" sends a one-time email link that lands on `/password` to choose a new one. The name entered at sign-up is stored as `full_name` and shown beside photographs and notes.
- **Photographs** upload straight from the browser into the private `photos` storage bucket (`<user id>/<uuid>`), because Vercel limits request bodies to 4.5 MB. The browser then posts the photo's details to `/api/photos`. Images are shown through signed links that last six hours.
- **Who sees what** is enforced by row-level security in the database: your own photographs plus those marked as shared; everyone signed in can read and write correspondence.

## Supabase setup (once per project)

1. Run `supabase/migrations/20261110000000_init.sql` in the Supabase SQL editor (or `supabase db push` with the Supabase CLI). It only creates new tables, policies, a function, and the `photos` bucket.
2. Authentication → URL Configuration: set the **Site URL** to the Vercel address and add `http://localhost:3000/**` and `https://<your-vercel-domain>/**` to **Redirect URLs**.
3. Optional: once everyone has an account, turn off new sign-ups (Authentication → Sign In / Providers) so the atlas stays private to you.

Supabase's built-in email sender is limited to 2 emails per hour (only used for forgotten passwords). That is fine for a small group; add custom SMTP under Authentication → Emails if you need more.

## Vercel setup

1. Import the GitHub repository in Vercel. The Next.js preset needs no changes.
2. Add the two `NEXT_PUBLIC_SUPABASE_*` environment variables for Production and Preview.
3. Every push to `main` deploys automatically.

## Database changes

Add a new, timestamped SQL file in `supabase/migrations/` rather than editing an applied one. Never write a migration that drops or rewrites existing data without explicit agreement.
