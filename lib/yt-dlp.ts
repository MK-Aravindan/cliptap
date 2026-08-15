import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";

export function getYtDlpBinary(): string {
  const override = process.env.YT_DLP_BINARY?.trim();
  if (override) return override;
  const filename = platform() === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const bundled = join(process.cwd(), "bin", filename);
  if (!existsSync(bundled)) {
    throw new Error(`yt-dlp executable is missing at ${bundled}. Run npm install (or npm run postinstall) before starting the app.`);
  }
  return bundled;
}

export async function runYtDlp(args: string[], timeoutMs = 120_000, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  const binary = getYtDlpBinary();
  if (signal?.aborted) throw new Error("Media processing was cancelled.");
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const maxCapture = 16 * 1024 * 1024;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      callback();
    };
    const abort = () => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("Media processing was cancelled.")));
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error(`yt-dlp timed out after ${Math.round(timeoutMs / 1000)} seconds.`)));
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { if (stdout.length < maxCapture) stdout += chunk; });
    child.stderr.on("data", (chunk: string) => { if (stderr.length < maxCapture) stderr += chunk; });
    child.once("error", (error) => {
      finish(() => reject(error));
    });
    child.once("close", (code) => {
      finish(() => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(stderr.trim() || `yt-dlp exited with code ${code ?? "unknown"}.`));
      });
    });
  });
}

export function runtimeDescription(): string {
  return `${platform()}/${arch()}`;
}
