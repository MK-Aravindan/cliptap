export type PlatformId = "youtube" | "instagram" | "x" | "facebook" | "linkedin" | "other";
export type MediaType = "video" | "audio";
export type AppView = "downloader" | "history" | "settings";

export interface VideoQuality {
  formatId: string;
  height: number;
  label: string;
  extension: string;
  estimatedSize?: number | null;
}

export interface AudioQuality {
  formatId: string;
  bitrate: number | null;
  label: string;
  extension: string;
  estimatedSize?: number | null;
}

export interface MediaInfo {
  id: string;
  title: string;
  uploader: string | null;
  uploadDate: string | null;
  thumbnail: string | null;
  duration: number | null;
  durationLabel: string | null;
  platform: PlatformId;
  webpageUrl: string;
  videoQualities: VideoQuality[];
  audioQualities: AudioQuality[];
}

export interface DownloadRequest {
  url: string;
  mediaType: MediaType;
  videoFormatId?: string;
  videoHeight?: number;
  audioFormatId?: string;
  audioBitrate?: number | null;
}

export interface DownloadHistoryItem {
  id: string;
  title: string;
  mediaType: MediaType;
  quality: string;
  downloadedAt: string;
  sourceUrl: string;
  thumbnail: string | null;
  filename: string;
  size: number | null;
}

export interface DownloaderSettings {
  autoAnalyze: boolean;
  defaultMediaType: MediaType;
}
