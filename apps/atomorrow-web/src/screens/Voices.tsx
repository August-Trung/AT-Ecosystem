import { Play, Search } from "lucide-react";
import { ContentActions } from "../components/ContentActions";
import { stations } from "../data/stations";
import { moodOptions } from "../data/stories";
import type { MoodOption, StationId, VoiceEpisode } from "../types";
import { formatDate, formatDuration } from "../utils/format";

interface VoicesProps {
  episodes: VoiceEpisode[];
  selectedMood: MoodOption | "All";
  selectedStation: StationId | "All";
  searchQuery: string;
  onMoodChange: (mood: MoodOption | "All") => void;
  onStationChange: (station: StationId | "All") => void;
  onSearchChange: (query: string) => void;
  onPlay: (episode: VoiceEpisode) => void;
  onSave: (episode: VoiceEpisode) => void;
  onHide: (episode: VoiceEpisode) => void;
  isSaved: (episode: VoiceEpisode) => boolean;
}

export function Voices({
  episodes,
  selectedMood,
  selectedStation,
  searchQuery,
  onMoodChange,
  onStationChange,
  onSearchChange,
  onPlay,
  onSave,
  onHide,
  isSaved
}: VoicesProps) {
  return (
    <section className="screen-stack">
      <div className="section-heading">
        <p className="eyebrow">Voices</p>
        <h1>Anonymous transmissions</h1>
        <p>Browse short late-night voice episodes from people who left a feeling on the line.</p>
      </div>

      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <span className="sr-only">Search voices</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, mood, transcript"
          />
        </label>
        <label>
          <span>Mood</span>
          <select value={selectedMood} onChange={(event) => onMoodChange(event.target.value as MoodOption | "All")}>
            <option value="All">All moods</option>
            {moodOptions.map((mood) => (
              <option key={mood} value={mood}>{mood}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Station</span>
          <select value={selectedStation} onChange={(event) => onStationChange(event.target.value as StationId | "All")}>
            <option value="All">All stations</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="voice-list" aria-live="polite">
        {episodes.length === 0 ? (
          <div className="empty-state">
            <h2>No signal found</h2>
            <p>Try a different mood or station. The archive is quiet on this frequency.</p>
          </div>
        ) : (
          episodes.map((episode) => {
            const station = stations.find((item) => item.id === episode.station);
            return (
              <article key={episode.id} className="episode-card" style={{ "--station-accent": station?.accent ?? "#39d4d8" } as React.CSSProperties}>
                <div className="episode-card__meta">
                  <span>{station?.name}</span>
                  <span>{formatDuration(episode.duration)}</span>
                  <span>{formatDate(episode.createdAt)}</span>
                </div>
                <h2>{episode.title}</h2>
                <p>{episode.transcript}</p>
                <div className="tag-row">
                  <span>{episode.mood}</span>
                  <span>{episode.narratorLabel}</span>
                  <span>{episode.safetyRating}</span>
                </div>
                <div className="episode-card__footer">
                  <button type="button" className="primary-button" onClick={() => onPlay(episode)}>
                    <Play size={16} fill="currentColor" />
                    Play on Tonight
                  </button>
                  <ContentActions
                    saved={isSaved(episode)}
                    onSave={() => onSave(episode)}
                    onReport={() => onHide(episode)}
                    onHide={() => onHide(episode)}
                    compact
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
