import { Lock, Play, Save } from "lucide-react";
import { StationVisual } from "../components/StationVisual";
import { moodOptions } from "../data/stories";
import { getStationById } from "../data/stations";
import type { MoodOption, NightStory } from "../types";

interface StoriesProps {
  stories: NightStory[];
  selectedMood: MoodOption | "All";
  selectedStory: NightStory;
  isSaved: (story: NightStory) => boolean;
  onMoodChange: (mood: MoodOption | "All") => void;
  onSelectStory: (story: NightStory) => void;
  onSave: (story: NightStory) => void;
}

export function Stories({
  stories,
  selectedMood,
  selectedStory,
  isSaved,
  onMoodChange,
  onSelectStory,
  onSave
}: StoriesProps) {
  const activeStation = getStationById(selectedStory.station);

  return (
    <section className="stories-layout">
      <div className="section-heading">
        <p className="eyebrow">Stories</p>
        <h1>Night Shift Stories</h1>
        <p>Short atmospheric fiction for reading, listening, or staying somewhere else for a few minutes.</p>
      </div>

      <div className="story-player" style={{ "--station-accent": activeStation.accent } as React.CSSProperties}>
        <StationVisual station={selectedStory.station} isPlaying />
        <div className="story-player__text">
          <div className="episode-card__meta">
            <span>{activeStation.name}</span>
            <span>{selectedStory.estimatedDuration} min</span>
            <span>{selectedStory.locked ? "Premium" : "Free"}</span>
          </div>
          <h2>{selectedStory.title}</h2>
          <p className="story-intro">{selectedStory.intro}</p>
          <p>{selectedStory.fullText}</p>
          <div className="story-player__actions">
            <button type="button" className="primary-button">
              {selectedStory.locked ? <Lock size={16} /> : <Play size={16} fill="currentColor" />}
              {selectedStory.locked ? "Preview locked story" : "Listen"}
            </button>
            <button type="button" className="ghost-button" onClick={() => onSave(selectedStory)}>
              <Save size={16} />
              {isSaved(selectedStory) ? "Saved" : "Save story"}
            </button>
          </div>
        </div>
      </div>

      <div className="story-filter">
        <span>Mood</span>
        <div className="chip-scroll" role="list" aria-label="Story mood filters">
          <button type="button" className={selectedMood === "All" ? "chip is-active" : "chip"} onClick={() => onMoodChange("All")}>
            All
          </button>
          {moodOptions.map((mood) => (
            <button
              key={mood}
              type="button"
              className={selectedMood === mood ? "chip is-active" : "chip"}
              onClick={() => onMoodChange(mood)}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      <div className="story-grid">
        {stories.map((story) => {
          const station = getStationById(story.station);
          return (
            <button
              type="button"
              key={story.id}
              className={selectedStory.id === story.id ? "story-card is-active" : "story-card"}
              onClick={() => onSelectStory(story)}
              style={{ "--station-accent": station.accent } as React.CSSProperties}
            >
              <span className="episode-card__meta">
                <span>{station.name}</span>
                <span>{story.estimatedDuration} min</span>
                {story.locked && <Lock size={14} />}
              </span>
              <strong>{story.title}</strong>
              <span>{story.intro}</span>
              <span className="story-card__mood">{story.mood}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
