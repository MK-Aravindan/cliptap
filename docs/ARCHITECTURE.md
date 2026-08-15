# ClipTap architecture

## Goal

A mobile-first Next.js rewrite of the original Streamlit downloader. All application code is JavaScript/TypeScript. Media extraction and post-processing are delegated from Node.js to the official standalone `yt-dlp` executable and the `ffmpeg-static` executable; there is no Python application backend.

## Runtime flow

```text
Browser (React UI)
  |
  | POST /api/media/info
  v
Next.js Node.js Route Handler
  |
  | Node child_process -> official yt-dlp standalone executable
  v
Metadata + formats JSON
  |
  v
Browser preview / quality selection
  |
  | POST /api/media/download
  v
Next.js Node.js Route Handler
  |
  +--> yt-dlp downloads into OS temporary directory
  |
  +--> FFmpeg merges video+audio or converts audio to MP3
  |
  v
Temporary output file
  |
  | streamed HTTP response
  v
Browser Blob -> native browser Save/Download
  |
  v
Temporary server directory deleted
```

## Main modules

- `components/downloader-app.tsx`: complete interactive client workflow.
- `lib/media-engine.ts`: yt-dlp/FFmpeg adapter and temporary-file lifecycle.
- `app/api/media/info/route.ts`: metadata + available quality endpoint.
- `app/api/media/download/route.ts`: processing + streamed file endpoint.
- `lib/platform.ts`: URL/platform detection.
- `lib/types.ts`: shared TypeScript contracts.
- `app/globals.css`: responsive design system derived from `docs/reference-design.png`.

## State and persistence

No database is used. Only two small items are stored in browser `localStorage`:

- recent download metadata (source URL, title, selected quality, timestamp)
- user preference for default Video/Audio selection

Downloaded media itself is never stored in localStorage or a database.

## Temporary storage

The server creates a unique directory under the runtime OS temp directory for every download. After the HTTP file stream closes, the directory is recursively deleted. Errors also trigger cleanup.

## Responsive layout

- `<760px`: phone-first single column, sticky header, bottom navigation.
- `760px–1079px`: tablet layout with left navigation and two-column downloader/status layout.
- `>=1080px`: desktop layout with wider sidebar, main downloader panel, and status rail.

## Deployment adapter boundary

All media processing is isolated in `lib/media-engine.ts`. If a hosting provider cannot run long-lived binaries or return larger media files, replace only the route-handler/media-engine layer while preserving the React UI and shared request/response contracts.
