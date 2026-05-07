import { Bookmark, Heart, Radio, Signal, Users } from "lucide-react";
import { StationVisual } from "../components/StationVisual";
import { PlayerControls } from "../components/PlayerControls";
import { stations } from "../data/stations";
import type { StationId, VoiceEpisode } from "../types";
import { formatDate } from "../utils/format";

interface TonightProps {
  episode: VoiceEpisode;
  stationId: StationId;
  isPlaying: boolean;
  progress: number;
  duration: number;
  reactions: Record<string, number>;
  saved: boolean;
  onStationChange: (stationId: StationId) => void;
  onTogglePlay: () => void;
  onReact: (reaction: string) => void;
  onSave: () => void;
}

export function Tonight({
  episode,
  stationId,
  isPlaying,
  progress,
  duration,
  reactions,
  saved,
  onStationChange,
  onTogglePlay,
  onReact,
  onSave
}: TonightProps) {
  const activeStation = stations.find((station) => station.id === stationId) ?? stations[0];

  return (
    <section className="tonight-screen">
      <div className="hero-player" style={{ "--station-accent": activeStation.accent } as React.CSSProperties}>
        <StationVisual station={stationId} isPlaying={isPlaying} />
        <div className="hero-player__content">
          <div className="station-kicker">
            <Signal size={16} />
            <span>{activeStation.signal}</span>
            <span>{isPlaying ? "Live after midnight" : "Signal standing by"}</span>
          </div>
          <div className="broadcast-grid">
            <div className="broadcast-main">
              <p className="eyebrow">Tonight on {activeStation.name}</p>
              <h1>{episode.title}</h1>
              <p className="secondary-line">Anonymous voices. Night stories. Another tomorrow.</p>
              <PlayerControls
                isPlaying={isPlaying}
                progress={progress}
                duration={duration}
                onToggle={onTogglePlay}
              />
              <div className="reaction-row" aria-label="Reactions">
                <button type="button" onClick={() => onReact("felt")}>
                  <Heart size={16} />
                  I felt this
                  <span>{reactions.felt ?? 0}</span>
                </button>
                <button type="button" onClick={() => onReact("here")}>
                  <Users size={16} />
                  I was here too
                  <span>{reactions.here ?? 0}</span>
                </button>
                <button type="button" onClick={onSave}>
                  <Bookmark size={16} />
                  {saved ? "Saved" : "Save this"}
                </button>
              </div>
            </div>
            <aside className="broadcast-panel" aria-label="Current anonymous voice transcript">
              <div className="panel-header">
                <span>{episode.narratorLabel}</span>
                <span>{formatDate(episode.createdAt)}</span>
              </div>
              <p className="transcript">{episode.transcript}</p>
              <div className="tag-row">
                <span>{episode.mood}</span>
                <span>{episode.safetyRating}</span>
                <span>{activeStation.name}</span>
              </div>
              <p className="safety-copy">
                Emotional entertainment, not therapy or medical care. For immediate danger or self-harm risk, contact local emergency services or a crisis line now.
              </p>
            </aside>
          </div>
        </div>
      </div>

      <section className="station-selector" aria-labelledby="station-selector-title">
        <div>
          <p className="eyebrow" id="station-selector-title">Station selector</p>
          <h2>Choose tonight's room</h2>
        </div>
        <div className="station-grid">
          {stations.map((station) => (
            <button
              key={station.id}
              type="button"
              className={station.id === stationId ? "station-card is-active" : "station-card"}
              style={{ "--station-accent": station.accent } as React.CSSProperties}
              onClick={() => onStationChange(station.id)}
            >
              <Radio size={18} />
              <span>
                <strong>{station.name}</strong>
                <small>{station.description}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
