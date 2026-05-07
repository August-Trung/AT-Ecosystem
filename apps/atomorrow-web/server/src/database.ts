import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nightStories } from "../../src/data/stories.js";
import { stations } from "../../src/data/stations.js";
import { voiceEpisodes } from "../../src/data/voices.js";

export type AppDatabase = Database.Database;

const dirname = path.dirname(fileURLToPath(import.meta.url));

const findProjectRoot = () => {
  let current = dirname;

  for (let depth = 0; depth < 8; depth += 1) {
    if (fs.existsSync(path.join(current, "server", "migrations"))) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.resolve(dirname, "../..");
};

const projectRoot = findProjectRoot();
const defaultDbPath = path.join(projectRoot, "data", "another-tomorrow.sqlite");

export const resolveDbPath = () => {
  const configuredPath = process.env.SQLITE_PATH || process.env.DATABASE_URL;
  if (!configuredPath) return defaultDbPath;
  if (configuredPath.startsWith("file:")) return configuredPath.slice("file:".length);
  return configuredPath;
};

export const openDatabase = (dbPath = resolveDbPath()) => {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  applyMigrations(db);
  seedCatalog(db);
  return db;
};

const applyMigrations = (db: AppDatabase) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.resolve(projectRoot, "server", "migrations");
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  const hasMigration = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?").pluck();
  const markMigration = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  for (const file of migrationFiles) {
    const version = path.basename(file, ".sql");
    if (hasMigration.get(version)) continue;

    const migrationSql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.transaction(() => {
      db.exec(migrationSql);
      markMigration.run(version, new Date().toISOString());
    })();
  }
};

const seedCatalog = (db: AppDatabase) => {
  const insertStation = db.prepare(`
    INSERT INTO stations (id, name, signal, accent, description)
    VALUES (@id, @name, @signal, @accent, @description)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      signal = excluded.signal,
      accent = excluded.accent,
      description = excluded.description
  `);

  const insertEpisode = db.prepare(`
    INSERT INTO voice_episodes (
      id, title, mood, station_id, duration, audio_url, transcript, narrator_label, safety_rating, created_at
    )
    VALUES (
      @id, @title, @mood, @station, @duration, @audioUrl, @transcript, @narratorLabel, @safetyRating, @createdAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      mood = excluded.mood,
      station_id = excluded.station_id,
      duration = excluded.duration,
      audio_url = excluded.audio_url,
      transcript = excluded.transcript,
      narrator_label = excluded.narrator_label,
      safety_rating = excluded.safety_rating,
      created_at = excluded.created_at
  `);

  const insertStory = db.prepare(`
    INSERT INTO night_stories (
      id, title, mood, estimated_duration, intro, full_text, station_id, locked
    )
    VALUES (
      @id, @title, @mood, @estimatedDuration, @intro, @fullText, @station, @locked
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      mood = excluded.mood,
      estimated_duration = excluded.estimated_duration,
      intro = excluded.intro,
      full_text = excluded.full_text,
      station_id = excluded.station_id,
      locked = excluded.locked
  `);

  const transaction = db.transaction(() => {
    for (const station of stations) insertStation.run(station);
    for (const episode of voiceEpisodes) insertEpisode.run({ ...episode, audioUrl: episode.audioUrl ?? null });
    for (const story of nightStories) insertStory.run({ ...story, locked: story.locked ? 1 : 0 });
  });

  transaction();
};

export const checkDatabaseHealth = (db: AppDatabase) => {
  try {
    return db.pragma("quick_check", { simple: true }) === "ok";
  } catch {
    return false;
  }
};

export const closeDatabase = (db: AppDatabase) => {
  try {
    db.pragma("optimize");
  } finally {
    db.close();
  }
};
