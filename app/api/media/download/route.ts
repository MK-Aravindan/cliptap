import { getMediaErrorResponse, prepareDownload } from "@/lib/media-engine";

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

export function GET() {
  return Response.json({ error: "Use POST with a media URL and media type.", code: "invalid_request", retryable: false }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  let prepared: Awaited<ReturnType<typeof prepareDownload>> | null = null;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON.", code: "invalid_json", retryable: false }, { status: 400 });
  }

  const isObjectBody = typeof body === "object" && body !== null && !Array.isArray(body);
  const values = isObjectBody ? body as Record<string, unknown> : {};
  const url = typeof values.url === "string" ? values.url.trim() : "";
  const mediaType = values.mediaType === "audio" || values.mediaType === "video" ? values.mediaType : null;
  if (!url || !mediaType) {
    return Response.json({ error: "A valid URL and media type are required.", code: "invalid_request", retryable: false }, { status: 400 });
  }

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

    const title = typeof values.title === "string" ? values.title : undefined;
    const videoFormatId = typeof values.videoFormatId === "string" ? values.videoFormatId : undefined;
    const videoHeight = typeof values.videoHeight === "number" && Number.isFinite(values.videoHeight) ? values.videoHeight : undefined;
    const audioFormatId = typeof values.audioFormatId === "string" ? values.audioFormatId : undefined;
    const audioBitrate = typeof values.audioBitrate === "number" && Number.isFinite(values.audioBitrate) ? values.audioBitrate : undefined;

    prepared = await prepareDownload({
      url,
      mediaType,
      title,
      videoFormatId,
      videoHeight,
      audioFormatId,
      audioBitrate,
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
    const { status, payload } = getMediaErrorResponse(error);
    if (status >= 500) console.error(`[media/download] ${payload.code}`);
    return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
  }
}
