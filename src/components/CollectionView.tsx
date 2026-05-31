import { useMemo, useState } from "react";
import { CheckSquare, Search, SlidersHorizontal, Star, Tag, Trash2, X } from "lucide-react";
import type { FavoriteSong, RatingKey, Ratings, RatingWeights } from "../types";
import { ratingKeys, ratingLabels } from "../types";
import { calculateScore, clampRating, defaultRatings, formatScore } from "../lib/scoring";

interface CollectionViewProps {
  favorites: FavoriteSong[];
  weights: RatingWeights;
  onUpdateFavorite: (songId: string, updates: Partial<FavoriteSong>) => void;
  onUpdateRating: (songId: string, key: RatingKey, value: number) => void;
  onRemoveFavorite: (songId: string) => void;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function tagsForSong(favorite: FavoriteSong): string[] {
  return uniqueSorted([...favorite.song.genres, ...favorite.song.tags, ...favorite.customTags]);
}

function tagsForAlbum(favorite: FavoriteSong): string[] {
  return uniqueSorted([...favorite.song.albumGenres, ...favorite.song.albumTags]);
}

function normalizeCountryCode(country: string | undefined): string | undefined {
  if (!country) {
    return country;
  }

  return ["TW", "HK", "MO"].includes(country.toUpperCase()) ? "CN" : country.toUpperCase();
}

function countryCodeForFavorite(favorite: FavoriteSong): string {
  return normalizeCountryCode(favorite.song.artistCountry) ?? "__unknown";
}

function countryLabelForFavorite(favorite: FavoriteSong): string {
  const country = countryCodeForFavorite(favorite);
  if (country === "__unknown") {
    return "未知";
  }

  const countryName = country === "CN" ? "China" : favorite.song.artistCountryName;
  return [country, countryName].filter(Boolean).join(" · ");
}

function CollectionView({
  favorites,
  weights,
  onUpdateFavorite,
  onUpdateRating,
  onRemoveFavorite,
}: CollectionViewProps) {
  const [query, setQuery] = useState("");
  const [songTag, setSongTag] = useState("");
  const [albumTag, setAlbumTag] = useState("");
  const [country, setCountry] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(favorites[0]?.song.id ?? null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchRatings, setBatchRatings] = useState<Ratings>(defaultRatings);

  const songTags = useMemo(() => uniqueSorted(favorites.flatMap(tagsForSong)), [favorites]);
  const albumTags = useMemo(() => uniqueSorted(favorites.flatMap(tagsForAlbum)), [favorites]);
  const countryOptions = useMemo(() => {
    return Array.from(
      new Map(favorites.map((favorite) => [countryCodeForFavorite(favorite), countryLabelForFavorite(favorite)])).entries(),
    ).sort((a, b) => a[1].localeCompare(b[1], "zh-CN"));
  }, [favorites]);

  const visibleFavorites = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return favorites
      .filter((favorite) => {
        const text = [
          favorite.song.title,
          favorite.song.artistName,
          favorite.song.albumTitle,
        ].join(" ").toLowerCase();
        const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
        const matchesSongTag = !songTag || tagsForSong(favorite).includes(songTag);
        const matchesAlbumTag = !albumTag || tagsForAlbum(favorite).includes(albumTag);
        const matchesCountry = !country || countryCodeForFavorite(favorite) === country;
        return matchesQuery && matchesSongTag && matchesAlbumTag && matchesCountry;
      })
      .sort((a, b) => calculateScore(b.ratings, weights) - calculateScore(a.ratings, weights));
  }, [albumTag, country, favorites, query, songTag, weights]);

  const selectedFavorite =
    favorites.find((favorite) => favorite.song.id === selectedId) ?? visibleFavorites[0] ?? null;
  const visibleIds = useMemo(() => visibleFavorites.map((favorite) => favorite.song.id), [visibleFavorites]);
  const visibleBatchSelectedCount = visibleIds.filter((id) => batchSelectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleBatchSelectedCount === visibleIds.length;

  function updateCustomTags(value: string) {
    if (!selectedFavorite) {
      return;
    }

    const tags = uniqueSorted(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    onUpdateFavorite(selectedFavorite.song.id, { customTags: tags });
  }

  function toggleBatchSelection(songId: string) {
    setBatchSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }

  function toggleVisibleBatchSelection() {
    setBatchSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function updateBatchRating(key: RatingKey, value: number) {
    setBatchRatings((current) => ({
      ...current,
      [key]: clampRating(value),
    }));
  }

  function applyBatchRatings() {
    batchSelectedIds.forEach((songId) => {
      onUpdateFavorite(songId, { ratings: batchRatings });
    });
  }

  return (
    <section className="view-grid collection-grid">
      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Collection</p>
            <h2>个人收藏</h2>
          </div>
          <span className="count-pill">{favorites.length} 首</span>
        </div>

        <div className="filter-grid">
          <label className="field-label">
            搜索
            <span className="input-with-icon">
              <Search size={17} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="歌手 / 专辑 / 歌名"
              />
            </span>
          </label>
          <label className="field-label">
            歌曲标签
            <select value={songTag} onChange={(event) => setSongTag(event.target.value)}>
              <option value="">全部歌曲标签</option>
              {songTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            专辑标签
            <select value={albumTag} onChange={(event) => setAlbumTag(event.target.value)}>
              <option value="">全部专辑标签</option>
              {albumTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            国家/地区
            <select value={country} onChange={(event) => setCountry(event.target.value)}>
              <option value="">全部国家/地区</option>
              {countryOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(query || songTag || albumTag || country) && (
            <button className="ghost-button clear-filter" type="button" onClick={() => {
              setQuery("");
              setSongTag("");
              setAlbumTag("");
              setCountry("");
            }}>
              <X size={16} />
              <span>清除</span>
            </button>
          )}
        </div>

        {visibleFavorites.length > 0 && (
          <div className="batch-toolbar">
            <button className="ghost-button compact-button" type="button" onClick={toggleVisibleBatchSelection}>
              <CheckSquare size={16} />
              <span>{allVisibleSelected ? "取消当前选择" : "选择当前结果"}</span>
            </button>
            <span>{batchSelectedIds.size} 首待批量评分</span>
          </div>
        )}

        {visibleFavorites.length === 0 && <p className="empty-state">没有匹配的收藏歌曲。</p>}

        <div className="song-list">
          {visibleFavorites.map((favorite, index) => {
            const score = calculateScore(favorite.ratings, weights);
            const active = selectedFavorite?.song.id === favorite.song.id;
            const allTags = tagsForSong(favorite);

            return (
              <div
                key={favorite.song.id}
                className={active ? "song-row active" : "song-row"}
              >
                <label className="row-check" title="选择收藏歌曲">
                  <input
                    type="checkbox"
                    checked={batchSelectedIds.has(favorite.song.id)}
                    onChange={() => toggleBatchSelection(favorite.song.id)}
                  />
                </label>
                <span className="rank-number">{index + 1}</span>
                <button className="song-select-button" type="button" onClick={() => setSelectedId(favorite.song.id)}>
                  <strong>{favorite.song.title}</strong>
                  <small>
                    {favorite.song.artistName} · {favorite.song.albumTitle} · {countryLabelForFavorite(favorite)}
                  </small>
                  {allTags.length > 0 && (
                    <span className="mini-tags">
                      {allTags.slice(0, 4).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </span>
                  )}
                </button>
                <span className="score-badge">{formatScore(score)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="panel editor-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Edit</p>
            <h2>评分编辑</h2>
          </div>
          <SlidersHorizontal className="muted-icon" size={20} />
        </div>

        {!selectedFavorite && <p className="empty-state">选择一首收藏歌曲后开始评分。</p>}

        {selectedFavorite && (
          <div className="editor-content">
            <div className="batch-panel">
              <div className="selected-song">
                <CheckSquare size={18} />
                <div>
                  <strong>批量评分</strong>
                  <small>将五项评分应用到已勾选的收藏歌曲</small>
                </div>
                <span>{batchSelectedIds.size}</span>
              </div>
              <div className="rating-stack">
                {ratingKeys.map((key) => (
                  <label key={key} className="rating-control">
                    <span>
                      {ratingLabels[key]}
                      <strong>{batchRatings[key].toFixed(1)}</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={batchRatings[key]}
                      onChange={(event) => updateBatchRating(key, clampRating(event.target.value))}
                    />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={batchRatings[key]}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => updateBatchRating(key, clampRating(event.target.value))}
                    />
                  </label>
                ))}
              </div>
              <button className="secondary-button" type="button" onClick={applyBatchRatings} disabled={batchSelectedIds.size === 0}>
                <CheckSquare size={17} />
                <span>应用到 {batchSelectedIds.size} 首</span>
              </button>
            </div>

            <div className="selected-song">
              <Star size={18} />
              <div>
                <strong>{selectedFavorite.song.title}</strong>
                <small>
                  {selectedFavorite.song.artistName} · {selectedFavorite.song.albumTitle}
                </small>
              </div>
              <span>{formatScore(calculateScore(selectedFavorite.ratings, weights))}</span>
            </div>

            <div className="rating-stack">
              {ratingKeys.map((key) => (
                <label key={key} className="rating-control">
                  <span>
                    {ratingLabels[key]}
                    <strong>{selectedFavorite.ratings[key].toFixed(1)}</strong>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={selectedFavorite.ratings[key]}
                    onChange={(event) => onUpdateRating(selectedFavorite.song.id, key, clampRating(event.target.value))}
                  />
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={selectedFavorite.ratings[key]}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => onUpdateRating(selectedFavorite.song.id, key, clampRating(event.target.value))}
                  />
                </label>
              ))}
            </div>

            <label className="field-label">
              自定义歌曲标签
              <span className="input-with-icon">
                <Tag size={17} />
                <input
                  type="text"
                  value={selectedFavorite.customTags.join(", ")}
                  onChange={(event) => updateCustomTags(event.target.value)}
                  placeholder="例如 bridge, favorite vocal"
                />
              </span>
            </label>

            <button
              className="danger-button"
              type="button"
              onClick={() => {
                if (window.confirm("从收藏中移除这首歌？")) {
                  onRemoveFavorite(selectedFavorite.song.id);
                }
              }}
            >
              <Trash2 size={17} />
              <span>移除收藏</span>
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}

export default CollectionView;
