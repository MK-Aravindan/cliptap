import type { PlatformId } from "./types";

const HOST_MATCHERS: Array<[PlatformId, RegExp]> = [
  ["youtube", /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i],
  ["instagram", /(^|\.)instagram\.com$/i],
  ["x", /(^|\.)x\.com$|(^|\.)twitter\.com$/i],
  ["facebook", /(^|\.)facebook\.com$|(^|\.)fb\.watch$/i],
  ["linkedin", /(^|\.)linkedin\.com$/i],
];

export function detectPlatform(url: string): PlatformId {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return HOST_MATCHERS.find(([, pattern]) => pattern.test(hostname))?.[0] ?? "other";
  } catch {
    return "other";
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
