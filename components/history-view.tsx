import { Clock3, Download, Trash2, Video, Music2 } from "lucide-react";
import type { DownloadHistoryItem } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

export function HistoryView({ items, onClear, onReuse }: { items: DownloadHistoryItem[]; onClear: () => void; onReuse: (item: DownloadHistoryItem) => void }) {
  return (
    <section className="secondary-view">
      <div className="view-heading-row">
        <div>
          <p className="eyeline">On this device</p>
          <h1>Download history</h1>
          <p>Your recent downloads are kept only in this browser.</p>
        </div>
        {items.length ? <button type="button" className="secondary-button danger" onClick={onClear}><Trash2 size={17} /> Clear</button> : null}
      </div>

      {items.length ? (
        <div className="history-list">
          {items.map((item) => (
            <article className="history-row" key={item.id}>
              <div className="history-thumb">
                {item.thumbnail ? <img src={item.thumbnail} alt="" /> : item.mediaType === "video" ? <Video size={22} /> : <Music2 size={22} />}
              </div>
              <div className="history-copy">
                <strong>{item.title}</strong>
                <span>{item.quality} · {formatBytes(item.size)}</span>
                <span className="history-time"><Clock3 size={13} /> {new Date(item.downloadedAt).toLocaleString()}</span>
              </div>
              <button type="button" className="icon-button" title="Use this source again" onClick={() => onReuse(item)}><Download size={18} /></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Clock3 size={30} />
          <h2>No downloads yet</h2>
          <p>Completed files will appear here for quick access to the original source link.</p>
        </div>
      )}
    </section>
  );
}
