import { EyeOff, Flag, Heart, Save } from "lucide-react";

interface ContentActionsProps {
  saved: boolean;
  onSave: () => void;
  onReport?: () => void;
  onHide?: () => void;
  compact?: boolean;
}

export function ContentActions({ saved, onSave, onReport, onHide, compact = false }: ContentActionsProps) {
  return (
    <div className={compact ? "content-actions content-actions--compact" : "content-actions"}>
      <button type="button" className="ghost-button" onClick={onSave}>
        <Save size={16} />
        {saved ? "Saved" : "Save this"}
      </button>
      <button type="button" className="ghost-button" onClick={onReport}>
        <Flag size={16} />
        Report
      </button>
      <button type="button" className="icon-button" onClick={onHide} aria-label="Hide this content" title="Hide">
        <EyeOff size={16} />
      </button>
      {!compact && (
        <span className="passive-reaction">
          <Heart size={15} />
          softly held
        </span>
      )}
    </div>
  );
}
