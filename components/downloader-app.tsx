"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleX,
  Download,
  Link2,
  Menu,
  Music2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Video,
  X,
  Zap,
} from "lucide-react";
import { Brand } from "./brand";
import { CustomSelect } from "./custom-select";
import { MediaPreview } from "./media-preview";
import { BottomNav, Sidebar } from "./navigation";
import { HistoryView } from "./history-view";
import { SettingsView } from "./settings-view";
import { isHttpUrl } from "@/lib/platform";
import type {
  AppView,
  AudioQuality,
  DownloadHistoryItem,
  DownloaderSettings,
  MediaInfo,
  MediaType,
  VideoQuality,
} from "@/lib/types";
import { formatBytes, formatEta, formatSpeed, parseContentDispositionFilename } from "@/lib/utils";

const HISTORY_KEY = "cliptap-history-v1";
const SETTINGS_KEY = "cliptap-settings-v1";
const LARGE_FILE_SOFT_LIMIT = 400 * 1024 * 1024;
const DEFAULT_SETTINGS: DownloaderSettings = { autoAnalyze: true, defaultMediaType: "video" };

type DownloadPhase = "idle" | "preparing" | "transferring" | "complete" | "error";

interface DownloadState {
  phase: DownloadPhase;
  progress: number;
  loaded: number;
  total: number | null;
  speed: number;
  eta: number;
  filename: string | null;
  error: string | null;
}

const INITIAL_DOWNLOAD: DownloadState = {
  phase: "idle",
  progress: 0,
  loaded: 0,
  total: null,
  speed: 0,
  eta: 0,
  filename: null,
  error: null,
};

function StepLabel({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <div className="step-label">
      <span>{number}</span>
      <strong>{children}</strong>
    </div>
  );
}

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export function DownloaderApp() {
  const [view, setView] = useState<AppView>("downloader");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [selectedHeight, setSelectedHeight] = useState<number>(1080);
  const [selectedAudio, setSelectedAudio] = useState<string>("");
  const [download, setDownload] = useState<DownloadState>(INITIAL_DOWNLOAD);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [settings, setSettings] = useState<DownloaderSettings>(DEFAULT_SETTINGS);
  const analysisAbort = useRef<AbortController | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const lastAnalyzedUrl = useRef("");

  useEffect(() => {
    setHistory(safeJson<DownloadHistoryItem[]>(window.localStorage.getItem(HISTORY_KEY), []));
    const stored = safeJson<DownloaderSettings>(window.localStorage.getItem(SETTINGS_KEY), DEFAULT_SETTINGS);
    setSettings({ ...DEFAULT_SETTINGS, ...stored });
    setMediaType(stored.defaultMediaType ?? "video");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const analyze = useCallback(async (targetUrl: string) => {
    const normalized = targetUrl.trim();
    if (!isHttpUrl(normalized)) return;
    analysisAbort.current?.abort();
    const controller = new AbortController();
    analysisAbort.current = controller;
    setAnalyzing(true);
    setAnalysisError(null);
    setInfo(null);
    setDownload(INITIAL_DOWNLOAD);
    try {
      const response = await fetch("/api/media/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalized }),
        signal: controller.signal,
      });
      const payload = await response.json() as MediaInfo | { error?: string };
      if (!response.ok) throw new Error("error" in payload ? payload.error || "Unable to analyze this URL." : "Unable to analyze this URL.");
      const media = payload as MediaInfo;
      setInfo(media);
      lastAnalyzedUrl.current = normalized;
      setMediaType(settings.defaultMediaType);
      setSelectedHeight(media.videoQualities[0]?.height ?? 1080);
      setSelectedAudio(media.audioQualities[0]?.formatId ?? "");
    } catch (error) {
      if (controller.signal.aborted) return;
      setAnalysisError(error instanceof Error ? error.message : "Unable to analyze this URL.");
    } finally {
      if (!controller.signal.aborted) setAnalyzing(false);
    }
  }, [settings.defaultMediaType]);

  useEffect(() => {
    if (!settings.autoAnalyze || !isHttpUrl(url) || url === lastAnalyzedUrl.current) return;
    const timer = window.setTimeout(() => void analyze(url), 650);
    return () => window.clearTimeout(timer);
  }, [url, analyze, settings.autoAnalyze]);

  const selectedVideo = useMemo<VideoQuality | null>(() => {
    return info?.videoQualities.find((item) => item.height === selectedHeight) ?? info?.videoQualities[0] ?? null;
  }, [info, selectedHeight]);

  const selectedAudioQuality = useMemo<AudioQuality | null>(() => {
    return info?.audioQualities.find((item) => item.formatId === selectedAudio) ?? info?.audioQualities[0] ?? null;
  }, [info, selectedAudio]);

  const selectedQualityLabel = mediaType === "video"
    ? selectedVideo?.label ?? "Best video"
    : selectedAudioQuality?.label ?? "Best audio";

  const videoOptions = useMemo(() => {
    return (info?.videoQualities ?? []).map((quality) => ({
      value: quality.height,
      label: quality.label,
      estimatedSize: quality.estimatedSize,
    }));
  }, [info?.videoQualities]);

  const audioOptions = useMemo(() => {
    if (!info?.audioQualities.length) {
      return [{ value: "best", label: "Best available audio" }];
    }
    return info.audioQualities.map((quality) => ({
      value: quality.formatId,
      label: quality.label,
      estimatedSize: quality.estimatedSize,
    }));
  }, [info?.audioQualities]);

  const selectedEstimate = mediaType === "video" ? selectedVideo?.estimatedSize ?? null : selectedAudioQuality?.estimatedSize ?? null;
  const isLargeEstimate = Boolean(selectedEstimate && selectedEstimate > LARGE_FILE_SOFT_LIMIT);
  const canDownload = Boolean(info && !analyzing && !isLargeEstimate && download.phase !== "preparing" && download.phase !== "transferring");

  const saveHistory = useCallback((item: DownloadHistoryItem) => {
    setHistory((current) => {
      const next = [item, ...current.filter((existing) => existing.sourceUrl !== item.sourceUrl)].slice(0, 20);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const startDownload = useCallback(async () => {
    if (!info || !canDownload) return;
    downloadAbort.current?.abort();
    const controller = new AbortController();
    downloadAbort.current = controller;
    setDownload({ ...INITIAL_DOWNLOAD, phase: "preparing", filename: info.title });

    try {
      const response = await fetch("/api/media/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.webpageUrl,
          mediaType,
          videoFormatId: mediaType === "video" ? selectedVideo?.formatId : undefined,
          videoHeight: mediaType === "video" ? selectedVideo?.height : undefined,
          audioFormatId: mediaType === "audio" ? selectedAudioQuality?.formatId : undefined,
          audioBitrate: mediaType === "audio" ? selectedAudioQuality?.bitrate : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Download failed." })) as { error?: string };
        throw new Error(payload.error || "Download failed.");
      }
      if (!response.body) throw new Error("The server did not return a downloadable file.");

      const totalHeader = Number(response.headers.get("content-length"));
      const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
      const filename = parseContentDispositionFilename(response.headers.get("content-disposition"))
        ?? `${info.title}.${mediaType === "audio" ? "mp3" : "mp4"}`;
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      let lastLoaded = 0;
      let lastTime = performance.now();
      let smoothedSpeed = 0;

      setDownload({ ...INITIAL_DOWNLOAD, phase: "transferring", total, filename });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          const now = performance.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed >= 0.25) {
            const instant = (loaded - lastLoaded) / elapsed;
            smoothedSpeed = smoothedSpeed ? smoothedSpeed * 0.72 + instant * 0.28 : instant;
            lastLoaded = loaded;
            lastTime = now;
          }
          const progress = total ? Math.min(100, (loaded / total) * 100) : 0;
          const eta = total && smoothedSpeed > 0 ? Math.max(0, (total - loaded) / smoothedSpeed) : 0;
          setDownload({ phase: "transferring", progress, loaded, total, speed: smoothedSpeed, eta, filename, error: null });
        }
      }

      const blob = new Blob(chunks as BlobPart[], { type: contentType });
      triggerBlobDownload(blob, filename);
      const finalSize = total ?? blob.size;
      setDownload({ phase: "complete", progress: 100, loaded: finalSize, total: finalSize, speed: smoothedSpeed, eta: 0, filename, error: null });
      saveHistory({
        id: `${Date.now()}-${info.id}`,
        title: info.title,
        mediaType,
        quality: selectedQualityLabel,
        downloadedAt: new Date().toISOString(),
        sourceUrl: info.webpageUrl,
        thumbnail: info.thumbnail,
        filename,
        size: finalSize,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setDownload({ ...INITIAL_DOWNLOAD, error: "Download cancelled." });
        return;
      }
      setDownload({ ...INITIAL_DOWNLOAD, phase: "error", error: error instanceof Error ? error.message : "Download failed." });
    }
  }, [canDownload, info, mediaType, saveHistory, selectedAudioQuality, selectedQualityLabel, selectedVideo]);

  const cancelDownload = () => {
    downloadAbort.current?.abort();
    downloadAbort.current = null;
  };

  const resetSource = () => {
    analysisAbort.current?.abort();
    downloadAbort.current?.abort();
    setUrl("");
    setInfo(null);
    setAnalysisError(null);
    setDownload(INITIAL_DOWNLOAD);
    lastAnalyzedUrl.current = "";
  };

  const reuseHistory = (item: DownloadHistoryItem) => {
    setUrl(item.sourceUrl);
    setView("downloader");
    setMobileMenuOpen(false);
    void analyze(item.sourceUrl);
  };

  const clearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem(HISTORY_KEY);
  };

  const handleView = (next: AppView) => {
    setView(next);
    setMobileMenuOpen(false);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <Brand />
        <button type="button" className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenuOpen((value) => !value)}>
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        {mobileMenuOpen ? (
          <div className="mobile-menu-popover">
            <button type="button" onClick={() => handleView("downloader")}>Downloader</button>
            <button type="button" onClick={() => handleView("history")}>History</button>
            <button type="button" onClick={() => handleView("settings")}>Settings</button>
          </div>
        ) : null}
      </header>

      <div className="desktop-layout">
        <Sidebar active={view} onChange={handleView} />

        <div className="content-area">
          {view === "history" ? (
            <HistoryView items={history} onClear={clearHistory} onReuse={reuseHistory} />
          ) : view === "settings" ? (
            <SettingsView settings={settings} onChange={setSettings} />
          ) : (
            <div className="downloader-layout">
              <section className="main-panel" aria-label="Media downloader">
                <div className="section-block link-section">
                  <StepLabel number={1}>Paste your link</StepLabel>
                  <div className={`url-field ${analysisError ? "has-error" : ""}`}>
                    <Link2 size={18} className="url-leading-icon" />
                    <input
                      type="url"
                      value={url}
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="https://www.youtube.com/watch?v=..."
                      aria-label="Media URL"
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && isHttpUrl(url)) void analyze(url);
                      }}
                    />
                    {analyzing ? <span className="field-spinner" aria-label="Analyzing" /> : url ? (
                      <button type="button" className="clear-url" aria-label="Clear URL" onClick={resetSource}><CircleX size={18} /></button>
                    ) : null}
                  </div>
                  {analysisError ? <p className="form-error">{analysisError}</p> : <p className="field-helper">Paste a public media link (YouTube, Instagram Reels, X/Twitter, etc.). ClipTap automatically detects the platform.</p>}
                </div>

                <div className="section-block preview-section">
                  <StepLabel number={2}>Preview</StepLabel>
                  <MediaPreview info={info} loading={analyzing} />
                </div>

                <div className={`section-block options-section ${!info ? "is-disabled" : ""}`}>
                  <StepLabel number={3}>Choose options</StepLabel>
                  <div className="media-toggle" role="group" aria-label="Media type">
                    <button type="button" disabled={!info} className={mediaType === "video" ? "is-active" : ""} onClick={() => setMediaType("video")}><Video size={17} fill={mediaType === "video" ? "currentColor" : "none"} /> Video</button>
                    <button type="button" disabled={!info} className={mediaType === "audio" ? "is-active" : ""} onClick={() => setMediaType("audio")}><Music2 size={17} /> Audio</button>
                  </div>

                  <label className="quality-label" htmlFor="quality-select">Quality</label>
                  {mediaType === "video" ? (
                    <CustomSelect
                      id="quality-select"
                      value={selectedHeight}
                      options={videoOptions.length ? videoOptions : [{ value: 1080, label: "1080p (Full HD)" }]}
                      disabled={!info}
                      placeholder="Select resolution"
                      onChange={(val) => setSelectedHeight(Number(val))}
                    />
                  ) : (
                    <CustomSelect
                      id="quality-select"
                      value={selectedAudio}
                      options={audioOptions}
                      disabled={!info || !info.audioQualities.length}
                      placeholder="Select audio quality"
                      onChange={(val) => setSelectedAudio(String(val))}
                    />
                  )}
                  {selectedEstimate ? <p className={`size-hint ${isLargeEstimate ? "warning" : ""}`}>Estimated source size: {formatBytes(selectedEstimate)}{isLargeEstimate ? " · choose a smaller quality for the free deployment target" : ""}</p> : null}

                  <button type="button" className="download-button" disabled={!canDownload} onClick={() => void startDownload()}>
                    <Download size={19} strokeWidth={2.4} />
                    <span>{download.phase === "complete" ? "Download again" : "Download"}</span>
                  </button>
                </div>
              </section>

              <aside className="status-panel" aria-label="Download status">
                <div className="status-header-desktop">
                  <div><p className="eyeline">Fast & simple</p><h1>Download your media</h1></div>
                  <div className="trust-badge"><ShieldCheck size={17} /> Private</div>
                </div>

                <div className="status-stack">
                  <div className={`status-card progress-status ${download.phase === "preparing" || download.phase === "transferring" ? "is-active" : ""}`}>
                    <div className="status-title-row">
                      <StepLabel number={4}>Downloading</StepLabel>
                      {(download.phase === "preparing" || download.phase === "transferring") ? <button type="button" className="icon-button" aria-label="Cancel download" onClick={cancelDownload}><X size={17} /></button> : null}
                    </div>
                    {download.phase === "preparing" ? (
                      <div className="preparing-state">
                        <span className="large-spinner" />
                        <div><strong>Preparing your file…</strong><p>yt-dlp is fetching and FFmpeg will merge or convert it when needed.</p></div>
                      </div>
                    ) : download.phase === "transferring" ? (
                      <>
                        <p className="status-filename">{download.filename}</p>
                        <div className="progress-metrics"><strong>{download.total ? `${Math.round(download.progress)}%` : formatBytes(download.loaded)}</strong><span>{formatSpeed(download.speed)}<br />ETA {download.total ? formatEta(download.eta) : "—"}</span></div>
                        <div className="progress-track"><span style={{ width: download.total ? `${download.progress}%` : "42%" }} className={!download.total ? "indeterminate" : ""} /></div>
                      </>
                    ) : (
                      <div className="status-empty"><Zap size={22} /><p>Your live download progress, speed and ETA will appear here.</p></div>
                    )}
                  </div>

                  <div className={`status-card completed-status ${download.phase === "complete" ? "is-complete" : ""}`}>
                    <div className="completed-heading"><span className="success-icon"><Check size={16} strokeWidth={3} /></span><strong>{download.phase === "complete" ? "Download complete" : "Completed"}</strong></div>
                    {download.phase === "complete" ? (
                      <>
                        <p className="status-filename">{download.filename}</p>
                        <p className="complete-meta">{selectedQualityLabel} · {formatBytes(download.total)}</p>
                        <div className="complete-actions">
                          <button type="button" className="secondary-button" onClick={() => void startDownload()}><RefreshCw size={16} /> Download again</button>
                          <button type="button" className="secondary-button green" onClick={() => navigator.clipboard?.writeText(info?.webpageUrl ?? url)}><Link2 size={16} /> Copy source</button>
                        </div>
                      </>
                    ) : (
                      <p className="completed-placeholder">Your finished file will be saved by the browser and added to local history.</p>
                    )}
                  </div>

                  {download.phase === "error" || download.error ? <div className="error-card"><CircleX size={18} /><div><strong>Download issue</strong><p>{download.error}</p></div></div> : null}
                </div>

                <div className="feature-strip">
                  <div><Zap size={18} /><span><strong>Fast</strong><small>Short-video friendly</small></span></div>
                  <div><ShieldCheck size={18} /><span><strong>Private</strong><small>No account needed</small></span></div>
                  <div><Sparkles size={18} /><span><strong>Clean</strong><small>Mobile first</small></span></div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>

      <BottomNav active={view} onChange={handleView} />
    </main>
  );
}
