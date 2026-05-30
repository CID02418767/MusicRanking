import { FormEvent, useMemo, useState } from "react";
import { Disc3, Library, ListMusic, LoaderCircle, Plus, Search, UserRound } from "lucide-react";
import type { Album, Artist, CacheStore, Song } from "../types";
import { fetchAlbumTracks, fetchArtistAlbums, searchArtists, searchSingleReleases } from "../lib/musicbrainz";

interface ImportViewProps {
  cacheStore: CacheStore;
  favoriteIds: Set<string>;
  onAddSongs: (songs: Song[]) => void;
}

function tagLine(values: string[]): string {
  return values.length > 0 ? values.slice(0, 3).join(" / ") : "未标注类型";
}

function CoverImage({ album }: { album: Album }) {
  const [failed, setFailed] = useState(false);
  const initial = album.title.trim().slice(0, 1).toUpperCase() || "M";

  return (
    <div className="cover-box" aria-label={`${album.title} 封面`}>
      {album.coverUrl && !failed ? (
        <img src={album.coverUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function ImportView({ cacheStore, favoriteIds, onAddSongs }: ImportViewProps) {
  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [singleResults, setSingleResults] = useState<Album[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [tracks, setTracks] = useState<Song[]>([]);
  const [artistLoading, setArtistLoading] = useState(false);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [trackLoading, setTrackLoading] = useState(false);
  const [addingAlbumId, setAddingAlbumId] = useState<string | null>(null);
  const [visibleAlbumCount, setVisibleAlbumCount] = useState(36);
  const [error, setError] = useState<string | null>(null);

  const selectedAlbumFavoriteCount = useMemo(() => {
    return tracks.filter((track) => favoriteIds.has(track.id)).length;
  }, [favoriteIds, tracks]);

  const visibleAlbums = useMemo(() => {
    return albums.slice(0, visibleAlbumCount);
  }, [albums, visibleAlbumCount]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setArtistLoading(true);
    setSelectedArtist(null);
    setAlbums([]);
    setSingleResults([]);
    setVisibleAlbumCount(36);
    setSelectedAlbum(null);
    setTracks([]);

    try {
      const [artistResults, releaseResults] = await Promise.all([
        searchArtists(query, cacheStore),
        searchSingleReleases(query, cacheStore),
      ]);
      setArtists(artistResults);
      setSingleResults(releaseResults);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "搜索失败");
    } finally {
      setArtistLoading(false);
    }
  }

  async function chooseArtist(artist: Artist) {
    setError(null);
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setTracks([]);
    setVisibleAlbumCount(36);
    setAlbumLoading(true);

    try {
      setAlbums(await fetchArtistAlbums(artist, cacheStore));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "专辑加载失败");
    } finally {
      setAlbumLoading(false);
    }
  }

  async function openAlbum(album: Album) {
    setError(null);
    setSelectedAlbum(album);
    setTracks([]);
    setTrackLoading(true);

    try {
      setTracks(await fetchAlbumTracks(album, cacheStore));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "曲目加载失败");
    } finally {
      setTrackLoading(false);
    }
  }

  async function addWholeAlbum(album: Album) {
    setError(null);
    setAddingAlbumId(album.id);

    try {
      const songs = selectedAlbum?.id === album.id && tracks.length > 0
        ? tracks
        : await fetchAlbumTracks(album, cacheStore);
      onAddSongs(songs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "整张收藏失败");
    } finally {
      setAddingAlbumId(null);
    }
  }

  return (
    <section className="view-grid import-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Import</p>
            <h2>搜索音乐人或单曲</h2>
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <label className="field-label" htmlFor="artist-search">
            歌手 / 乐队 / 单曲
          </label>
          <div className="input-row">
            <input
              id="artist-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如 Radiohead, Daydreaming, First Love"
            />
            <button className="primary-button icon-button" type="submit" disabled={artistLoading || !query.trim()}>
              {artistLoading ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}
              <span>搜索</span>
            </button>
          </div>
        </form>

        {error && <p className="status-message error">{error}</p>}

        {artists.length > 0 && <p className="list-label">音乐人结果</p>}
        <div className="stack-list">
          {artists.map((artist) => (
            <button
              key={artist.id}
              className={selectedArtist?.id === artist.id ? "artist-row selected" : "artist-row"}
              type="button"
              onClick={() => chooseArtist(artist)}
            >
              <UserRound aria-hidden="true" size={18} />
              <span>
                <strong>{artist.name}</strong>
                <small>
                  {[artist.type, artist.country, artist.disambiguation].filter(Boolean).join(" · ") ||
                    "MusicBrainz artist"}
                </small>
              </span>
            </button>
          ))}
        </div>

        {singleResults.length > 0 && <p className="list-label">单曲结果</p>}
        <div className="stack-list">
          {singleResults.map((single) => (
            <div key={single.id} className="single-result-row">
              <button className="single-open-row" type="button" onClick={() => openAlbum(single)}>
                <Disc3 aria-hidden="true" size={18} />
                <span>
                  <strong>{single.title}</strong>
                  <small>
                    {[single.artistName, single.firstReleaseDate, tagLine([...single.genres, ...single.tags])]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </button>
              <button
                className="secondary-button icon-only"
                type="button"
                onClick={() => addWholeAlbum(single)}
                disabled={addingAlbumId === single.id}
                title="导入单曲"
              >
                {addingAlbumId === single.id ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel wide-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Releases</p>
            <h2>{selectedArtist ? `${selectedArtist.name} 的专辑` : "专辑"}</h2>
          </div>
          {albumLoading && <LoaderCircle className="spin muted-icon" size={20} />}
        </div>

        {!selectedArtist && <p className="empty-state">选择音乐人后这里只展示专辑；单曲请在左侧直接搜索。</p>}
        {selectedArtist && !albumLoading && albums.length === 0 && (
          <p className="empty-state">没有找到可导入的非 Live 专辑。</p>
        )}

        <div className="album-grid">
          {visibleAlbums.map((album) => (
            <article key={album.id} className="album-card">
              <CoverImage album={album} />
              <div className="album-body">
                <div>
                  <div className="album-meta">
                    <span>{album.type}</span>
                    {album.firstReleaseDate && <span>{album.firstReleaseDate}</span>}
                  </div>
                  <h3>{album.title}</h3>
                  <p>{tagLine([...album.genres, ...album.tags])}</p>
                </div>
                <div className="button-row">
                  <button className="ghost-button icon-only" type="button" onClick={() => openAlbum(album)} title="查看曲目">
                    <ListMusic size={18} />
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => addWholeAlbum(album)}
                    disabled={addingAlbumId === album.id}
                  >
                    {addingAlbumId === album.id ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
                    <span>整张收藏</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {albums.length > visibleAlbumCount && (
          <button
            className="ghost-button load-more-button"
            type="button"
            onClick={() => setVisibleAlbumCount((count) => count + 36)}
          >
            显示更多
          </button>
        )}
      </section>

      <section className="panel track-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Tracks</p>
            <h2>{selectedAlbum ? selectedAlbum.title : "曲目"}</h2>
          </div>
          {trackLoading && <LoaderCircle className="spin muted-icon" size={20} />}
        </div>

        {!selectedAlbum && <p className="empty-state">从右侧专辑列表打开一张作品。</p>}
        {selectedAlbum && !trackLoading && tracks.length === 0 && <p className="empty-state">没有找到曲目。</p>}

        {tracks.length > 0 && (
          <div className="track-summary">
            <Disc3 size={18} />
            <span>
              {tracks.length} 首曲目，已收藏 {selectedAlbumFavoriteCount} 首
            </span>
          </div>
        )}

        <div className="track-list">
          {tracks.map((track) => {
            const saved = favoriteIds.has(track.id);
            return (
              <div key={track.id} className="track-row">
                <span className="track-position">{track.position}</span>
                <div>
                  <strong>{track.title}</strong>
                  <small>{track.artistName}</small>
                </div>
                <button
                  className={saved ? "ghost-button saved" : "primary-button icon-only"}
                  type="button"
                  onClick={() => onAddSongs([track])}
                  title={saved ? "已收藏" : "加入收藏"}
                >
                  {saved ? <Library size={18} /> : <Plus size={18} />}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

export default ImportView;
