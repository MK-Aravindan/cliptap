# ClipTap — Next.js

A mobile-first Next.js + TypeScript media downloader, visually based on `docs/reference-design.png`.

The app keeps the original workflow: paste a public media URL, inspect metadata, choose Video or Audio, choose quality, process with yt-dlp + FFmpeg, and save the resulting file through the browser.

## Included functionality

- YouTube / Instagram / X-Twitter / Facebook / LinkedIn URL detection (actual extractor support is provided by yt-dlp).
- Title, uploader, upload date, thumbnail and duration preview.
- Available video resolution discovery.
- Available audio-only stream discovery.
- Video download with best video at/below selected height + best audio, merged as MP4.
- Audio download using the selected audio stream and FFmpeg MP3 conversion.
- Preparing, transfer progress, transfer speed, ETA, completion and error UI.
- Cancellation of the browser request.
- Browser-only recent history and settings via localStorage.
- Responsive mobile/tablet/desktop layouts.
- No authentication, database, cloud storage or Docker.

## Requirements

- Node.js 20+ recommended.
- npm.
- Internet access for yt-dlp to reach the source URL.

The project downloads the official platform-specific standalone yt-dlp executable during `npm install` and uses `ffmpeg-static` for FFmpeg. Application code stays TypeScript/JavaScript and there is no Python application backend. The setup script verifies the yt-dlp SHA-256 checksum before writing the executable.

## Run locally

```bash
npm install
npm run check:runtime
npm run dev
```

Then open `http://localhost:3000`.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run build
```

## UI-only demo mode

If you need to test the interface without calling a live social platform:

```bash
MEDIA_ENGINE_MOCK=true npm run dev
```

Paste any valid `https://...` URL. Metadata will use the local demo thumbnail. The download endpoint returns a tiny demo text file so the progress/completion workflow can be exercised.

Do not deploy with `MEDIA_ENGINE_MOCK=true` if you expect real downloads.

## Important web limitation

The selected prototype contains native-style “Open file / Show in folder” actions. A normal web page cannot reliably open the operating system file manager after a browser download. The implementation therefore uses **Download again** and **Copy source** after completion while preserving the visual hierarchy.

## Hosting

The application is designed and tested first as a normal Node.js Next.js app. Media processing is isolated behind `lib/media-engine.ts` and two API routes so hosting can be changed without redesigning the UI.

Before using any serverless host for real downloads, explicitly test:

- ability to execute the yt-dlp and FFmpeg binaries,
- temporary disk capacity,
- maximum processing/request duration,
- maximum streamed response/file size,
- outbound bandwidth policies.

For local/personal use, the included Node.js implementation is the reference behavior.

## Repository map

```text
app/
  api/media/info/route.ts       metadata + format discovery
  api/media/download/route.ts   process + stream final file
  globals.css                   complete responsive visual system
  layout.tsx
  page.tsx
components/
  downloader-app.tsx            client workflow/state
  media-preview.tsx
  brand.tsx
  navigation.tsx
  history-view.tsx
  settings-view.tsx
lib/
  media-engine.ts               yt-dlp + FFmpeg implementation
  yt-dlp.ts                      standalone yt-dlp process wrapper
  platform.ts
  types.ts
  utils.ts
docs/
  reference-design.png          selected prototype image
  ARCHITECTURE.md
  ANTIGRAVITY_HANDOFF.md
```

See `docs/ANTIGRAVITY_HANDOFF.md` before continuing the project with Antigravity CLI.

For a direct function-by-function mapping from the original Streamlit implementation, see `docs/MIGRATION_NOTES.md`.
