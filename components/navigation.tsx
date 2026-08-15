import { Download, History, Settings } from "lucide-react";
import type { AppView } from "@/lib/types";

const ITEMS: Array<{ id: AppView; label: string; icon: typeof Download }> = [
  { id: "downloader", label: "Downloader", icon: Download },
  { id: "history", label: "History", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

export function BottomNav({ active, onChange }: { active: AppView; onChange: (view: AppView) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => onChange(item.id)}>
            <Icon size={21} strokeWidth={2} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Sidebar({ active, onChange }: { active: AppView; onChange: (view: AppView) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand-space" />
      <nav aria-label="Primary navigation">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={active === item.id ? "is-active" : ""} onClick={() => onChange(item.id)}>
              <Icon size={19} strokeWidth={2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sidebar-note">
        <span className="privacy-dot" />
        <strong>Private by design</strong>
        <p>No account or download history is sent to a database.</p>
      </div>
    </aside>
  );
}
