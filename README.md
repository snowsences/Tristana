# Tristana

A private daily journal for Kevin. Two short thoughts, one square photograph. One part is enough to fill a day.

The frontend is a buildless PWA served by GitHub Pages. Firebase Authentication and Firestore keep entries synced; authenticated Cloudinary assets keep photographs private. The Cloudflare Worker signs uploads, serves protected photographs, and sends a reminder to one registered phone. No journal data or backend secrets belong in this public repository.

## First-time setup

### 1. GitHub Pages

In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. Run the **Publish Tristana** workflow if the initial run occurred before Pages was enabled. The URL will be `https://snowsences.github.io/Tristana/`.

### 2. Firebase

In project `tristana-56147`:

- Authentication → Sign-in method: enable **Google**.
- Authentication → Settings → Authorized domains: add **snowsences.github.io**.
- Create the default **Cloud Firestore** database if it does not exist.
- Firestore → Rules: paste `firestore.rules` and publish. Or use `firebase deploy --only firestore:rules` with the Firebase CLI.

Rules authorize the verified Google account `allenkevinc@gmail.com` only. The client also checks that account; the rules are the actual database security boundary. The Firebase web config is intentionally public. A different Google account may authenticate with Firebase but cannot access this journal.

### 3. Cloudflare Worker

The existing `https://tristana.allenkevinc.workers.dev/` currently serves Hello World. Replace it with `worker/index.js`, bundled with its dependencies:

```sh
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create TRISTANA_STATE
```

Paste the returned namespace ID into the commented `kv_namespaces` block in `wrangler.toml` and uncomment that block.

Set these **Worker secrets**, never values in source or frontend configuration:

```sh
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npm run vapid
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

The Cloudinary keys come from the **myranker** product environment. Keep those out of GitHub and chat.

For the Firebase service account, create a dedicated Google Cloud service account with **Cloud Datastore User** permissions on this project, generate a JSON key, and set its `client_email` and `private_key` as the two Firebase Worker secrets. The private key may be multiline or have literal `\n` escapes. The Worker uses this account only to check whether a day has an entry and read the timezone. Google Cloud service-account permissions bypass Firestore rules; use a dedicated account with no broader roles. Store/delete the downloaded key securely.

`npm run vapid` generates one public/private pair. Set both secrets from the same pair. Keep the private key stable; rotating it requires re-enabling push on the phone. Optional: after first Google sign-in, set `OWNER_UID` to the Firebase Authentication user UID for an additional backend check.

The Worker’s origin is restricted to `https://snowsences.github.io`, and every upload, photo-read, or reminder operation verifies a Firebase ID token, its project, and the verified owner email. Uploads use Cloudinary `authenticated` delivery, not public URLs. Original and square files are separately uploaded with unique IDs. Photos reach the browser as authenticated bytes and are locally cached in the account’s IndexedDB records.

### 4. Phone reminders

On the Android phone, open the app in Chrome, sign in, and install it from Chrome’s menu or **Settings → Install Tristana**. In Tristana Settings, choose **Enable on this phone** and allow notifications. Only one phone subscription is retained; enabling on another phone replaces it. The reminder defaults to **21:00** and is adjustable.

A minutely Cloudflare Cron Trigger checks the shared timezone and today’s Firebase entry. Any text or photo suppresses the reminder. The service worker also checks local drafts before showing a received reminder. Filling today on the phone closes its visible reminder. Push delivery can be delayed by the network or Android battery policies, and a notification already visible on a sleeping phone cannot be guaranteed to disappear immediately after editing on another device. Opening the phone app closes it. No browser timer is used to simulate closed-app reminders.

## Daily behavior

- The two text fields each allow 140 Unicode code points (emoji sequences may use several).
- IndexedDB drafts are written on each input, before cloud sync. Persistent storage is requested, but browser data clearing or OS eviction can still remove unsynced data.
- A new photo is stored locally before upload. Interrupted uploads retry with the same unique asset ID. The crop is a 1024×1024 JPEG; original bytes remain available for re-framing.
- Missing = zero parts; partial = one or two; done = all three. Future days are neutral. Leap years include February 29.
- The year grid is in Past days. Choose any past day from the grid, the scrolling photo strip, or the date picker. All entries remain editable.
- The selected calendar date is permanent. The designated phone follows its current timezone when the app opens; other devices use the shared zone. Crossing midnight never moves an in-progress entry. Select Today again for the new date. Repeated travel dates reuse that date; skipped dates can be backfilled.
- Themes follow the selected entry’s month, with a manual override. Monday–Sunday select seven variations. Today and Past days use the same selected-date artwork. Header assets keep the month/day filenames (`dec-01-monday.webp` etc.).
- Concurrent edits merge different fields. For the same field, the later successful sync is current, while the previous cloud version is kept in **Earlier versions**. Local photo removals/replacements also retain earlier versions.
- Export contains all loaded entries and photographs cached on that device. Uncached cloud photographs remain protected Cloudinary references, so this export is a recovery aid rather than an independent copy of every remote photo. Import saves locally first and syncs afterward. Export files contain private journal data; keep them private.
- Google sign-out hides account data but leaves local drafts available for that same account’s next sign-in.

## Development and verification

```sh
npm test
npm run check
```

The frontend has no build dependency. `dist/` is the complete static site. All app URLs, manifest paths, and service-worker paths are relative for GitHub Pages’ `/Tristana/` subpath. For local browser testing, serve `dist/` on localhost and add localhost to Firebase’s authorized domains; the production Worker intentionally rejects localhost until explicitly added to its allowed-origin policy.

The backend requires an actual deployed Worker and valid secrets to verify real uploads/push. Client tests do not prove Firebase rules are deployed or Android push delivery works. Test sign-in, an offline edit, cross-device restore, a photograph/re-frame, and a reminder on the phone after setup.
