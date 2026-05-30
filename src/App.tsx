import { useEffect, useMemo, useRef, useState } from "react";
import { Library, Search, Settings, Sparkles } from "lucide-react";
import ImportView from "./components/ImportView";
import CollectionView from "./components/CollectionView";
import SettingsView from "./components/SettingsView";
import type { AppData, CacheStore, FavoriteSong, Ratings, Song, TabId } from "./types";
import { ratingKeys } from "./types";
import { defaultRatings, normalizeRatings } from "./lib/scoring";
import { createEmptyData, loadAppData, saveAppData } from "./lib/storage";

const tabs: Array<{ id: TabId; label: string; icon: typeof Search }> = [
  { id: "import", label: "导入", icon: Search },
  { id: "collection", label: "收藏", icon: Library },
  { id: "settings", label: "设置", icon: Settings },
];

function mergeFavorite(existing: FavoriteSong | undefined, song: Song): FavoriteSong {
  const now = new Date().toISOString();
  if (existing) {
    return {
      ...existing,
      song: {
        ...existing.song,
        ...song,
      },
      updatedAt: now,
    };
  }

  return {
    song,
    ratings: defaultRatings,
    customTags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("import");
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    saveAppData(data);
    setLastSavedAt(new Date());
  }, [data]);

  const cacheStore = useMemo<CacheStore>(
    () => ({
      get<T>(key: string, maxAgeMs: number): T | null {
        const entry = dataRef.current.cache[key];
        if (!entry || Date.now() - entry.savedAt > maxAgeMs) {
          return null;
        }
        return entry.value as T;
      },
      set<T>(key: string, value: T) {
        setData((current) => ({
          ...current,
          cache: {
            ...current.cache,
            [key]: {
              savedAt: Date.now(),
              value,
            },
          },
        }));
      },
    }),
    [],
  );

  const favoriteIds = useMemo(() => {
    return new Set(data.favorites.map((favorite) => favorite.song.id));
  }, [data.favorites]);

  function addSongsToFavorites(songs: Song[]) {
    if (songs.length === 0) {
      return;
    }

    setData((current) => {
      const existingById = new Map(current.favorites.map((favorite) => [favorite.song.id, favorite]));
      const nextFavorites = [...current.favorites];

      songs.forEach((song) => {
        const existing = existingById.get(song.id);
        const merged = mergeFavorite(existing, song);
        if (existing) {
          const index = nextFavorites.findIndex((favorite) => favorite.song.id === song.id);
          nextFavorites[index] = merged;
        } else {
          nextFavorites.push(merged);
        }
      });

      return {
        ...current,
        favorites: nextFavorites,
      };
    });

    setActiveTab("collection");
  }

  function updateFavorite(songId: string, updates: Partial<FavoriteSong>) {
    setData((current) => ({
      ...current,
      favorites: current.favorites.map((favorite) => {
        if (favorite.song.id !== songId) {
          return favorite;
        }

        return {
          ...favorite,
          ...updates,
          ratings: updates.ratings ? normalizeRatings(updates.ratings as Partial<Ratings>) : favorite.ratings,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }

  function updateRating(songId: string, key: keyof Ratings, value: number) {
    const favorite = dataRef.current.favorites.find((item) => item.song.id === songId);
    if (!favorite) {
      return;
    }

    updateFavorite(songId, {
      ratings: {
        ...favorite.ratings,
        [key]: value,
      },
    });
  }

  function removeFavorite(songId: string) {
    setData((current) => ({
      ...current,
      favorites: current.favorites.filter((favorite) => favorite.song.id !== songId),
    }));
  }

  function replaceData(nextData: AppData) {
    setData(nextData);
  }

  function resetData() {
    setData(createEmptyData());
  }

  function setWeights(weights: AppData["weights"]) {
    setData((current) => ({
      ...current,
      weights,
    }));
  }

  const savedLabel = lastSavedAt
    ? `已自动保存 ${lastSavedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "等待保存";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand-line">
            <Sparkles aria-hidden="true" size={18} />
            <span>musicranking</span>
          </div>
          <h1>私人音乐评分库</h1>
        </div>
        <div className="save-state" aria-live="polite">
          {savedLabel}
        </div>
      </header>

      <nav className="tab-bar" aria-label="主界面">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "tab-button active" : "tab-button"}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "import" && (
        <ImportView
          cacheStore={cacheStore}
          favoriteIds={favoriteIds}
          onAddSongs={addSongsToFavorites}
        />
      )}

      {activeTab === "collection" && (
        <CollectionView
          favorites={data.favorites}
          weights={data.weights}
          onUpdateFavorite={updateFavorite}
          onUpdateRating={updateRating}
          onRemoveFavorite={removeFavorite}
        />
      )}

      {activeTab === "settings" && (
        <SettingsView
          data={data}
          lastSavedAt={lastSavedAt}
          ratingKeys={ratingKeys}
          onReplaceData={replaceData}
          onResetData={resetData}
          onSetWeights={setWeights}
        />
      )}
    </main>
  );
}

export default App;
