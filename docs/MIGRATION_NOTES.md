# Streamlit -> Next.js migration notes

This file maps the behavior of the supplied `main.py` into the new application so future edits do not accidentally remove features.

| Original Streamlit responsibility | Next.js implementation |
|---|---|
| Page configuration and custom CSS | `app/layout.tsx`, `app/globals.css` |
| URL input | `components/downloader-app.tsx` |
| `fetch_video_info()` | `POST /api/media/info` -> `fetchMediaInfo()` |
| `fetch_audio_formats()` | `buildAudioQualities()` in `lib/media-engine.ts` |
| `fetch_resolutions()` | `buildVideoQualities()` in `lib/media-engine.ts` |
| Audio/video radio selection | Mobile-friendly segmented control |
| Resolution/audio-quality selectbox | Native accessible `<select>` controls |
| `yt_dlp.YoutubeDL(...extract_info...)` | Official standalone `yt-dlp --dump-single-json` invoked from Node |
| FFmpeg audio extraction to MP3 | yt-dlp `-x --audio-format mp3` with `ffmpeg-static` |
| Video + audio merge to MP4 | yt-dlp format selector + `--merge-output-format mp4` with `ffmpeg-static` |
| `TemporaryDirectory()` | `mkdtemp()` under the Node OS temp directory + cleanup |
| Streamlit progress hook | Preparing state + browser transfer progress/speed/ETA |
| `st.download_button` | streamed API response -> browser Blob -> native download |
| Streamlit cache | lightweight private HTTP cache on metadata response; no persistent database |

## Intentional behavior differences

### 1. Web-safe completion actions

The prototype image shows **Open file** and **Show in folder**. Browsers do not provide a consistent cross-platform API to reveal an arbitrary downloaded file in the operating system file manager. The web implementation uses **Download again** and **Copy source** instead.

### 2. Progress has two stages

The server must finish yt-dlp/FFmpeg processing before it can stream a final merged/converted file. During that stage the UI says **Preparing your file…**. Once the response body begins arriving, the browser calculates transfer percentage, speed, and ETA from received bytes.

### 3. History is local-only

The original app had no history. The accepted prototype has navigation for History, so the implementation adds a small browser-local history list. It stores metadata only, never media files.

### 4. Platform chips are auto-detected

The user does not need to manually select YouTube/Instagram/etc. The URL host determines the highlighted platform chip. yt-dlp remains the source of truth for actual extractor support.
