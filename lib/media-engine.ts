import { createReadStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function commonArgs(): string[] {
  return [
    "--no-playlist",
    "--no-warnings",
    "--no-check-certificates",
    "--geo-bypass",
    "--socket-timeout", "15",
    "--js-runtimes", "node",
    "--extractor-args", "youtube:player_client=android_vr",
  ];
}

export async function fetchMediaInfo(url: string, signal?: AbortSignal): Promise<MediaInfo> {
  if (!isHttpUrl(url)) throw new Error("Please enter a valid http(s) media URL.");
  if (process.env.MEDIA_ENGINE_MOCK === "true") return mockInfo(url);

  const { stdout } = await runYtDlp([
    ...commonArgs(),
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
  const outputTemplate = join(workDir, "%(title).120s-%(id)s.%(ext)s");
  const args = [
    ...commonArgs(),
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
    await runYtDlp(args, 290_000, signal);
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
    const filename = sanitizeFilename(selected.name);
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
