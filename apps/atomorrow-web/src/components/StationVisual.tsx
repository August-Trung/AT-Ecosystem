import type { StationId } from "../types";

interface StationVisualProps {
  station: StationId;
  isPlaying?: boolean;
}

export function StationVisual({ station, isPlaying = false }: StationVisualProps) {
  return (
    <div className={`station-visual station-visual--${station} ${isPlaying ? "is-playing" : ""}`} aria-hidden="true">
      <div className="station-skyline">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="station-window">
        <span />
        <span />
        <span />
      </div>
      <div className="station-floor" />
      <div className="station-signal">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
