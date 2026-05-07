import type { ArchiveItemType, PrivateConfession } from "../types";

const anonymousUserKey = "another-tomorrow.anonymous-user.v1";

type Fetcher = typeof fetch;

export interface ApiClientOptions {
  baseUrl?: string;
  fetcher?: Fetcher;
  storage?: Storage | null;
}

const apiBase = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  return configured ? configured.replace(/\/$/, "") : "";
};

const normalizeBaseUrl = (baseUrl?: string) => baseUrl?.trim().replace(/\/$/, "") ?? "";

const resolveStorage = (storage?: Storage | null) => {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

const createAnonymousUserId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createApiClient = ({ baseUrl, fetcher = fetch, storage }: ApiClientOptions = {}) => {
  const getBaseUrl = () => normalizeBaseUrl(baseUrl ?? apiBase());

  const getAnonymousUserId = () => {
    const resolvedStorage = resolveStorage(storage);
    if (!resolvedStorage) return "server-render";

    const existing = resolvedStorage.getItem(anonymousUserKey);
    if (existing) return existing;

    const generated = createAnonymousUserId();
    resolvedStorage.setItem(anonymousUserKey, generated);
    return generated;
  };

  const sendArchiveRequest = async (path: string, itemId: string, itemType: ArchiveItemType, method = "POST") => {
    const base = getBaseUrl();
    if (!base) return null;

    const response = await fetcher(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymousUserId: getAnonymousUserId(), itemId, itemType })
    });

    return response.ok ? await response.json() : null;
  };

  return {
    isEnabled: () => getBaseUrl().length > 0,
    getAnonymousUserId,

    submitConfession: async (confession: PrivateConfession) => {
      const base = getBaseUrl();
      if (!base) return null;

      try {
        const response = await fetcher(`${base}/api/confessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: confession.text,
            mood: confession.mood,
            destination: confession.destination,
            station: confession.station
          })
        });

        if (!response.ok) return null;
        return await response.json() as {
          id: string;
          publishStatus: PrivateConfession["publishStatus"];
          moderationFlags: string[];
        };
      } catch {
        return null;
      }
    },

    saveArchiveItem: async (itemId: string, itemType: ArchiveItemType) => {
      try {
        return await sendArchiveRequest("/api/archive/saved", itemId, itemType);
      } catch {
        return null;
      }
    },

    removeSavedArchiveItem: async (itemId: string, itemType: ArchiveItemType) => {
      try {
        return await sendArchiveRequest("/api/archive/saved", itemId, itemType, "DELETE");
      } catch {
        return null;
      }
    },

    markRecentlyPlayed: async (itemId: string, itemType: ArchiveItemType) => {
      try {
        return await sendArchiveRequest("/api/archive/recently-played", itemId, itemType);
      } catch {
        return null;
      }
    }
  };
};

const defaultApiClient = createApiClient();

export const isApiEnabled = () => defaultApiClient.isEnabled();

export const getAnonymousUserId = () => defaultApiClient.getAnonymousUserId();

export const submitConfessionToApi = (confession: PrivateConfession) =>
  defaultApiClient.submitConfession(confession);

export const saveArchiveItemToApi = (itemId: string, itemType: ArchiveItemType) =>
  defaultApiClient.saveArchiveItem(itemId, itemType);

export const removeSavedArchiveItemFromApi = (itemId: string, itemType: ArchiveItemType) =>
  defaultApiClient.removeSavedArchiveItem(itemId, itemType);

export const markRecentlyPlayedInApi = (itemId: string, itemType: ArchiveItemType) =>
  defaultApiClient.markRecentlyPlayed(itemId, itemType);
