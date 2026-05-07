import type { AppDatabase } from "./database.js";
import type { ArchiveItemType, ConfessionDestination, MoodOption, StationId } from "../../src/types.js";

export interface CreateConfessionRecord {
  id: string;
  text: string;
  mood: MoodOption;
  destination: ConfessionDestination;
  station: StationId;
  previewTitle: string;
  moderationStatus: string;
  moderationFlags: string[];
  publishStatus: string;
  createdAt: string;
}

export const catalogItemExists = (db: AppDatabase, itemId: string, itemType: ArchiveItemType) => {
  const table = itemType === "episode" ? "voice_episodes" : "night_stories";
  return Boolean(db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).pluck().get(itemId));
};

export const getCatalog = (db: AppDatabase) => {
  const stations = db.prepare("SELECT id, name, signal, accent, description FROM stations ORDER BY rowid").all();
  const episodes = db.prepare(`
    SELECT
      id,
      title,
      mood,
      station_id AS station,
      duration,
      audio_url AS audioUrl,
      transcript,
      narrator_label AS narratorLabel,
      safety_rating AS safetyRating,
      created_at AS createdAt
    FROM voice_episodes
    ORDER BY created_at DESC
  `).all();
  const stories = (db.prepare(`
    SELECT
      id,
      title,
      mood,
      estimated_duration AS estimatedDuration,
      intro,
      full_text AS fullText,
      station_id AS station,
      locked
    FROM night_stories
    ORDER BY rowid
  `).all() as Array<Record<string, unknown> & { locked: number }>).map((story) => ({
    ...story,
    locked: Boolean(story.locked)
  }));

  return { stations, episodes, stories };
};

export const createConfession = (db: AppDatabase, record: CreateConfessionRecord) => {
  db.prepare(`
    INSERT INTO confessions (
      id, text, mood, destination, station_id, preview_title, moderation_status,
      moderation_flags, publish_status, created_at
    )
    VALUES (
      @id, @text, @mood, @destination, @station, @previewTitle, @moderationStatus,
      @moderationFlagsJson, @publishStatus, @createdAt
    )
  `).run({
    ...record,
    moderationFlagsJson: JSON.stringify(record.moderationFlags)
  });

  return record;
};

export const listConfessions = (db: AppDatabase) =>
  (db.prepare(`
    SELECT
      id,
      text,
      mood,
      destination,
      station_id AS station,
      preview_title AS previewTitle,
      moderation_status AS moderationStatus,
      moderation_flags AS moderationFlags,
      publish_status AS publishStatus,
      created_at AS createdAt
    FROM confessions
    ORDER BY created_at DESC
    LIMIT 100
  `).all() as Array<Record<string, unknown> & { moderationFlags: string }>).map((row) => {
    return { ...row, moderationFlags: JSON.parse(row.moderationFlags) };
  });

export const saveArchiveItem = (
  db: AppDatabase,
  input: { anonymousUserId: string; itemId: string; itemType: ArchiveItemType }
) => {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO saved_items (id, anonymous_user_id, item_id, item_type, saved_at)
    VALUES (@id, @anonymousUserId, @itemId, @itemType, @savedAt)
    ON CONFLICT(anonymous_user_id, item_id, item_type) DO UPDATE SET saved_at = excluded.saved_at
  `).run({ ...input, id, savedAt: now });

  return db.prepare(`
    SELECT
      id,
      anonymous_user_id AS anonymousUserId,
      item_id AS itemId,
      item_type AS itemType,
      saved_at AS savedAt
    FROM saved_items
    WHERE anonymous_user_id = @anonymousUserId AND item_id = @itemId AND item_type = @itemType
  `).get(input);
};

export const deleteSavedArchiveItem = (
  db: AppDatabase,
  input: { anonymousUserId: string; itemId: string; itemType: ArchiveItemType }
) => {
  const result = db.prepare(`
    DELETE FROM saved_items
    WHERE anonymous_user_id = @anonymousUserId AND item_id = @itemId AND item_type = @itemType
  `).run(input);

  return { deleted: result.changes > 0, ...input };
};

export const markRecentlyPlayed = (
  db: AppDatabase,
  input: { anonymousUserId: string; itemId: string; itemType: ArchiveItemType }
) => {
  const now = new Date().toISOString();
  const record = { id: crypto.randomUUID(), ...input, playedAt: now };
  db.prepare(`
    INSERT INTO recently_played (id, anonymous_user_id, item_id, item_type, played_at)
    VALUES (@id, @anonymousUserId, @itemId, @itemType, @playedAt)
    ON CONFLICT(anonymous_user_id, item_id, item_type) DO UPDATE SET played_at = excluded.played_at
  `).run(record);

  return db.prepare(`
    SELECT
      id,
      anonymous_user_id AS anonymousUserId,
      item_id AS itemId,
      item_type AS itemType,
      played_at AS playedAt
    FROM recently_played
    WHERE anonymous_user_id = @anonymousUserId AND item_id = @itemId AND item_type = @itemType
  `).get(input);
};

export const getArchiveForUser = (db: AppDatabase, anonymousUserId: string) => {
  const saved = db.prepare(`
    SELECT item_id AS id, item_type AS type, saved_at AS savedAt
    FROM saved_items
    WHERE anonymous_user_id = ?
    ORDER BY saved_at DESC
  `).all(anonymousUserId);

  const recentlyPlayed = db.prepare(`
    SELECT item_id AS id, item_type AS type, played_at AS playedAt
    FROM recently_played
    WHERE anonymous_user_id = ?
    ORDER BY played_at DESC
    LIMIT 20
  `).all(anonymousUserId);

  return { saved, recentlyPlayed };
};
