import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Star, Tag, Trash2, X } from "lucide-react";
import type { FavoriteSong, RatingKey, RatingWeights } from "../types";
import { ratingKeys, ratingLabels } from "../types";
import { calculateScore, clampRating, formatScore } from "../lib/scoring";

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

        {visibleFavorites.length === 0 && <p className="empty-state">没有匹配的收藏歌曲。</p>}

        <div className="song-list">
          {visibleFavorites.map((favorite, index) => {
            const score = calculateScore(favorite.ratings, weights);
            const active = selectedFavorite?.song.id === favorite.song.id;
            const allTags = tagsForSong(favorite);

            return (
              <button
                key={favorite.song.id}
                className={active ? "song-row active" : "song-row"}
                type="button"
                onClick={() => setSelectedId(favorite.song.id)}
              >
                <span className="rank-number">{index + 1}</span>
                <div className="song-main">
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
                </div>
                <span className="score-badge">{formatScore(score)}</span>
              </button>
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
