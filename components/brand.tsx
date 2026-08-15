import { Download } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="ClipTap">
      <span className="brand-mark" aria-hidden="true"><Download size={compact ? 18 : 21} strokeWidth={2.6} /></span>
      <span className="brand-name"><strong>Clip</strong><span>Tap</span></span>
    </div>
  );
}
