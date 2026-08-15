# Antigravity CLI handoff

This repository is intentionally structured so an agent can work on one layer at a time without rewriting the whole application.

## First session

From the project root:

```bash
npm install
npm run check:runtime
npm run dev
```

Open `http://localhost:3000` and test in a phone-sized browser viewport first. Stop the dev server when the basic check is complete, then launch Antigravity from the same project directory:

```bash
agy --new-project
```

Inside Antigravity, run `/agents` and select the workspace agent **modern-downloader-engineer** if it is listed. The repository also contains `AGENTS.md`, which defines non-negotiable project rules.

## What Antigravity should read before editing

Ask it to read, in this order:

1. `AGENTS.md`
2. `README.md`
3. `docs/ARCHITECTURE.md`
4. `docs/reference-design.png`
5. `components/downloader-app.tsx`
6. `app/globals.css`
7. `lib/media-engine.ts` and `lib/yt-dlp.ts`
8. both files under `app/api/media/`

## Recommended initial Antigravity prompt

```text
Read README.md, docs/ARCHITECTURE.md, docs/ANTIGRAVITY_HANDOFF.md, and inspect docs/reference-design.png before changing anything.

This is a mobile-first Next.js/TypeScript rewrite of a Streamlit yt-dlp + FFmpeg media downloader. Preserve the current architecture and visual design. Do not replace yt-dlp with a YouTube-only library. Do not add Firebase, a database, authentication, Docker, cloud storage, paid services, or permanent server-side file storage unless I explicitly request it.

First run npm install, npm run check:runtime, npm run typecheck, npm run lint, and npm run build. Then run the app and test these flows:
1. YouTube metadata preview.
2. Instagram/Reel metadata preview if yt-dlp supports the supplied public URL.
3. Video quality selection and MP4 download.
4. Audio quality selection and MP3 conversion.
5. Cancel/error behavior.
6. Mobile layout around 390x844.
7. Tablet layout around 820x1180.
8. Desktop layout around 1440x900.

Fix only concrete issues you reproduce. Keep the selected design as the visual source of truth. When you finish, report every file changed, commands/tests run, remaining deployment limitations, and anything that still needs manual verification.
```

## If real downloads fail locally

Have Antigravity inspect the actual runtime error before changing architecture. Common checks:

```bash
node --version
npm run check:runtime
```

Then verify that `ffmpeg-static` resolved a binary and `bin/yt-dlp` (or `bin/yt-dlp.exe` on Windows) exists and executes. `scripts/setup-binaries.mjs` downloads the official platform-specific standalone yt-dlp release and verifies its SHA-256 checksum. Do not introduce a Python backend; use `YT_DLP_BINARY` only if you intentionally want to point at a different standalone executable.

## If a specific platform fails

Do not create platform-specific scrapers first. Update the yt-dlp package/binary and reproduce the problem. Social-media extractors change frequently, so extraction failures should remain isolated behind `lib/media-engine.ts`.

## If Vercel becomes the next task

Treat deployment as a separate validation task. Do not assume a serverless deployment can handle the same binary execution, temporary disk, processing duration, and media response size as local Node.js. Keep the existing UI/API contracts and swap the processing adapter only if deployment testing proves it is required.

## Design constraints

- Mobile is the primary experience.
- True white surfaces, pale blue page background, bright blue primary action.
- Rounded but not overly pill-shaped controls.
- Preserve numbered workflow: link -> platform -> preview -> options -> downloading/completed.
- Desktop uses a left navigation rail and separate status column.
- Avoid dark mode, gradients everywhere, advertisements, premium upsells, login, or marketing clutter.
- Do not turn the workflow into a multi-page wizard.

## Functional constraints

- Single media item only (`noPlaylist`).
- Video: select a target resolution, merge best matching video + audio to MP4.
- Audio: select an available audio stream and convert to MP3.
- Show title, uploader, upload date, thumbnail, duration, supported resolutions/audio qualities.
- Temporary processing only; clean output after response streaming.
- Browser-local history only.
