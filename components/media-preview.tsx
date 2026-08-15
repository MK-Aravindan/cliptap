import { Play } from "lucide-react";
import type { MediaInfo } from "@/lib/types";

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X / Twitter",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  other: "Web Media",
};

export function MediaPreview({ info, loading }: { info: MediaInfo | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="preview-card preview-skeleton" aria-label="Loading media preview">
        <div className="skeleton thumbnail-skeleton" />
        <div className="preview-copy">
          <div className="skeleton line line-title" />
          <div className="skeleton line line-medium" />
          <div className="skeleton line line-short" />
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="preview-card empty-preview">
        <div className="empty-preview-icon"><Play size={22} fill="currentColor" /></div>
        <div>
          <strong>Your media preview appears here</strong>
          <p>Paste any public media link above to automatically analyze it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-card">
      <div className="thumbnail-wrap">
        {info.thumbnail ? <img src={info.thumbnail} alt="" className="media-thumbnail" /> : <div className="thumbnail-fallback" />}
        <span className="play-overlay" aria-hidden="true"><Play size={20} fill="white" /></span>
        {info.durationLabel ? <span className="duration-badge">{info.durationLabel}</span> : null}
      </div>
      <div className="preview-copy">
        <div className="preview-meta-row">
          <span className={`platform-pill platform-pill-${info.platform}`}>
            {PLATFORM_NAMES[info.platform] ?? "Media"}
          </span>
          {info.uploadDate ? <span className="upload-date-inline">{info.uploadDate}</span> : null}
        </div>
        <h2>{info.title}</h2>
        {info.uploader ? <p className="uploader">{info.uploader}<span className="verified-dot" aria-label="Publisher">✓</span></p> : null}
      </div>
    </div>
  );
}
