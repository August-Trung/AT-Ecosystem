import type { LocalArchiveState } from "../types";

const STORAGE_KEY = "another-tomorrow.archive.v1";

export const defaultArchiveState: LocalArchiveState = {
  saved: [],
  privateConfessions: [],
  recentlyPlayed: [],
  hiddenContent: []
};

const canUseStorage = () => typeof window !== "undefined" && "localStorage" in window;

export const readArchiveState = (): LocalArchiveState => {
  if (!canUseStorage()) return defaultArchiveState;

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) return defaultArchiveState;
    const parsed = JSON.parse(rawValue) as Partial<LocalArchiveState>;

    return {
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      privateConfessions: Array.isArray(parsed.privateConfessions) ? parsed.privateConfessions : [],
      recentlyPlayed: Array.isArray(parsed.recentlyPlayed) ? parsed.recentlyPlayed : [],
      hiddenContent: Array.isArray(parsed.hiddenContent) ? parsed.hiddenContent : []
    };
  } catch {
    return defaultArchiveState;
  }
};

export const writeArchiveState = (state: LocalArchiveState) => {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can fail in private windows or constrained WebViews. The app keeps running in memory.
  }
};
