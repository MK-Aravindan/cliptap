import { Database, Music2, ShieldCheck, Video } from "lucide-react";
import type { DownloaderSettings, MediaType } from "@/lib/types";

export function SettingsView({ settings, onChange }: { settings: DownloaderSettings; onChange: (next: DownloaderSettings) => void }) {
  const setDefault = (defaultMediaType: MediaType) => onChange({ ...settings, defaultMediaType });
  return (
    <section className="secondary-view">
      <div className="view-heading-row">
        <div>
          <p className="eyeline">Personal defaults</p>
          <h1>Settings</h1>
          <p>Keep the app simple and tuned for short downloads.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <div className="settings-icon"><Video size={20} /></div>
          <div>
            <strong>Default media type</strong>
            <p>Choose what should be selected after a link is analyzed.</p>
          </div>
          <div className="mini-segment">
            <button type="button" className={settings.defaultMediaType === "video" ? "is-active" : ""} onClick={() => setDefault("video")}><Video size={15} /> Video</button>
            <button type="button" className={settings.defaultMediaType === "audio" ? "is-active" : ""} onClick={() => setDefault("audio")}><Music2 size={15} /> Audio</button>
          </div>
        </div>

        <div className="settings-card static-setting">
          <div className="settings-icon"><ShieldCheck size={20} /></div>
          <div><strong>Privacy</strong><p>No login. No database. Media files are processed temporarily and returned to your browser.</p></div>
        </div>
        <div className="settings-card static-setting">
          <div className="settings-icon"><Database size={20} /></div>
          <div><strong>History storage</strong><p>History is stored in localStorage on this device only and can be cleared at any time.</p></div>
        </div>
      </div>
    </section>
  );
}
