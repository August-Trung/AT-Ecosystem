import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { voiceEpisodes } from "./data/voices";
import { nightStories } from "./data/stories";
import { useLocalArchive } from "./hooks/useLocalArchive";
import { Archive } from "./screens/Archive";
import { Confess } from "./screens/Confess";
import { Premium } from "./screens/Premium";
import { Stories } from "./screens/Stories";
import { Tonight } from "./screens/Tonight";
import { Voices } from "./screens/Voices";
import {
  markRecentlyPlayedInApi,
  removeSavedArchiveItemFromApi,
  saveArchiveItemToApi,
  submitConfessionToApi
} from "./services/api";
import type { ConfessionDestination, MoodOption, NightStory, StationId, ViewId, VoiceEpisode } from "./types";

const defaultMood: MoodOption = "I can't sleep";
const viewIds: ViewId[] = ["tonight", "voices", "stories", "confess", "archive", "premium"];

const readHashView = (): ViewId => {
  if (typeof window === "undefined") return "tonight";
  const hash = window.location.hash.replace("#", "");
  return viewIds.includes(hash as ViewId) ? (hash as ViewId) : "tonight";
};

function App() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeView, setActiveView] = useState<ViewId>(readHashView);
  const [stationId, setStationId] = useState<StationId>("rain-city");
  const [currentEpisodeId, setCurrentEpisodeId] = useState("voice-001");
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(38);
  const [reactions, setReactions] = useState<Record<string, number>>({ felt: 128, here: 64 });
  const [voiceMood, setVoiceMood] = useState<MoodOption | "All">("All");
  const [voiceStation, setVoiceStation] = useState<StationId | "All">("All");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [storyMood, setStoryMood] = useState<MoodOption | "All">("All");
  const [selectedStoryId, setSelectedStoryId] = useState("story-001");
  const [confessionText, setConfessionText] = useState("");
  const [confessionMood, setConfessionMood] = useState<MoodOption>(defaultMood);
  const [confessionDestination, setConfessionDestination] = useState<ConfessionDestination>("Keep private");
  const [confessionStation, setConfessionStation] = useState<StationId>("almost-tomorrow");
  const [isSubmittingConfession, setIsSubmittingConfession] = useState(false);
  const [archiveMood, setArchiveMood] = useState<MoodOption | "All">("All");
  const [archiveStation, setArchiveStation] = useState<StationId | "All">("All");
  const [audioDuration, setAudioDuration] = useState(0);

  const {
    archive,
    isSaved,
    toggleSaved,
    addRecentlyPlayed,
    addPrivateConfession,
    hideContent
  } = useLocalArchive();

  const navigate = (view: ViewId) => {
    setActiveView(view);
    if (typeof window !== "undefined" && window.location.hash !== `#${view}`) {
      window.history.pushState(null, "", `#${view}`);
    }
  };

  const currentEpisode = useMemo(() => {
    const stationEpisode = voiceEpisodes.find((episode) => episode.station === stationId);
    return voiceEpisodes.find((episode) => episode.id === currentEpisodeId) ?? stationEpisode ?? voiceEpisodes[0];
  }, [currentEpisodeId, stationId]);

  const filteredVoices = useMemo(() => {
    const query = voiceSearch.trim().toLowerCase();
    return voiceEpisodes.filter((episode) => {
      const hidden = archive.hiddenContent.includes(episode.id);
      const moodMatches = voiceMood === "All" || episode.mood === voiceMood;
      const stationMatches = voiceStation === "All" || episode.station === voiceStation;
      const queryMatches =
        query.length === 0 ||
        episode.title.toLowerCase().includes(query) ||
        episode.transcript.toLowerCase().includes(query) ||
        episode.mood.toLowerCase().includes(query);
      return !hidden && moodMatches && stationMatches && queryMatches;
    });
  }, [archive.hiddenContent, voiceMood, voiceSearch, voiceStation]);

  const filteredStories = useMemo(
    () => nightStories.filter((story) => storyMood === "All" || story.mood === storyMood),
    [storyMood]
  );

  const selectedStory = nightStories.find((story) => story.id === selectedStoryId) ?? nightStories[0];
  const playbackDuration = currentEpisode.audioUrl && audioDuration > 0
    ? Math.round(audioDuration)
    : currentEpisode.duration;

  useEffect(() => {
    const stationEpisode = voiceEpisodes.find((episode) => episode.station === stationId);
    if (stationEpisode) {
      setCurrentEpisodeId(stationEpisode.id);
      setProgress(stationEpisode.audioUrl ? 0 : Math.min(38, stationEpisode.duration));
      setAudioDuration(0);
    }
  }, [stationId]);

  useEffect(() => {
    if (!isPlaying || currentEpisode.audioUrl) return;
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= playbackDuration) return 0;
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentEpisode.audioUrl, isPlaying, playbackDuration]);

  useEffect(() => {
    if (!currentEpisode.audioUrl) return;
    setAudioDuration(0);
    setProgress(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [currentEpisode.audioUrl, currentEpisode.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentEpisode.audioUrl) return;

    if (!isPlaying) {
      audio.pause();
      return;
    }

    void audio.play().catch(() => setIsPlaying(false));
  }, [currentEpisode.audioUrl, currentEpisode.id, isPlaying]);

  useEffect(() => {
    const handleHashChange = () => setActiveView(readHashView());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const playEpisode = (episode: VoiceEpisode) => {
    setCurrentEpisodeId(episode.id);
    setStationId(episode.station);
    setProgress(0);
    setIsPlaying(true);
    navigate("tonight");
    addRecentlyPlayed(episode.id, "episode");
    void markRecentlyPlayedInApi(episode.id, "episode");
  };

  const selectStory = (story: NightStory) => {
    setSelectedStoryId(story.id);
    addRecentlyPlayed(story.id, "story");
    void markRecentlyPlayedInApi(story.id, "story");
  };

  const toggleSavedEverywhere = (id: string, type: "episode" | "story") => {
    const currentlySaved = isSaved(id, type);
    toggleSaved(id, type);

    if (currentlySaved) {
      void removeSavedArchiveItemFromApi(id, type);
      return;
    }

    void saveArchiveItemToApi(id, type);
  };

  return (
    <>
      {currentEpisode.audioUrl && (
        <audio
          ref={audioRef}
          src={currentEpisode.audioUrl}
          preload="metadata"
          onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration)}
          onTimeUpdate={(event) => setProgress(Math.floor(event.currentTarget.currentTime))}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
          }}
        />
      )}
      <AppShell activeView={activeView} onNavigate={navigate}>
      {activeView === "tonight" && (
        <Tonight
          episode={currentEpisode}
          stationId={stationId}
          isPlaying={isPlaying}
          progress={progress}
          duration={playbackDuration}
          reactions={reactions}
          saved={isSaved(currentEpisode.id, "episode")}
          onStationChange={setStationId}
          onTogglePlay={() => {
            setIsPlaying((current) => !current);
            addRecentlyPlayed(currentEpisode.id, "episode");
            void markRecentlyPlayedInApi(currentEpisode.id, "episode");
          }}
          onReact={(reaction) => setReactions((current) => ({ ...current, [reaction]: (current[reaction] ?? 0) + 1 }))}
          onSave={() => toggleSavedEverywhere(currentEpisode.id, "episode")}
        />
      )}
      {activeView === "voices" && (
        <Voices
          episodes={filteredVoices}
          selectedMood={voiceMood}
          selectedStation={voiceStation}
          searchQuery={voiceSearch}
          onMoodChange={setVoiceMood}
          onStationChange={setVoiceStation}
          onSearchChange={setVoiceSearch}
          onPlay={playEpisode}
          onSave={(episode) => toggleSavedEverywhere(episode.id, "episode")}
          onHide={(episode) => hideContent(episode.id)}
          isSaved={(episode) => isSaved(episode.id, "episode")}
        />
      )}
      {activeView === "stories" && (
        <Stories
          stories={filteredStories}
          selectedMood={storyMood}
          selectedStory={selectedStory}
          isSaved={(story) => isSaved(story.id, "story")}
          onMoodChange={setStoryMood}
          onSelectStory={selectStory}
          onSave={(story) => toggleSavedEverywhere(story.id, "story")}
        />
      )}
      {activeView === "confess" && (
        <Confess
          text={confessionText}
          mood={confessionMood}
          destination={confessionDestination}
          station={confessionStation}
          onTextChange={setConfessionText}
          onMoodChange={setConfessionMood}
          onDestinationChange={setConfessionDestination}
          onStationChange={setConfessionStation}
          isSubmitting={isSubmittingConfession}
          onSubmit={async (confession) => {
            setIsSubmittingConfession(true);
            const remote = await submitConfessionToApi(confession);
            addPrivateConfession({
              ...confession,
              remoteId: remote?.id,
              publishStatus: remote?.publishStatus,
              moderationFlags: remote?.moderationFlags ?? confession.moderationFlags
            });
            setIsSubmittingConfession(false);
            setConfessionText("");
            navigate("archive");
          }}
        />
      )}
      {activeView === "archive" && (
        <Archive
          archive={archive}
          episodes={voiceEpisodes}
          stories={nightStories}
          selectedMood={archiveMood}
          selectedStation={archiveStation}
          onMoodChange={setArchiveMood}
          onStationChange={setArchiveStation}
        />
      )}
      {activeView === "premium" && <Premium />}
      </AppShell>
    </>
  );
}

export default App;
