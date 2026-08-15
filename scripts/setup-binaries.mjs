import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const binDir = join(root, "bin");
const currentPlatform = platform();
const currentArch = arch();

function assetForRuntime() {
  if (currentPlatform === "win32" && currentArch === "x64") return { asset: "yt-dlp.exe", filename: "yt-dlp.exe" };
  if (currentPlatform === "darwin" && (currentArch === "x64" || currentArch === "arm64")) return { asset: "yt-dlp_macos", filename: "yt-dlp" };
  if (currentPlatform === "linux" && currentArch === "x64") return { asset: "yt-dlp_linux", filename: "yt-dlp" };
  if (currentPlatform === "linux" && currentArch === "arm64") return { asset: "yt-dlp_linux_aarch64", filename: "yt-dlp" };
  throw new Error(`No bundled yt-dlp standalone target is configured for ${currentPlatform}/${currentArch}. Set YT_DLP_BINARY to an existing executable instead.`);
}

async function fetchBuffer(url) {
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "cliptap-build" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} while downloading ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (process.env.YT_DLP_BINARY) {
    console.log(`YT_DLP_BINARY is set; skipping bundled yt-dlp download.`);
    return;
  }

  const { asset, filename } = assetForRuntime();
  await mkdir(binDir, { recursive: true });
  const destination = join(binDir, filename);

  // Avoid a network fetch if the correct executable has already been generated locally.
  try {
    const existing = await readFile(destination);
    if (existing.byteLength > 1_000_000) {
      console.log(`yt-dlp executable already present: ${destination}`);
      return;
    }
  } catch {}

  const base = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
  console.log(`Downloading official yt-dlp standalone executable (${asset})…`);
  const [binary, sums] = await Promise.all([
    fetchBuffer(`${base}/${asset}`),
    fetchBuffer(`${base}/SHA2-256SUMS`).then((buffer) => buffer.toString("utf8")),
  ]);

  const checksumLine = sums.split(/\r?\n/).find((line) => line.trim().endsWith(`  ${asset}`) || line.trim().endsWith(` *${asset}`));
  if (!checksumLine) throw new Error(`Could not find ${asset} in yt-dlp SHA2-256SUMS.`);
  const expected = checksumLine.trim().split(/\s+/)[0]?.toLowerCase();
  const actual = createHash("sha256").update(binary).digest("hex");
  if (!expected || expected !== actual) throw new Error(`yt-dlp checksum verification failed for ${asset}.`);

  await writeFile(destination, binary);
  if (currentPlatform !== "win32") await chmod(destination, 0o755);
  console.log(`yt-dlp ready: ${destination}`);

  // Ensure FFmpeg binary is initialized if ffmpeg-static install script was blocked or skipped by npm
  try {
    const ffmpegModule = (await import("ffmpeg-static")).default;
    const ffmpegExists = ffmpegModule ? await readFile(ffmpegModule).then(() => true).catch(() => false) : false;
    if (!ffmpegExists) {
      const installScript = join(root, "node_modules", "ffmpeg-static", "install.js");
      const { spawnSync } = await import("node:child_process");
      console.log("Setting up FFmpeg binary…");
      spawnSync(process.execPath, [installScript], { stdio: "inherit", windowsHide: true });
    }
  } catch {}
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
