export type ViewId = "tonight" | "voices" | "stories" | "confess" | "archive" | "premium";

export type StationId =
  | "rain-city"
  | "last-train"
  | "empty-room"
  | "neon-motel"
  | "ghost-frequency"
  | "almost-tomorrow";

export type MoodOption =
  | "I miss someone"
  | "I can't sleep"
  | "I feel empty"
  | "I need a strange story"
  | "I want to disappear for 10 minutes"
  | "I need a calm ending";

export type SafetyRating = "gentle" | "soft ache" | "heavy but safe";

export interface Station {
  id: StationId;
  name: string;
  signal: string;
  accent: string;
  description: string;
}

export interface VoiceEpisode {
  id: string;
  title: string;
  mood: MoodOption;
  station: StationId;
  duration: number;
  audioUrl?: string;
  transcript: string;
  narratorLabel: string;
  safetyRating: SafetyRating;
  createdAt: string;
}

export interface NightStory {
  id: string;
  title: string;
  mood: MoodOption;
  estimatedDuration: number;
  intro: string;
  fullText: string;
  station: StationId;
  locked: boolean;
}

export type ArchiveItemType = "episode" | "story";

export interface SavedArchiveItem {
  id: string;
  type: ArchiveItemType;
  savedAt: string;
}

export interface RecentlyPlayedItem {
  id: string;
  type: ArchiveItemType;
  playedAt: string;
}

export type ConfessionDestination = "Publish to Voices" | "Keep private" | "Turn into a story";

export interface PrivateConfession {
  id: string;
  remoteId?: string;
  text: string;
  mood: MoodOption;
  destination: ConfessionDestination;
  station: StationId;
  previewTitle: string;
  createdAt: string;
  moderationFlags: string[];
  publishStatus?: "private" | "needs_review" | "story_draft" | "approved" | "hidden";
}

export interface LocalArchiveState {
  saved: SavedArchiveItem[];
  privateConfessions: PrivateConfession[];
  recentlyPlayed: RecentlyPlayedItem[];
  hiddenContent: string[];
}

export type ModerationStatus = "clear" | "needs-review" | "crisis";

export interface ModerationResult {
  status: ModerationStatus;
  flags: string[];
  sanitizedText: string;
  message: string;
}
