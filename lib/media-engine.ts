import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import ffmpegPath from "ffmpeg-static";
import { detectPlatform, isHttpUrl } from "./platform";
import type { AudioQuality, DownloadRequest, MediaInfo, VideoQuality } from "./types";
import { formatDuration, sanitizeFilename } from "./utils";
import { runYtDlp } from "./yt-dlp";

function formatUploadDate(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{8}$/.test(raw)) return typeof raw === "string" ? raw : null;
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getEstimatedSize(format: Record<string, unknown>): number | null {
  return numberOrNull(format.filesize) ?? numberOrNull(format.filesize_approx);
}

function getCanonicalVideoQuality(format: Record<string, unknown>): { tier: number; label: string } | null {
  const note = typeof format.format_note === "string" ? format.format_note : "";
  const match = note.match(/(\d{3,4})p/i);
  const noteTier = match ? Number(match[1]) : null;

  const rawHeight = numberOrNull(format.height) ?? 0;
  const rawWidth = numberOrNull(format.width) ?? 0;
  const maxDim = Math.max(rawHeight, rawWidth);

  let tier: number;
  if (noteTier && [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320].includes(noteTier)) {
    tier = noteTier;
  } else if (rawHeight >= 2160 || rawWidth >= 3840 || maxDim >= 3840) {
    tier = 2160;
  } else if (rawHeight >= 1440 || rawWidth >= 2560 || maxDim >= 2560) {
    tier = 1440;
  } else if (rawHeight >= 1080 || rawWidth >= 1920 || maxDim >= 1920) {
    tier = 1080;
  } else if (rawHeight >= 720 || rawWidth >= 1280 || maxDim >= 1280) {
    tier = 720;
  } else if (rawHeight >= 480 || rawWidth >= 854 || maxDim >= 854) {
    tier = 480;
  } else if (rawHeight >= 360 || rawWidth >= 640 || maxDim >= 640) {
    tier = 360;
  } else if (rawHeight >= 240 || rawWidth >= 426 || maxDim >= 426) {
    tier = 240;
  } else if (rawHeight > 0 || rawWidth > 0) {
    tier = 144;
  } else {
    return null;
  }

  const label = tier >= 2160 ? `${tier}p (4K)` : tier >= 1440 ? `${tier}p (2K)` : tier === 1080 ? "1080p (Full HD)" : tier === 720 ? "720p (HD)" : `${tier}p`;
  return { tier, label };
}

function buildVideoQualities(formats: Array<Record<string, unknown>>): VideoQuality[] {
  const byTier = new Map<number, { quality: VideoQuality; videoOnly: boolean }>();
  for (const format of formats) {
    const vcodec = typeof format.vcodec === "string" ? format.vcodec : "none";
    if (vcodec === "none") continue;
    const canonical = getCanonicalVideoQuality(format);
    if (!canonical) continue;
    const current = byTier.get(canonical.tier);
    const formatId = String(format.format_id ?? "");
    if (!formatId) continue;
    const estimatedSize = getEstimatedSize(format);
    const extension = typeof format.ext === "string" ? format.ext : "mp4";
    const isVideoOnly = (typeof format.acodec === "string" ? format.acodec : "none") === "none";
    const shouldReplace = !current
      || (isVideoOnly && !current.videoOnly)
      || (isVideoOnly === current.videoOnly
        && typeof current.quality.estimatedSize !== "number"
        && typeof estimatedSize === "number");
    if (shouldReplace) {
      byTier.set(canonical.tier, {
        quality: {
          formatId,
          height: canonical.tier,
          label: canonical.label,
          extension,
          estimatedSize,
        },
        videoOnly: isVideoOnly,
      });
    }
  }
  return [...byTier.values()].map(({ quality }) => quality).sort((a, b) => b.height - a.height);
}

function buildAudioQualities(formats: Array<Record<string, unknown>>): AudioQuality[] {
  const audio: AudioQuality[] = [];
  const seen = new Set<string>();
  for (const format of formats) {
    const acodec = typeof format.acodec === "string" ? format.acodec : "none";
    const vcodec = typeof format.vcodec === "string" ? format.vcodec : "none";
    if (acodec === "none" || vcodec !== "none") continue;
    const formatId = String(format.format_id ?? "");
    if (!formatId) continue;
    const bitrate = numberOrNull(format.abr);
    const ext = typeof format.ext === "string" ? format.ext : "audio";
    const key = `${Math.round(bitrate ?? 0)}-${ext}`;
    if (seen.has(key)) continue;
    seen.add(key);
    audio.push({
      formatId,
      bitrate,
      extension: ext,
      estimatedSize: getEstimatedSize(format),
      label: bitrate ? `${Math.round(bitrate)} kbps (${ext.toUpperCase()})` : `Best available (${ext.toUpperCase()})`,
    });
  }
  return audio.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0)).slice(0, 8);
}

function mockInfo(url: string): MediaInfo {
  return {
    id: "demo",
    title: "Wonderful places to visit in 2024",
    uploader: "Explorer Quest",
    uploadDate: "May 12, 2024",
    thumbnail: "/demo-thumbnail.svg",
    duration: 765,
    durationLabel: "12:45",
    platform: detectPlatform(url),
    webpageUrl: url,
    videoQualities: [
      { formatId: "demo-1080", height: 1080, label: "1080p (Full HD)", extension: "mp4", estimatedSize: 95_400_000 },
      { formatId: "demo-720", height: 720, label: "720p (HD)", extension: "mp4", estimatedSize: 54_000_000 },
      { formatId: "demo-480", height: 480, label: "480p", extension: "mp4", estimatedSize: 31_000_000 },
    ],
    audioQualities: [
      { formatId: "demo-192", bitrate: 192, label: "192 kbps (M4A)", extension: "m4a", estimatedSize: 12_000_000 },
      { formatId: "demo-128", bitrate: 128, label: "128 kbps (M4A)", extension: "m4a", estimatedSize: 8_000_000 },
    ],
  };
}

const youtubeClientProfiles = [
  "android_vr,web_embedded;skip=hls,dash",
  "web_creator,android_vr;skip=hls,dash",
  "tv_simply,android_vr;skip=hls,dash",
  "android,web_embedded;skip=hls,dash",
] as const;

function commonArgs(youtubeClients: string = youtubeClientProfiles[0]): string[] {
  return [
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificates",
    "--geo-bypass",
    "--socket-timeout", "15",
    "--js-runtimes", "node",
    "--extractor-args", `youtube:player_client=${youtubeClients}`,
  ];
}

function isYoutubeChallenge(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /sign in to confirm|not a bot|po.?token|requested format is not available|http error 403/i.test(message);
}

export type MediaErrorCode =
  | "invalid_request"
  | "invalid_json"
  | "cancelled"
  | "timeout"
  | "youtube_verification"
  | "rate_limited"
  | "media_unavailable"
  | "upstream_unavailable"
  | "internal";

export interface MediaErrorPayload {
  error: string;
  code: MediaErrorCode;
  retryable: boolean;
}

export interface MediaErrorResponse {
  status: number;
  payload: MediaErrorPayload;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "";
}

export function getMediaErrorResponse(error: unknown): MediaErrorResponse {
  const message = errorMessage(error);
  const lower = message.toLowerCase();

  if (/valid http\(s\) media url|invalid media url/.test(lower)) {
    return { status: 400, payload: { error: "Please provide a valid http(s) media URL.", code: "invalid_request", retryable: false } };
  }
  if (/cancelled|aborted/.test(lower)) {
    return { status: 499, payload: { error: "The request was cancelled.", code: "cancelled", retryable: true } };
  }
  if (/timed out|timeout|deadline exceeded/.test(lower)) {
    return { status: 504, payload: { error: "The media source took too long to respond. Try again.", code: "timeout", retryable: true } };
  }
  if (/sign in to confirm|not a bot|po.?token|http error 403/.test(lower)) {
    return {
      status: 422,
      payload: {
        error: "YouTube asked for browser verification for this server request. ClipTap does not store browser cookies; please retry later or use another public URL.",
        code: "youtube_verification",
        retryable: true,
      },
    };
  }
  if (/rate limit|too many requests|http error 429/.test(lower)) {
    return { status: 429, payload: { error: "The media source is temporarily rate-limiting requests. Wait a moment and try again.", code: "rate_limited", retryable: true } };
  }
  if (/instagram sent an empty media response|login required|private|unavailable|no formats|requested format is not available|unsupported url/.test(lower)) {
    return { status: 422, payload: { error: "This link is not publicly downloadable or no media format is available.", code: "media_unavailable", retryable: false } };
  }
  if (/network|connection|dns|could not resolve|unable to download/.test(lower)) {
    return { status: 503, payload: { error: "The media source could not be reached. Check the link and try again.", code: "upstream_unavailable", retryable: true } };
  }
  return { status: 500, payload: { error: "ClipTap could not process this media URL. Try again later.", code: "internal", retryable: false } };
}

export function formatMediaError(error: unknown): string {
  return getMediaErrorResponse(error).payload.error;
}

async function runMediaCommand(url: string, extraArgs: string[], timeoutMs: number, signal?: AbortSignal) {
  const profiles = detectPlatform(url) === "youtube" ? youtubeClientProfiles : [youtubeClientProfiles[0]];
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (const profile of profiles) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    try {
      return await runYtDlp([...commonArgs(profile), ...extraArgs], remainingMs, signal);
    } catch (error) {
      lastError = error;
      if (detectPlatform(url) !== "youtube" || !isYoutubeChallenge(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The media processor failed.");
}

export async function fetchMediaInfo(url: string, signal?: AbortSignal): Promise<MediaInfo> {
  if (!isHttpUrl(url)) throw new Error("Please enter a valid http(s) media URL.");
  if (process.env.MEDIA_ENGINE_MOCK === "true") return mockInfo(url);

  const { stdout } = await runMediaCommand(url, [
    "--dump-single-json",
    "--skip-download",
    url,
  ], 60_000, signal);
  const raw = JSON.parse(stdout) as Record<string, unknown>;
  const formats = Array.isArray(raw.formats) ? raw.formats.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  const duration = numberOrNull(raw.duration);
  const source = typeof raw.webpage_url === "string" ? raw.webpage_url : url;
  const videoQualities = buildVideoQualities(formats);
  const audioQualities = buildAudioQualities(formats);

  return {
    id: String(raw.id ?? "media"),
    title: typeof raw.title === "string" ? raw.title : "Untitled media",
    uploader: typeof raw.uploader === "string" ? raw.uploader : null,
    uploadDate: formatUploadDate(raw.upload_date),
    thumbnail: typeof raw.thumbnail === "string" ? raw.thumbnail : null,
    duration,
    durationLabel: formatDuration(duration),
    platform: detectPlatform(source),
    webpageUrl: source,
    videoQualities: videoQualities.length ? videoQualities : [{ formatId: "best", height: 1080, label: "Best available video", extension: "mp4", estimatedSize: null }],
    audioQualities,
  };
}

export interface PreparedDownload {
  filename: string;
  filePath: string;
  size: number;
  cleanup: () => Promise<void>;
  stream: () => ReadableStream<Uint8Array>;
}

export async function prepareDownload(request: DownloadRequest, signal?: AbortSignal): Promise<PreparedDownload> {
  if (!isHttpUrl(request.url)) throw new Error("Invalid media URL.");
  if (process.env.MEDIA_ENGINE_MOCK === "true") throw new Error("Real media processing is disabled in mock mode.");
  if (!ffmpegPath) throw new Error("FFmpeg executable could not be resolved. Reinstall ffmpeg-static.");

  const workDir = await mkdtemp(join(tmpdir(), "cliptap-"));
  const outputTemplate = join(workDir, "%(title).180s.%(ext)s");
  const args = [
    "--restrict-filenames",
    "--ffmpeg-location", ffmpegPath,
    "-o", outputTemplate,
  ];

  if (request.mediaType === "audio") {
    const formatSelector = request.audioFormatId ? `${request.audioFormatId}/bestaudio/best` : "bestaudio/best";
    args.push(
      "-f", formatSelector,
      "-x",
      "--audio-format", "mp3",
      "--audio-quality", request.audioBitrate ? `${Math.max(64, Math.round(request.audioBitrate))}K` : "0",
    );
  } else {
    const tier = Math.max(144, Math.min(2160, Number(request.videoHeight) || 1080));
    const widthBound = tier >= 2160 ? 3840 : tier >= 1440 ? 2560 : tier >= 1080 ? 1920 : tier >= 720 ? 1280 : tier >= 480 ? 854 : tier >= 360 ? 640 : tier >= 240 ? 426 : 256;
    const formatId = request.videoFormatId?.trim();
    const landscape = `[height<=${tier}][width<=${widthBound}]`;
    const portrait = `[height<=${widthBound}][width<=${tier}]`;
    const fallbackSelector = `bestvideo${landscape}+bestaudio[ext=m4a]/bestvideo${portrait}+bestaudio[ext=m4a]/bestvideo${landscape}+bestaudio/bestvideo${portrait}+bestaudio/best${landscape}/best${portrait}/best`;
    args.push(
      "-f", formatId && /^[\w.-]+$/.test(formatId)
        ? `${formatId}+bestaudio[ext=m4a]/${formatId}+bestaudio/${formatId}/${fallbackSelector}`
        : fallbackSelector,
      "--merge-output-format", "mp4",
    );
  }
  args.push(request.url);

  try {
    await runMediaCommand(request.url, args, 290_000, signal);
    const entries = await readdir(workDir);
    const candidates = entries.filter((name) => !name.endsWith(".part") && !name.endsWith(".ytdl") && !name.endsWith(".temp"));
    if (!candidates.length) throw new Error("The media processor finished without creating a file.");

    let selected: { name: string; size: number } | null = null;
    for (const name of candidates) {
      const fileStat = await stat(join(workDir, name));
      if (!fileStat.isFile() || fileStat.size <= 0) continue;
      if (!selected || fileStat.size > selected.size) selected = { name, size: fileStat.size };
    }
    if (!selected) throw new Error("The downloaded media file was empty.");

    const filePath = join(workDir, selected.name);
    const extension = extname(selected.name) || (request.mediaType === "audio" ? ".mp3" : ".mp4");
    const filename = `${sanitizeFilename(request.title ?? selected.name.slice(0, -extension.length))}${extension}`;
    const cleanup = () => rm(workDir, { recursive: true, force: true });
    return {
      filename,
      filePath,
      size: selected.size,
      cleanup,
      stream: () => {
        const nodeStream = createReadStream(filePath);
        nodeStream.once("close", () => void cleanup());
        nodeStream.once("error", () => void cleanup());
        return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
      },
    };
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}
