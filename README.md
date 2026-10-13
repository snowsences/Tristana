# Tristana

A personal daily journal: something learned, something good, and one square photograph. Any one part fills a day.

[Open Tristana](https://snowsences.github.io/Tristana/)

## App source

`dist/` contains the complete PWA: journal UI, 12 monthly themes with 99 header scenes, a repeatable shuffled artwork loop for each month/year, local autosave, photo cropping, Firebase sign-in/sync, and the phone notification client.

Firebase rules and the reminder/photo backend are managed in the Firebase and Cloudflare consoles. Their earlier deployment copies remain available in Git history. No journal entries or backend secrets are stored here.

## Development

The frontend has no build step. Install the test dependency and run the checks:

```sh
npm ci
npm test
npm run check
```

The checks cover calendar/travel dates, partial entries, concurrent edits, square crop bounds, IndexedDB persistence, and artwork paths.

## Hosting

The GitHub Actions workflow publishes `dist/`. The repository-root `index.html` also opens `dist/` when Pages is configured to publish the main branch.

Client connection settings are in `dist/js/config.js`. Firebase Authentication, Firestore, Cloudinary, and the deployed Cloudflare Worker provide the external services. Live sign-in, photo uploads, cross-device restore, and phone reminders should be checked on the actual devices after configuration changes.
