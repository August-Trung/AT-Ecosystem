import { Archive as ArchiveIcon, Clock, LockKeyhole, Search } from "lucide-react";
import { getStationById, stations } from "../data/stations";
import { moodOptions } from "../data/stories";
import type { LocalArchiveState, MoodOption, NightStory, StationId, VoiceEpisode } from "../types";
import { formatDate } from "../utils/format";

interface ArchiveProps {
  archive: LocalArchiveState;
  episodes: VoiceEpisode[];
  stories: NightStory[];
  selectedMood: MoodOption | "All";
  selectedStation: StationId | "All";
  onMoodChange: (mood: MoodOption | "All") => void;
  onStationChange: (station: StationId | "All") => void;
}

export function Archive({
  archive,
  episodes,
  stories,
  selectedMood,
  selectedStation,
  onMoodChange,
  onStationChange
}: ArchiveProps) {
  const episodeMap = new Map(episodes.map((episode) => [episode.id, episode]));
  const storyMap = new Map(stories.map((story) => [story.id, story]));

  const savedItems = archive.saved
    .map((item) => {
      const source = item.type === "episode" ? episodeMap.get(item.id) : storyMap.get(item.id);
      if (!source) return null;
      return { ...item, source };
    })
    .filter(Boolean);

  const recentlyPlayed = archive.recentlyPlayed
    .map((item) => {
      const source = item.type === "episode" ? episodeMap.get(item.id) : storyMap.get(item.id);
      if (!source) return null;
      return { ...item, source };
    })
    .filter(Boolean);

  const privateConfessions = archive.privateConfessions.filter((confession) => {
    const moodMatches = selectedMood === "All" || confession.mood === selectedMood;
    const stationMatches = selectedStation === "All" || confession.station === selectedStation;
    return moodMatches && stationMatches;
  });

  const hasArchive = savedItems.length > 0 || privateConfessions.length > 0 || recentlyPlayed.length > 0;

  return (
    <section className="screen-stack">
      <div className="section-heading">
        <p className="eyebrow">Archive</p>
        <h1>Your after-midnight shelf</h1>
        <p>Saved episodes, private confessions, and recently played signals live locally in this MVP.</p>
      </div>

      <div className="filter-bar">
        <div className="search-field search-field--static">
          <Search size={17} />
          <span>Filter local archive</span>
        </div>
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

      {!hasArchive ? (
        <div className="empty-state empty-state--large">
          <ArchiveIcon size={36} />
          <h2>The shelf is still dark</h2>
          <p>Save an episode, read a story, or keep a confession private. The first item will appear here.</p>
        </div>
      ) : (
        <div className="archive-columns">
          <ArchiveColumn title="Saved episodes and stories" icon={<ArchiveIcon size={18} />}>
            {savedItems.length === 0 ? (
              <SmallEmpty text="Nothing saved yet." />
            ) : (
              savedItems.map((item) => {
                const source = item?.source as VoiceEpisode | NightStory;
                return <ArchiveRow key={`${item?.type}-${item?.id}`} title={source.title} meta={`Saved ${formatDate(item?.savedAt ?? "")}`} mood={source.mood} station={getStationById(source.station).name} />;
              })
            )}
          </ArchiveColumn>

          <ArchiveColumn title="Private confessions" icon={<LockKeyhole size={18} />}>
            {privateConfessions.length === 0 ? (
              <SmallEmpty text="No private drafts match this filter." />
            ) : (
              privateConfessions.map((confession) => (
                <ArchiveRow
                  key={confession.id}
                  title={confession.previewTitle}
                  meta={`${confession.destination} - ${formatDate(confession.createdAt)}`}
                  mood={confession.mood}
                  station={getStationById(confession.station).name}
                  body={confession.text}
                />
              ))
            )}
          </ArchiveColumn>

          <ArchiveColumn title="Recently played" icon={<Clock size={18} />}>
            {recentlyPlayed.length === 0 ? (
              <SmallEmpty text="No recent plays yet." />
            ) : (
              recentlyPlayed.map((item) => {
                const source = item?.source as VoiceEpisode | NightStory;
                return <ArchiveRow key={`${item?.type}-${item?.id}`} title={source.title} meta={`Played ${formatDate(item?.playedAt ?? "")}`} mood={source.mood} station={getStationById(source.station).name} />;
              })
            )}
          </ArchiveColumn>
        </div>
      )}
    </section>
  );
}

function ArchiveColumn({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="archive-column">
      <h2>{icon}{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function ArchiveRow({ title, meta, mood, station, body }: { title: string; meta: string; mood: string; station: string; body?: string }) {
  return (
    <article className="archive-row">
      <strong>{title}</strong>
      <span>{meta}</span>
      {body && <p>{body}</p>}
      <div className="tag-row">
        <span>{mood}</span>
        <span>{station}</span>
      </div>
    </article>
  );
}

function SmallEmpty({ text }: { text: string }) {
  return <p className="small-empty">{text}</p>;
}
