PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  signal TEXT NOT NULL,
  accent TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_episodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mood TEXT NOT NULL,
  station_id TEXT NOT NULL REFERENCES stations(id),
  duration INTEGER NOT NULL CHECK (duration > 0),
  transcript TEXT NOT NULL,
  narrator_label TEXT NOT NULL,
  safety_rating TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS night_stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mood TEXT NOT NULL,
  estimated_duration INTEGER NOT NULL CHECK (estimated_duration > 0),
  intro TEXT NOT NULL,
  full_text TEXT NOT NULL,
  station_id TEXT NOT NULL REFERENCES stations(id),
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1))
);

CREATE TABLE IF NOT EXISTS confessions (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  mood TEXT NOT NULL,
  destination TEXT NOT NULL,
  station_id TEXT NOT NULL REFERENCES stations(id),
  preview_title TEXT NOT NULL,
  moderation_status TEXT NOT NULL,
  moderation_flags TEXT NOT NULL DEFAULT '[]',
  publish_status TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  anonymous_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('episode', 'story')),
  saved_at TEXT NOT NULL,
  UNIQUE (anonymous_user_id, item_id, item_type)
);

CREATE TABLE IF NOT EXISTS recently_played (
  id TEXT PRIMARY KEY,
  anonymous_user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('episode', 'story')),
  played_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_voice_episodes_station ON voice_episodes(station_id);
CREATE INDEX IF NOT EXISTS idx_voice_episodes_mood ON voice_episodes(mood);
CREATE INDEX IF NOT EXISTS idx_night_stories_station ON night_stories(station_id);
CREATE INDEX IF NOT EXISTS idx_night_stories_mood ON night_stories(mood);
CREATE INDEX IF NOT EXISTS idx_confessions_created_at ON confessions(created_at);
CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_recently_played_user ON recently_played(anonymous_user_id);
