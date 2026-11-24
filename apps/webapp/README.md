# Launchpad web app

A client-side learning platform. There is no server: courses ship as a SQLite file, and each learner's progress is kept in
their own browser.

## Build and deploy

```bash
vp install
vp build        # writes dist/
```

Upload the whole `dist/` folder to any static host. Paths are relative, so it works from a sub-folder too. The folder must
include `content.sqlite` (the course database, built from `db/*.sql`) and `sw.js` (the service worker). Neither is
committed; the build creates both.

## Installable app and offline use

Launchpad is a progressive web app. Opened over **HTTPS** (or on `localhost`) it can be installed from the browser, opens in
its own window and works without a network. Video lectures still need a connection.

- `public/manifest.webmanifest` and `public/icons/` describe the app. The icons are made from `public/favicon.svg`.
- `scripts/sw-template.js` is turned into `dist/sw.js` by `scripts/pwa-plugin.ts` after every build. It lists every file in
  the build and gets a version that changes whenever any of them does.
- `src/lib/pwa.ts` registers the worker (production builds only), asks the learner to reload when a new version is ready, and
  powers the Install row in Settings.
- A new version waits until the learner chooses **Reload**, so a page that is already open never loses its files.
- `content.sqlite` is fetched network-first, so new courses arrive when online and the stored copy is used offline.

### Headers

`sw.js`, `index.html`, `manifest.webmanifest` and `content.sqlite` must not be cached for long, or learners are slow to see
updates. `public/_headers` sets this for Netlify; on another host, set `Cache-Control: no-cache` on those four files and a long
`immutable` cache on `/assets/*`.

### Trying it locally

```bash
vp build && vp preview
```

Open the preview address, then use the browser's developer tools to go offline and reload.
