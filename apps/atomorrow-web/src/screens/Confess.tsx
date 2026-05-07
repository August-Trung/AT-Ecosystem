import { AlertTriangle, Eye, LockKeyhole, Radio, Save, Sparkles } from "lucide-react";
import { moodOptions } from "../data/stories";
import { stations } from "../data/stations";
import type { ConfessionDestination, MoodOption, PrivateConfession, StationId } from "../types";
import { isConfessionSubmittable, moderateConfession } from "../utils/moderation";

interface ConfessProps {
  text: string;
  mood: MoodOption;
  destination: ConfessionDestination;
  station: StationId;
  onTextChange: (value: string) => void;
  onMoodChange: (value: MoodOption) => void;
  onDestinationChange: (value: ConfessionDestination) => void;
  onStationChange: (value: StationId) => void;
  isSubmitting: boolean;
  onSubmit: (confession: PrivateConfession) => void | Promise<void>;
}

const destinations: ConfessionDestination[] = ["Publish to Voices", "Keep private", "Turn into a story"];

const makePreviewTitle = (mood: MoodOption) => {
  if (mood === "I miss someone") return "A Message Left In The Rain";
  if (mood === "I can't sleep") return "Awake With The Lights Off";
  if (mood === "I feel empty") return "Room Tone For One Person";
  if (mood === "I need a strange story") return "The Confession That Changed Frequency";
  if (mood === "I want to disappear for 10 minutes") return "Ten Minutes Under Another Name";
  return "A Small Ending Before Morning";
};

export function Confess({
  text,
  mood,
  destination,
  station,
  onTextChange,
  onMoodChange,
  onDestinationChange,
  onStationChange,
  isSubmitting,
  onSubmit
}: ConfessProps) {
  const moderation = moderateConfession(text);
  const previewText = moderation.sanitizedText || "The room is waiting for an anonymous voice.";
  const canSubmit = isConfessionSubmittable(text, moderation);
  const selectedStation = stations.find((item) => item.id === station) ?? stations[0];

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    await onSubmit({
      id: `confession-${Date.now()}`,
      text: moderation.sanitizedText,
      mood,
      destination,
      station,
      previewTitle: makePreviewTitle(mood),
      createdAt: new Date().toISOString(),
      moderationFlags: moderation.flags
    });
  };

  return (
    <section className="confess-layout">
      <div className="section-heading">
        <p className="eyebrow">Confess</p>
        <h1>Leave an anonymous signal</h1>
        <p>No real names, phone numbers, addresses, social handles, or identifying details before publishing.</p>
      </div>

      <div className="confess-grid">
        <div className="confess-form">
          <label className="textarea-field">
            <span>Your confession</span>
            <textarea
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              maxLength={1200}
              placeholder="Write the version you would only say after midnight..."
            />
          </label>
          <div className="form-row">
            <label>
              <span>Mood</span>
              <select value={mood} onChange={(event) => onMoodChange(event.target.value as MoodOption)}>
                {moodOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Station</span>
              <select value={station} onChange={(event) => onStationChange(event.target.value as StationId)}>
                {stations.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Destination</legend>
            <div className="destination-grid">
              {destinations.map((item) => (
                <label key={item} className={destination === item ? "radio-card is-active" : "radio-card"}>
                  <input
                    type="radio"
                    name="destination"
                    value={item}
                    checked={destination === item}
                    onChange={() => onDestinationChange(item)}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={`moderation-note moderation-note--${moderation.status}`}>
            {moderation.status === "crisis" ? <AlertTriangle size={18} /> : <LockKeyhole size={18} />}
            <span>{moderation.message}</span>
          </div>

          <div className="privacy-card">
            <LockKeyhole size={18} />
            <p>
              MVP drafts stay in this browser's local storage. Publishing is simulated and should pass human moderation before any public release.
            </p>
          </div>

          <button type="button" className="primary-button submit-button" disabled={!canSubmit || isSubmitting} onClick={handleSubmit}>
            <Save size={17} />
            {isSubmitting ? "Saving..." : "Save confession"}
          </button>
        </div>

        <aside className="confession-preview" style={{ "--station-accent": selectedStation.accent } as React.CSSProperties}>
          <div className="panel-header">
            <span><Radio size={15} /> {selectedStation.name}</span>
            <span>Preview</span>
          </div>
          <h2>{makePreviewTitle(mood)}</h2>
          <p className="preview-narrator">Anonymous caller, processed through a late-night narrator mix</p>
          <blockquote>{previewText}</blockquote>
          <div className="preview-actions">
            <span><Eye size={15} /> human review</span>
            <span><Sparkles size={15} /> cinematic card ready</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
