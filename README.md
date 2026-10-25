# Music Player Demo

A static music player built with HTML, CSS, and vanilla JavaScript. The public demo includes original instrumental samples and artwork, with no frontend framework or build step.

## Features

- Audio playback with seeking, a listening queue, and shuffle.
- Track search and shareable song links.
- Likes and dislikes.
- Comments with image attachments and clickable timestamps.
- Listening stats and a 30-day activity chart.
- Responsive layouts for desktop and mobile.

Demo ratings, comments, and listening activity are saved in the visitor's browser. Stats reflect activity in that browser, and clearing site data resets the demo. The Merch tab is intentionally blank.

## Project structure

```text
index.html                  Page layout, styles, and player interactions
assets/experience.js        Demo data and browser storage
assets/demo/                Original audio, cover art, and track catalogue
api/                        Vercel serverless API handlers
api/_lib/                   Shared API utilities
scripts/generate-demo.cjs    Reproducible audio generator
scripts/verify-browser.cjs   Browser smoke checks
tests/                      Catalogue and API contract checks
vercel.json                 Hosting and routing configuration
```

The current frontend lives in `index.html`. The older `assets/app.js` and `assets/styles.css` files are not loaded by that page.

## Local development

Use the Vercel CLI to preview the site and its API routes locally:

```bash
vercel dev
```

Open the local URL printed by the CLI. The public demo works without database credentials. There is no npm dependency installation or build command required for the static frontend.

## Deployment

Deploy the repository directly to Vercel using the included `vercel.json`. The frontend is served from `index.html` and `assets/`, while the functions in `api/` run server-side.

## Optional API configuration

The API handlers support song metadata, ratings, comments, image uploads, play tracking, and analytics through Supabase. To configure those handlers, set these server-side environment variables:

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for database and storage requests |

For local configuration, copy `.env.example` to `.env.local` and fill in the values. Keep credentials out of client-side code and version control. The browser-only demo does not require this configuration.

## Demo media

The sample tracks **First Light**, **After Hours**, and **Slow Orbit** are synthesized from oscillators and generated noise. Their matching covers are original SVG illustrations.

Regenerate the audio with:

```bash
node scripts/generate-demo.cjs
```

See [the demo media notes](assets/demo/README.txt) for details and reuse permission.

## Checks

Run the catalogue, storage, media, and API checks with Node.js 22 or newer:

```bash
node --test tests/experience.test.mjs tests/api-audience.test.mjs
```

These checks use fixture responses and do not access a live database.

For browser checks, provide an installed `playwright-core` package and a Chromium executable:

```bash
node scripts/verify-browser.cjs /path/to/playwright-core /path/to/chromium
```

The browser checks cover playback, queue controls, ratings, comments, sharing, stats, and desktop/mobile navigation using local files and fixture APIs.
