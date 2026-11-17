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

## Photo and video posts

The plus button accepts a single photo (JPG/PNG/WebP, up to 10 MB) or video (MP4/WebM/MOV, up to 50 MB) per post, with title, caption and a Zürich map pin. Checking sharing posts it to the shared atlas; otherwise it stays private. Both formats are also accepted for walk impressions and when replacing a post's media. Images use the existing browser resizing helper. Videos upload directly, without transcoding; playback depends on browser codec support, with an open-file link if playback fails.

Before using videos in production, separately review and apply `supabase/migrations/20261117001000_video_storage.sql`. It creates a **new private `videos` bucket** with owner upload/delete policies and owner/shared read access. It leaves the existing `photos` bucket, tables, records and stored files untouched. This migration is prepared only; code upload does not apply it.

Existing extensionless photo keys remain unchanged. Video keys are `<owner>/<uuid>.mp4`, `.webm` or `.mov`, and use the existing post table and sharing rules. API routes check the file exists and its stored MIME type and size match before creating or replacing a post. Atlas cards, walk journals and details render the media type; videos play on request and map pins use a play symbol. Replacing media preserves the previous file. Failed saves also retain uploaded files; no automatic storage cleanup runs for these uploads. The existing explicit delete confirmation removes the current post/file from its corresponding bucket.

Run media validation and storage-routing checks with `node --experimental-strip-types --test tests/media.test.mjs`.

## Past walks and revisiting a walk

The walk journal offers **Start a walk** and **Add a past walk**. Past entries use the existing `walks` table with `status: ended`, an explicitly chosen start/finish, distance and walking duration, and an empty GPS path. Creating a past entry never closes a current recording. No database migration is needed for this feature.

The pencil opens the same editor for your own walks. Finished walks allow changes to their name, start/finish, distance, walking time and sharing. Open walks allow name/sharing changes until they are finished. Edits preserve the route and existing impressions. Dates appear in Europe/Zurich time; inputs account for Swiss daylight-saving transitions and preserve an existing timestamp in the repeated autumn hour. Finished walks stay in chronological order when their date changes.

`POST /api/walks` with `kind: past` and a `details` object creates a finished entry. `PATCH /api/walks/[id]` accepts the same details for an owner's finished walk, with server validation of dates, elapsed time, totals and ownership. The `details` fields are `startedAt`/`endedAt` (ISO timestamps), `distance` (metres) and `duration` (walking seconds, excluding pauses). GPS recording continues to use its existing API payload.

**Add a photo or video** on a walk opens the atlas composer with that walk selected and matching initial sharing. The composer also provides an optional walk selector. Saving a walk impression returns to that walk's journal. Sharing the walk and sharing each impression are independent, so private impressions remain private even on shared walks.

Run safeguards with `node --experimental-strip-types --test tests/walk-details.test.mjs tests/walk-api.test.mjs`. The API tests run the real handlers against isolated in-memory data and never connect to Supabase.
## Movable sun studies and photograph conditions

The sun study now uses a chosen location. Drag its blue origin, use the origin's arrow keys, or select **Choose a place on the map** and click. The entire day arc, sun direction, elevation, sunrise and sunset are recalculated for that point. Map padding keeps the origin visible beside the settings, including on phones. Changing the study time does not change a photograph's capture time.

New atlas photographs have an explicit **When was it taken?** field in Europe/Zurich time. It defaults to the current minute; older images need their actual capture time entered manually (EXIF is not automatically read). Nonexistent spring daylight-saving times are rejected; an ambiguous autumn hour uses its first occurrence. Walk impressions record the time the camera was opened and the GPS position at that tap, rather than the time upload finishes. This is an approximation of shutter time, labelled in the saved record.

The server calculates solar angles and requests Open-Meteo hourly cloud cover, relative humidity, temperature, precipitation and wind speed for the capture time and coordinates. Recent dates use the Forecast API; dates more than five UTC days old use the Historical Weather API. Samples use the hour containing capture time, in UTC, avoiding daylight-saving ambiguity. These are regional model estimates, not measurements at the camera. Missing individual fields are shown as a dash. If the provider fails or has no data, the photo still saves its sun record and explicitly records weather as unavailable. Saved values are snapshots and are never silently replaced by today's weather.

References: [Open-Meteo forecast](https://open-meteo.com/en/docs), [historical weather](https://open-meteo.com/en/docs/historical-weather-api). Attribution appears alongside the weather. The free endpoint is intended for non-commercial use; check the provider's terms before any commercial rollout.

### Storage preparation — not applied by local development

`supabase/migrations/20261117000000_photo_conditions.sql` creates a new companion table and a transaction function. It does not alter existing photo tables, records or files. Row-level security follows the photograph's visibility and limits inserts to its owner. Snapshots are append-only. The photo and snapshot insert atomically; a failure leaves neither new database record. Error handling retains newly uploaded files rather than deleting storage content.

The setup must be reviewed and applied separately before enabling new capture records in production. Until then, existing photos remain readable with “No capture conditions were saved”, and new atlas uploads show the setup requirement instead of claiming conditions were saved. Walk impression saves also report the setup requirement. Uploading code does not apply SQL. No database or storage was contacted for writes during this implementation.

The conditions remain attached to the original capture when titles, captions or sharing are edited. Replacing the image keeps that original capture record; upload a separate photograph to record a different moment. Existing photo deletion, when explicitly confirmed through the existing flow, also removes that photo's companion row through its foreign key. No new delete UI or delete endpoint is added.

The development-only route `/preview/light-study` now renders `components/home.tsx`, the exact same application component as `/`. The former separately designed demonstration is no longer used. Without local Supabase settings, a status label explicitly marks saved content as unavailable, data requests are skipped, and recording/saving are disabled. Navigation, map, sun studies and panels use their real components and styles; no sample photographs or weather are invented. Correspondence can be inspected and rearranged in memory without reading or writing saved paper positions. With Supabase settings present, normal sign-in and API authorization still apply; the preview does not grant access to private content. It is unavailable in production. A complete content-matched preview requires the project's `.env.local` and normal sign-in.

Validation: `node --experimental-strip-types --test tests/*.test.mjs` and `npx tsc --noEmit`. The weather tests cover date routing, containing-hour selection, missing/invalid fields and provider failures; solar tests cover relocated origins and Zürich daylight-saving days. Database persistence and access policies still need integration verification in a separately authorized test Supabase project before production enablement.

Local verification on 17 November 2026: 11 geometry/weather/time-zone tests passed, TypeScript passed, and the production build passed with `next build --webpack`. Default Turbopack production builds hit a local process/port permission error; the Turbopack development preview runs successfully. The new standalone components and API modules pass ESLint. The existing home page still has its pre-existing effect-related lint errors; no lint rules were disabled. Desktop and 390×844 phone previews were exercised for point placement, dragging, time adjustment, and reopening a photograph's saved moment. A real read-only request to Open-Meteo returned valid weather for central Zürich. No Supabase writes, migrations, commits or pushes were performed.

The sun diagram now has a viewport-aware screen radius (up to 170 CSS pixels, reduced to fit the uncovered map area). It is reprojected on every map movement and resize, so zooming in reduces its ground diameter instead of moving the arc outside the viewport. True-north bearings follow map rotation. The 28-pixel inset reserves room for the sun symbol. This affects only the schematic guide, not solar calculations or saved photo conditions.

The sun & light sheet uses a 90% opaque background with a gentle 3px backdrop blur, keeping the underlying map discernible while text and controls remain fully opaque.

## Gallery and photo organisation

`/gallery` opens the expanded gallery view of Light atlas as a compatibility link. The main menu contains only Walks, Light atlas and Correspondence. In the Light atlas panel, **View as gallery** expands the same panel symmetrically (70px desktop margins; 16px phone margins), with filters on the left and images beside them. **View as map** restores the compact panel. The underlying map remains visible around the expanded panel and selected local preview images are retained across view switches. `/preview/light-study?section=gallery` renders that same page component for local review. The image grid uses square, cropped thumbnails with 6px gaps (4px on phones) and fine borders. Names, places, authors, dates and tags appear inside a 90% paper-coloured overlay on hover or keyboard focus. A click or tap opens the photograph uncropped with its full details and tag editor. No captions are printed below the tiles.

The default order is newest upload first, with oldest upload and newest/oldest capture-time options. Missing capture dates explicitly fall back to upload dates. Filters combine walks, image types, time of day, weather and area; several choices within one group match either, while separate groups narrow together. Search includes titles, places, captions, authors and German/English image labels. Photos without metadata remain visible and can be found through unknown/untagged filters. The four original broad categories remain supported and are not migrated or renamed.

Six independent image types reproduce the user's folder categories: patterns of light/shadow; reflected light on facades; light reflected by windows/facades; reflections in water; reflections in windows/facades; and light scattering. Multiple image types can be selected. Area is an optional photographer-selected tag (industrial, residential, city centre, waterfront, park/nature, mixed use).

Time uses the saved capture instant in Europe/Zurich and the saved solar elevation: below −6° is night; between −6° and 0° is early morning/evening. Daytime groups use local hours (early morning before 09:00, morning before 12:00, midday before 14:00, afternoon before 18:00, then evening; 22:00–05:00 defaults to night). Upload time is never used to infer capture time. Weather estimates yield clear skies (cloud cover ≤20%), partly cloudy (<80%), overcast (≥80%), rain/snow (precipitation >0), humid (humidity ≥80%), and windy (wind ≥20 km/h). Users can supply time/weather tags for older photographs or override estimates. No AI service is called and no image is sent for classification.

### Tag storage — prepared, not applied

`supabase/migrations/20261117050000_photo_organisation.sql` creates only a new companion table, with visibility following the related photograph and owner-only insert/update policies. It does not alter existing photo records, files, buckets or sun/weather snapshots. No delete policy is granted. The migration must be reviewed and enabled separately before persistent tag editing works. Code upload alone does not apply it.

`PUT /api/photos/[id]/tags` validates all taxonomy values and checks sign-in, origin and ownership before updating only this new metadata. Photo upload can attach tags after the photo has been created. If that optional tag write fails, the response clearly says the photo saved but its tags did not; it never deletes the photograph. Editing titles/captions/sharing retains tags. Existing photos can be browsed without the new table; the tag editor explains the setup requirement instead of blocking browsing. Existing capture-condition setup remains a separate prerequisite for photo creation, as documented above.

The photo list now pages through all visible records and signs image URLs in batches, instead of truncating the gallery at the default Supabase row cap. Companion conditions and tags are fetched by visible photo IDs in batches. Row-level security continues to restrict the collection to own and shared photographs.

When connection settings are missing, the user can explicitly choose photographs through **Choose photos for local preview**. Object URLs and draft tags live only in React state in that tab, never localStorage or the backend. Refreshing ends those temporary previews. Such images are labelled LOCAL ONLY, have no inferred capture time/weather/location, and are excluded from map pins. No placeholder photographs are invented. These drafts are useful for reviewing the actual grid but do not upload the selected files.

Validation: 18 solar/time/weather/gallery tests pass, covering category validation, sorting, cross-group filtering, unknown metadata, manual overrides and German search. TypeScript and the webpack production build pass. Newly added gallery/tag logic has no ESLint errors (the existing image-element warning remains). Live database/RLS integration still requires a separately authorized test project; no Supabase writes or migrations were performed.

### Gallery viewing refinements

Hover/focus notes are small footnotes prioritising light/reflection types and photographer over camera filenames. `GalleryPhotoDetail` uses a native modal for keyboard focus handling, but the container is transparent and frameless: the uncropped photo sits centred with space around it and the original gallery visible through a 42% paper-coloured backdrop. A viewport-aware aspect ratio preserves the photograph's shape and margins on desktop and phones. The only close control is a × at the photograph's own upper-right corner, with a larger invisible hit target and an accessible label; there is no modal close label at the browser corner.

Scrolling lifts a 90% paper-coloured information sheet from the photo's own lower edge. The sheet is clipped within the image and can cover its entire surface. A sticky figure keeps the photograph centred while the dialog's scroll distance drives the reveal; after full reveal, longer notes scroll internally. Scrolling back lowers the sheet. A subtle button also reveals the notes for keyboard users, and Escape, close, or the outside margin returns to the same gallery position. Hidden notes are excluded from focus and accessibility until the reveal starts.

The native pointer is explicitly restored within the top-layer modal and its backdrop, since the site's custom cursor otherwise sits behind it. No backend data or image files are changed by these viewing interactions.
