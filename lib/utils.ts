export function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds < 0) return null;
  const rounded = Math.floor(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 1) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex > 1 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const rounded = Math.ceil(seconds);
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function sanitizeFilename(value: string): string {
  const clean = value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
  return clean.slice(0, 180) || "download";
}

export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try { return decodeURIComponent(utf[1].replace(/["']/g, "")); } catch { return utf[1]; }
  }
  const basic = header.match(/filename="?([^";]+)"?/i);
  return basic?.[1] ?? null;
}
