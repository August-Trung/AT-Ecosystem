import { Pause, Play } from "lucide-react";
import { formatDuration } from "../utils/format";

interface PlayerControlsProps {
  isPlaying: boolean;
  progress: number;
  duration: number;
  onToggle: () => void;
}

export function PlayerControls({ isPlaying, progress, duration, onToggle }: PlayerControlsProps) {
  const percent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  return (
    <div className="player-controls">
      <button
        type="button"
        className="play-button"
        onClick={onToggle}
        aria-label={isPlaying ? "Pause current broadcast" : "Play current broadcast"}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={34} fill="currentColor" /> : <Play size={34} fill="currentColor" />}
      </button>
      <div className="progress-wrap" aria-label="Playback progress">
        <div className="progress-meta">
          <span>{formatDuration(progress)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
        <div className="progress-bar" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}
