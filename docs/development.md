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
| Walk recording (GPS, impressions) | `components/walk-recorder.tsx`, `app/api/walks` |
| Walks tab | `components/walk-journal.tsx` |
| Editing photos | `components/photo-edit.tsx`, `PATCH /api/photos/[id]` |
| Database and storage setup | `supabase/migrations/` |

- **The whole site is private.** `proxy.ts` sends signed-out visitors to `/signin` (APIs answer 401); only `/signin` and `/auth/*` are open.
- **Sign-in** is email + password (`app/signin`). Accounts are confirmed automatically (Supabase setting `mailer_autoconfirm`), so no email is sent. "Forgot or no password" sends a one-time email link that lands on `/password` to choose a new one. The name entered at sign-up is stored as `full_name` and shown beside photographs and notes.
- **Photographs** upload straight from the browser into the private `photos` storage bucket (`<user id>/<uuid>`), because Vercel limits request bodies to 4.5 MB. The browser then posts the photo's details to `/api/photos`. Images are shown through signed links that last six hours.
- **Walks** are recorded in the browser with `navigator.geolocation.watchPosition`. Fixes weaker than 40 m, closer than 6 m to the last point, or faster than 43 km/h are skipped. Points are saved every 15 s (and when the page is hidden) to `walks.path` as `[lng, lat, unix seconds, segment]`; each pause starts a new segment. Unsaved points are kept in `localStorage` until they reach the server. The screen is kept awake with the Wake Lock API while recording. A walk left “recording” (e.g. Safari closed the tab) reopens paused on the next visit.
- **Impressions** are photos with `walk` set to the walk id. The position is taken at the moment “Add impression” is tapped; the camera opens via `<input capture>`. Images are shrunk to 2400 px JPEG in the browser before upload.
- **On iPhone**, GPS only runs while the page is open and the screen is on. Adding the site to the Home Screen (Share › Add to Home Screen) opens it full-screen without Safari's bars.
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

## Correspondence papers

The correspondence board keeps the original conversation in **the room**, using the existing `messages` table and `/api/community`. The contributors receipt uses the same existing read-only counts.

New papers use `/api/papers` and `/api/papers/[id]/entries`. Before enabling them in production, apply `supabase/migrations/20261111010000_correspondence_papers.sql`. This migration creates only `correspondence_papers`, `correspondence_entries`, their index and access policies; it does not modify existing tables, records or photo storage. Preparing this file does not apply it.

Papers are shared by default. Unchecking “shared with everyone” creates a private paper. Row-level security limits private papers and their entries to their owner. Shared papers accept entries from signed-in people. Entries are append-only; the board has no delete action. Only paper positions can be updated, including by other signed-in people on shared papers; column-level grants protect the title, author, owner and sharing setting.

New paper positions are stored with the paper. Each browser remembers the two built-in receipt positions in the new `lichtraum-correspondence-fixed-papers-v1` local storage key. Existing preview storage is not cleared or replaced. Drag receipt handles, or focus them and use arrow keys; scroll the board to explore, and choose “first papers” to return to its beginning.

The board refreshes every 20 seconds and each paper’s entries every 15 seconds while the page is visible. It is a shared board, not a live cursor or presence service. The newest 200 papers and newest 100 entries per paper are currently loaded.

## Map orientation and sun study

The map supports flat bearing rotation (right-drag or Control-drag on desktop, two-finger rotation on touch screens). Pitch and roll stay disabled. The north arrow follows the bearing; click it to face north. The circle-and-dot control restores the original Zürich center, zoom and north orientation.

The sun button opens an adjustable, browser-calculated solar study for central Zürich. It uses the approximate equations in NOAA's [General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF). Azimuth is clockwise from true north; elevation is geometric height above the horizon. Sunrise/set use the conventional −0.833° threshold. Buildings, terrain, weather and local obstruction shadows are not modeled. The fixed-radius map arc is a schematic direction guide, not a distance or a shadow length. Date/time controls use Europe/Zurich and handle 23/25-hour daylight-saving days. Run the reference geometry and time-zone checks with `node --experimental-strip-types --test tests/sun.test.mjs` (Node 22+).

## Managing walks and photographs

Pencil and trash icons appear only for the current user's items. Walk edits change the name and sharing. Walk removal requires an explicit confirmation and only removes the owner's finished walk record and route; photographs and stored files are retained in the light atlas. Active walks must be finished first. The endpoint checks ownership and status again when deleting.

`supabase/migrations/20261111020000_walk_removal_policy.sql` prepares the owner-only delete policy for finished walks. It has not been applied by local development. Applying the policy does not itself delete records, but enables the confirmed removal action; review it separately from code upload. Existing photograph edit/remove endpoints remain owner-restricted. Photo removal confirmation states that the record and photo file are permanently removed.
