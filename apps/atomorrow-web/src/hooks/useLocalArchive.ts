import { useEffect, useMemo, useState } from "react";
import type {
  ArchiveItemType,
  LocalArchiveState,
  PrivateConfession,
  RecentlyPlayedItem,
  SavedArchiveItem
} from "../types";
import { defaultArchiveState, readArchiveState, writeArchiveState } from "../utils/storage";

const archiveKey = (id: string, type: ArchiveItemType) => `${type}:${id}`;

export const useLocalArchive = () => {
  const [archive, setArchive] = useState<LocalArchiveState>(defaultArchiveState);

  useEffect(() => {
    setArchive(readArchiveState());
  }, []);

  useEffect(() => {
    writeArchiveState(archive);
  }, [archive]);

  const savedKeys = useMemo(
    () => new Set(archive.saved.map((item) => archiveKey(item.id, item.type))),
    [archive.saved]
  );

  const isSaved = (id: string, type: ArchiveItemType) => savedKeys.has(archiveKey(id, type));

  const toggleSaved = (id: string, type: ArchiveItemType) => {
    setArchive((current) => {
      const key = archiveKey(id, type);
      const exists = current.saved.some((item) => archiveKey(item.id, item.type) === key);
      const saved: SavedArchiveItem[] = exists
        ? current.saved.filter((item) => archiveKey(item.id, item.type) !== key)
        : [{ id, type, savedAt: new Date().toISOString() }, ...current.saved];
      return { ...current, saved };
    });
  };

  const addRecentlyPlayed = (id: string, type: ArchiveItemType) => {
    setArchive((current) => {
      const key = archiveKey(id, type);
      const nextItem: RecentlyPlayedItem = { id, type, playedAt: new Date().toISOString() };
      const recentlyPlayed = [
        nextItem,
        ...current.recentlyPlayed.filter((item) => archiveKey(item.id, item.type) !== key)
      ].slice(0, 12);

      return { ...current, recentlyPlayed };
    });
  };

  const addPrivateConfession = (confession: PrivateConfession) => {
    setArchive((current) => ({
      ...current,
      privateConfessions: [confession, ...current.privateConfessions]
    }));
  };

  const hideContent = (id: string) => {
    setArchive((current) => ({
      ...current,
      hiddenContent: current.hiddenContent.includes(id)
        ? current.hiddenContent
        : [id, ...current.hiddenContent]
    }));
  };

  return {
    archive,
    isSaved,
    toggleSaved,
    addRecentlyPlayed,
    addPrivateConfession,
    hideContent
  };
};
