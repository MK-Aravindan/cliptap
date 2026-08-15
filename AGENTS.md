# ClipTap repository rules

## Read first

Before editing code, read:

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/ANTIGRAVITY_HANDOFF.md`
4. inspect `docs/reference-design.png`

## Product constraints

- Mobile-first media downloader for personal use and short videos/reels.
- Next.js + TypeScript only for application code.
- Preserve yt-dlp + FFmpeg behavior; do not substitute a YouTube-only downloader library.
- Use the official standalone yt-dlp executable downloaded by `scripts/setup-binaries.mjs`.
- Do not add a Python application backend.
- No Firebase, cloud storage, database, auth, subscription system, advertisements, analytics, or paid dependency without explicit user approval.
- No Docker unless a chosen deployment target demonstrably requires it.
- Single-media downloads only; playlists remain disabled.

## Design source of truth

`docs/reference-design.png` is the accepted visual target.

Preserve:
- true-white cards and pale cool-blue page background,
- blue primary action and numbered flow,
- mobile header + bottom navigation,
- desktop left rail + main downloader + status column,
- compact modern spacing, rounded rectangles, subtle borders/shadows,
- link -> platform -> preview -> options -> downloading/completed order.

Do not redesign the application unless explicitly requested.

## Code ownership

- UI and workflow: `components/downloader-app.tsx`
- Visual system: `app/globals.css`
- yt-dlp/FFmpeg integration: `lib/media-engine.ts`, `lib/yt-dlp.ts`
- API contracts: `app/api/media/**`, `lib/types.ts`
- Platform detection: `lib/platform.ts`

Keep changes inside the owning module where possible.

## Required verification after meaningful changes

Run:

```bash
npm run check:runtime
npm run typecheck
npm run lint
npm run build
```

Then manually test at least one real public media URL and verify mobile layout before reporting completion.

Never claim a deployment target works until a real media file larger than 4.5 MB has been successfully downloaded through that deployed target.
