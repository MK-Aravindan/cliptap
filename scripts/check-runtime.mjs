import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";

const ytDlpPath = process.env.YT_DLP_BINARY || join(process.cwd(), "bin", platform() === "win32" ? "yt-dlp.exe" : "yt-dlp");

console.log("ClipTap runtime check");
console.log(`Node: ${process.version}`);
console.log(`yt-dlp path: ${ytDlpPath}`);
console.log(`FFmpeg path: ${ffmpegPath ?? "not resolved"}`);

let failed = false;
if (!existsSync(ytDlpPath)) {
  console.error("yt-dlp executable is missing. Run npm run postinstall.");
  failed = true;
} else {
  const result = spawnSync(ytDlpPath, ["--version"], { encoding: "utf8", windowsHide: true });
  if (result.status === 0) console.log(`yt-dlp: ${result.stdout.trim()}`);
  else { console.error(result.stderr || "yt-dlp execution failed."); failed = true; }
}

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error("FFmpeg executable is missing.");
  failed = true;
} else {
  const result = spawnSync(ffmpegPath, ["-version"], { encoding: "utf8", windowsHide: true });
  if (result.status === 0) console.log(result.stdout.split(/\r?\n/)[0]);
  else { console.error(result.stderr || "FFmpeg execution failed."); failed = true; }
}

if (failed) process.exit(1);
console.log("Runtime looks ready.");
