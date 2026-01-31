import { useState, useEffect, useCallback } from 'react';

interface BlockUsage {
  blockId: string;
  favorites: Set<string>;
  recentUsage: Map<string, Date>;
}

const STORAGE_KEY = 'grapes_block_usage';
const MAX_RECENT = 20;

export const useBlockUsage = (projectId?: string) => {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentUsage, setRecentUsage] = useState<Map<string, Date>>(new Map());

  const getStorageKey = useCallback(() => {
    return projectId ? `${STORAGE_KEY}_${projectId}` : STORAGE_KEY;
  }, [projectId]);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const data = JSON.parse(stored);
        setFavorites(new Set(data.favorites || []));
        setRecentUsage(new Map(Object.entries(data.recentUsage || {}).map(([k, v]) => [k, new Date(v as string)])));
      }
    } catch (error) {
      console.error('Failed to load block usage:', error);
    }
  }, [getStorageKey]);

  // Save to localStorage
  const saveToStorage = useCallback((favs: Set<string>, recent: Map<string, Date>) => {
    try {
      const data = {
        favorites: Array.from(favs),
        recentUsage: Object.fromEntries(
          Array.from(recent.entries()).map(([k, v]) => [k, v.toISOString()])
        ),
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save block usage:', error);
    }
  }, [getStorageKey]);

  // Toggle favorite
  const toggleFavorite = useCallback((blockId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      saveToStorage(next, recentUsage);
      return next;
    });
  }, [recentUsage, saveToStorage]);

  // Track block usage
  const trackBlockUsage = useCallback((blockId: string) => {
    setRecentUsage((prev) => {
      const next = new Map(prev);
      next.set(blockId, new Date());

      // Keep only the most recent MAX_RECENT entries
      if (next.size > MAX_RECENT) {
        const sorted = Array.from(next.entries()).sort((a, b) => b[1].getTime() - a[1].getTime());
        const trimmed = new Map(sorted.slice(0, MAX_RECENT));
        saveToStorage(favorites, trimmed);
        return trimmed;
      }

      saveToStorage(favorites, next);
      return next;
    });
  }, [favorites, saveToStorage]);

  // Get recent blocks sorted by date
  const getRecentBlocks = useCallback(() => {
    return Array.from(recentUsage.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .map(([blockId]) => blockId);
  }, [recentUsage]);

  // Check if block is favorite
  const isFavorite = useCallback((blockId: string) => {
    return favorites.has(blockId);
  }, [favorites]);

  // Get last used date
  const getLastUsed = useCallback((blockId: string) => {
    return recentUsage.get(blockId);
  }, [recentUsage]);

  return {
    favorites,
    recentUsage,
    toggleFavorite,
    trackBlockUsage,
    getRecentBlocks,
    isFavorite,
    getLastUsed,
  };
};
