import type { AppData, FavoriteSong } from "../types";
import { defaultWeights, normalizeRatings, normalizeWeights } from "./scoring";

export const STORAGE_KEY = "musicranking:v1";

export function createEmptyData(): AppData {
  return {
    version: 1,
    favorites: [],
    weights: defaultWeights,
    cache: {},
  };
}

function normalizeFavorite(value: unknown): FavoriteSong | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const favorite = value as Partial<FavoriteSong>;
  if (!favorite.song || typeof favorite.song !== "object") {
    return null;
  }

  const song = favorite.song as FavoriteSong["song"];
  if (!song.id || !song.title || !song.artistName || !song.albumTitle || !song.albumId) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    song: {
      ...song,
      position: String(song.position ?? ""),
      genres: Array.isArray(song.genres) ? song.genres : [],
      tags: Array.isArray(song.tags) ? song.tags : [],
      albumGenres: Array.isArray(song.albumGenres) ? song.albumGenres : [],
      albumTags: Array.isArray(song.albumTags) ? song.albumTags : [],
    },
    ratings: normalizeRatings(favorite.ratings),
    customTags: Array.isArray(favorite.customTags)
      ? favorite.customTags.filter((tag): tag is string => typeof tag === "string")
      : [],
    createdAt: typeof favorite.createdAt === "string" ? favorite.createdAt : now,
    updatedAt: typeof favorite.updatedAt === "string" ? favorite.updatedAt : now,
  };
}

export function normalizeAppData(value: unknown): AppData {
  if (!value || typeof value !== "object") {
    return createEmptyData();
  }

  const data = value as Partial<AppData>;
  const favorites = Array.isArray(data.favorites)
    ? data.favorites.map(normalizeFavorite).filter((item): item is FavoriteSong => item !== null)
    : [];

  return {
    version: 1,
    favorites,
    weights: normalizeWeights(data.weights),
    cache: data.cache && typeof data.cache === "object" ? data.cache : {},
  };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyData();
    }
    return normalizeAppData(JSON.parse(raw));
  } catch {
    return createEmptyData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
