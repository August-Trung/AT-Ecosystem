import { moodOptions } from "../../src/data/stories.js";
import { stations } from "../../src/data/stations.js";
import type { ArchiveItemType, ConfessionDestination, MoodOption, StationId } from "../../src/types.js";

export const confessionDestinations: ConfessionDestination[] = [
  "Publish to Voices",
  "Keep private",
  "Turn into a story"
];

const stationIds = new Set(stations.map((station) => station.id));
const moodSet = new Set<string>(moodOptions);
const destinationSet = new Set<string>(confessionDestinations);
const archiveItemTypes = new Set<string>(["episode", "story"]);
const anonymousUserPattern = /^[a-zA-Z0-9._:-]{8,128}$/;
const contentIdPattern = /^[a-zA-Z0-9._:-]{3,128}$/;

export interface ConfessionInput {
  text: string;
  mood: MoodOption;
  destination: ConfessionDestination;
  station: StationId;
}

export interface ArchiveItemInput {
  anonymousUserId: string;
  itemId: string;
  itemType: ArchiveItemType;
}

export const validateConfessionInput = (
  body: unknown
): { ok: true; value: ConfessionInput } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be an object." };
  }

  const candidate = body as Record<string, unknown>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const mood = candidate.mood;
  const destination = candidate.destination;
  const station = candidate.station;

  if (text.length < 20 || text.length > 1200) {
    return { ok: false, error: "Confession text must be between 20 and 1200 characters." };
  }

  if (typeof mood !== "string" || !moodSet.has(mood)) {
    return { ok: false, error: "Mood is not supported." };
  }

  if (typeof destination !== "string" || !destinationSet.has(destination)) {
    return { ok: false, error: "Destination is not supported." };
  }

  if (typeof station !== "string" || !stationIds.has(station as StationId)) {
    return { ok: false, error: "Station is not supported." };
  }

  return {
    ok: true,
    value: {
      text,
      mood: mood as MoodOption,
      destination: destination as ConfessionDestination,
      station: station as StationId
    }
  };
};

export const validateAnonymousUserId = (
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } => {
  if (typeof value !== "string" || !anonymousUserPattern.test(value)) {
    return { ok: false, error: "Anonymous user id is not valid." };
  }

  return { ok: true, value };
};

export const validateArchiveItemInput = (
  body: unknown
): { ok: true; value: ArchiveItemInput } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be an object." };
  }

  const candidate = body as Record<string, unknown>;
  const anonymousUser = validateAnonymousUserId(candidate.anonymousUserId);
  if (!anonymousUser.ok) return anonymousUser;

  if (typeof candidate.itemId !== "string" || !contentIdPattern.test(candidate.itemId)) {
    return { ok: false, error: "Archive item id is not valid." };
  }

  if (typeof candidate.itemType !== "string" || !archiveItemTypes.has(candidate.itemType)) {
    return { ok: false, error: "Archive item type is not supported." };
  }

  return {
    ok: true,
    value: {
      anonymousUserId: anonymousUser.value,
      itemId: candidate.itemId,
      itemType: candidate.itemType as ArchiveItemType
    }
  };
};
