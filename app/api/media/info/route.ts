import { NextResponse } from "next/server";
import { fetchMediaInfo } from "@/lib/media-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "bom1";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { url?: string };
    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: "Please paste a media URL." }, { status: 400 });
    const info = await fetchMediaInfo(url, request.signal);
    return NextResponse.json(info, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to analyze this URL.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
