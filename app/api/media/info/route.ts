import { NextResponse } from "next/server";
import { fetchMediaInfo, getMediaErrorResponse } from "@/lib/media-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET() {
  return NextResponse.json({ error: "Use POST with a media URL.", code: "invalid_request", retryable: false }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON.", code: "invalid_json", retryable: false }, { status: 400 });
  }

  const url = body && typeof body === "object" && !Array.isArray(body) && "url" in body && typeof body.url === "string"
    ? body.url.trim()
    : "";
  if (!url) {
    return NextResponse.json({ error: "Please provide a valid http(s) media URL.", code: "invalid_request", retryable: false }, { status: 400 });
  }

  try {
    const info = await fetchMediaInfo(url, request.signal);
    return NextResponse.json(info, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const { status, payload } = getMediaErrorResponse(error);
    if (status >= 500) console.error(`[media/info] ${payload.code}`);
    return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
  }
}
