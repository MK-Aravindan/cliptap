import { prepareDownload } from "@/lib/media-engine";
import type { DownloadRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

export async function POST(request: Request) {
  let prepared: Awaited<ReturnType<typeof prepareDownload>> | null = null;
  try {
    if (process.env.MEDIA_ENGINE_MOCK === "true") {
      const bytes = new TextEncoder().encode("ClipTap demo-mode file. Disable MEDIA_ENGINE_MOCK for real yt-dlp downloads.\n");
      return new Response(bytes, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": "attachment; filename=cliptap-demo.txt",
          "Cache-Control": "no-store",
        },
      });
    }
    const body = await request.json() as Partial<DownloadRequest>;
    if (!body.url || (body.mediaType !== "audio" && body.mediaType !== "video")) {
      return Response.json({ error: "A valid URL and media type are required." }, { status: 400 });
    }

    prepared = await prepareDownload({
      url: body.url.trim(),
      mediaType: body.mediaType,
      title: body.title,
      videoFormatId: body.videoFormatId,
      videoHeight: body.videoHeight,
      audioFormatId: body.audioFormatId,
      audioBitrate: body.audioBitrate,
    }, request.signal);

    const encoded = encodeURIComponent(prepared.filename);
    return new Response(prepared.stream(), {
      headers: {
        "Content-Type": contentTypeFor(prepared.filename),
        "Content-Length": String(prepared.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (prepared) await prepared.cleanup().catch(() => undefined);
    const message = error instanceof Error ? error.message : "Download failed.";
    return Response.json({ error: message }, { status: 422 });
  }
}
