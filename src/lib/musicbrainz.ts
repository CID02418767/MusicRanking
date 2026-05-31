import type { Album, Artist, CacheStore, Song } from "../types";

const MB_BASE = "https://musicbrainz.org/ws/2";
const COVER_BASE = "https://coverartarchive.org";
const REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 15000;
const SEARCH_TTL_MS = 6 * 60 * 60 * 1000;
const RELEASE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type MusicBrainzTag = {
  name?: string;
  count?: number;
};

type ArtistCredit = {
  name?: string;
  artist?: {
    id?: string;
    name?: string;
  };
};

type MusicBrainzArtist = {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
  type?: string;
};

type ArtistSearchResponse = {
  artists?: MusicBrainzArtist[];
};

type ReleaseGroupResponse = {
  "release-groups"?: Array<{
    id: string;
    title: string;
    "primary-type"?: string;
    "secondary-types"?: string[];
    "first-release-date"?: string;
    genres?: MusicBrainzTag[];
    tags?: MusicBrainzTag[];
    "artist-credit"?: ArtistCredit[];
  }>;
};

type ReleaseTrack = {
  id?: string;
  number?: string;
  position?: number;
  title?: string;
  recording?: {
    id?: string;
    title?: string;
    genres?: MusicBrainzTag[];
    tags?: MusicBrainzTag[];
    "artist-credit"?: ArtistCredit[];
  };
};

type ReleaseMedium = {
  position?: number;
  tracks?: ReleaseTrack[];
};

type Release = {
  id: string;
  title?: string;
  date?: string;
  media?: ReleaseMedium[];
  genres?: MusicBrainzTag[];
  tags?: MusicBrainzTag[];
  "artist-credit"?: ArtistCredit[];
};

type ReleaseBrowseResponse = {
  releases?: Release[];
};

let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
  const run = requestQueue.then(async () => {
    const waitMs = Math.max(0, REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
    if (waitMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    }
    lastRequestAt = Date.now();
    return request();
  });

  requestQueue = run.then(
    () => undefined,
    () => undefined,
  );

  return run;
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${MB_BASE}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  return enqueueRequest(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`MusicBrainz 请求失败: ${response.status}`);
    }

    return response.json() as Promise<T>;
  });
}

async function cachedFetch<T>(
  cache: CacheStore,
  key: string,
  url: string,
  ttlMs: number,
): Promise<T> {
  const cached = cache.get<T>(key, ttlMs);
  if (cached) {
    return cached;
  }

  const value = await fetchJson<T>(url);
  cache.set(key, value);
  return value;
}

function normalizeTags(tags: MusicBrainzTag[] | undefined, limit = 8): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag) => tag.name)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, limit)
    .map((tag) => tag.name as string);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function joinArtistCredits(credits: ArtistCredit[] | undefined, fallback: string): string {
  if (!Array.isArray(credits) || credits.length === 0) {
    return fallback;
  }

  const names = credits
    .map((credit) => credit.name || credit.artist?.name)
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(", ") : fallback;
}

function coverUrlForReleaseGroup(id: string): string {
  return `${COVER_BASE}/release-group/${id}/front-250`;
}

function normalizeCountryCode(country: string | undefined): string | undefined {
  if (!country) {
    return country;
  }

  return ["TW", "HK", "MO"].includes(country.toUpperCase()) ? "CN" : country;
}

function countryNameForCode(country: string | undefined): string | undefined {
  return country?.toUpperCase() === "CN" ? "China" : undefined;
}

function hasSecondaryType(group: { "secondary-types"?: string[] }, type: string): boolean {
  return group["secondary-types"]?.some((value) => value.toLowerCase() === type.toLowerCase()) ?? false;
}

function isArtistAlbumOrEp(group: { "primary-type"?: string; "secondary-types"?: string[] }): boolean {
  return ["Album", "EP"].includes(group["primary-type"] ?? "") && !hasSecondaryType(group, "Live");
}

function isDirectSingle(group: { "primary-type"?: string; "secondary-types"?: string[] }): boolean {
  return group["primary-type"] === "Single" && !hasSecondaryType(group, "Live");
}

function firstArtistId(credits: ArtistCredit[] | undefined, fallback: string): string {
  return credits?.find((credit) => credit.artist?.id)?.artist?.id ?? fallback;
}

export async function searchArtists(query: string, cache: CacheStore): Promise<Artist[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const url = buildUrl("artist", {
    query: trimmed,
    limit: "10",
    fmt: "json",
  });

  const data = await cachedFetch<ArtistSearchResponse>(
    cache,
    `artist-search:${trimmed.toLowerCase()}`,
    url,
    SEARCH_TTL_MS,
  );

  return (data.artists ?? []).map((artist) => {
    const country = normalizeCountryCode(artist.country);
    return {
      id: artist.id,
      name: artist.name,
      disambiguation: artist.disambiguation,
      country,
      countryName: countryNameForCode(country),
      type: artist.type,
    };
  });
}

export async function fetchArtistAlbums(artist: Artist, cache: CacheStore): Promise<Album[]> {
  const url = buildUrl("release-group", {
    artist: artist.id,
    limit: "100",
    fmt: "json",
    inc: "genres+tags",
  });

  const data = await cachedFetch<ReleaseGroupResponse>(
    cache,
    `artist-release-groups:${artist.id}`,
    url,
    RELEASE_TTL_MS,
  );

  return (data["release-groups"] ?? [])
    .filter(isArtistAlbumOrEp)
    .map((group) => ({
      id: group.id,
      artistId: artist.id,
      artistName: artist.name,
      artistCountry: artist.country,
      artistCountryName: artist.countryName,
      title: group.title,
      type: group["primary-type"] ?? "Album",
      firstReleaseDate: group["first-release-date"],
      genres: normalizeTags(group.genres),
      tags: normalizeTags(group.tags),
      coverUrl: coverUrlForReleaseGroup(group.id),
    }))
    .sort((a, b) => (b.firstReleaseDate ?? "").localeCompare(a.firstReleaseDate ?? ""));
}

export async function searchSingleReleases(query: string, cache: CacheStore): Promise<Album[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const url = buildUrl("release-group", {
    query: trimmed,
    limit: "25",
    fmt: "json",
    inc: "genres+tags+artist-credits",
  });

  const data = await cachedFetch<ReleaseGroupResponse>(
    cache,
    `single-release-search:${trimmed.toLowerCase()}`,
    url,
    SEARCH_TTL_MS,
  );

  return (data["release-groups"] ?? [])
    .filter(isDirectSingle)
    .slice(0, 8)
    .map((group) => ({
      id: group.id,
      artistId: firstArtistId(group["artist-credit"], ""),
      artistName: joinArtistCredits(group["artist-credit"], "Unknown artist"),
      artistCountry: undefined,
      artistCountryName: undefined,
      title: group.title,
      type: "Single",
      firstReleaseDate: group["first-release-date"],
      genres: normalizeTags(group.genres),
      tags: normalizeTags(group.tags),
      coverUrl: coverUrlForReleaseGroup(group.id),
    }))
    .sort((a, b) => (b.firstReleaseDate ?? "").localeCompare(a.firstReleaseDate ?? ""));
}

function releaseHasTracks(release: Release): boolean {
  return Boolean(release.media?.some((medium) => medium.tracks && medium.tracks.length > 0));
}

async function fetchReleaseLookup(releaseId: string, cache: CacheStore): Promise<Release> {
  const url = buildUrl(`release/${releaseId}`, {
    inc: "media+recordings+artist-credits+genres+tags",
    fmt: "json",
  });

  return cachedFetch<Release>(cache, `release-lookup:${releaseId}`, url, RELEASE_TTL_MS);
}

function trackToSong(album: Album, release: Release, medium: ReleaseMedium, track: ReleaseTrack): Song {
  const title = track.title || track.recording?.title || "Untitled";
  const recordingId = track.recording?.id;
  const position = track.number || [medium.position, track.position].filter(Boolean).join("-");
  const releaseGenres = normalizeTags(release.genres);
  const releaseTags = normalizeTags(release.tags);
  const songGenres = normalizeTags(track.recording?.genres);
  const songTags = normalizeTags(track.recording?.tags);

  return {
    id: `${album.id}:${recordingId ?? track.id ?? position}:${title}`,
    title,
    artistName: joinArtistCredits(track.recording?.["artist-credit"], album.artistName),
    artistCountry: album.artistCountry,
    artistCountryName: album.artistCountryName,
    albumTitle: album.title,
    albumId: album.id,
    position,
    genres: unique([...songGenres]),
    tags: unique([...songTags]),
    albumGenres: unique([...album.genres, ...releaseGenres]),
    albumTags: unique([...album.tags, ...releaseTags]),
    coverUrl: album.coverUrl,
    albumType: album.type,
    sourceRecordingId: recordingId,
  };
}

export async function fetchAlbumTracks(album: Album, cache: CacheStore): Promise<Song[]> {
  const url = buildUrl("release", {
    "release-group": album.id,
    status: "official",
    limit: "12",
    fmt: "json",
    inc: "media+recordings+artist-credits+genres+tags",
  });

  const browseData = await cachedFetch<ReleaseBrowseResponse>(
    cache,
    `release-browse:${album.id}`,
    url,
    RELEASE_TTL_MS,
  );

  const releaseFromBrowse =
    (browseData.releases ?? []).find(releaseHasTracks) ?? browseData.releases?.[0];

  if (!releaseFromBrowse) {
    return [];
  }

  const release = releaseHasTracks(releaseFromBrowse)
    ? releaseFromBrowse
    : await fetchReleaseLookup(releaseFromBrowse.id, cache);

  const songs =
    release.media?.flatMap((medium) =>
      (medium.tracks ?? []).map((track) => trackToSong(album, release, medium, track)),
    ) ?? [];

  return songs.filter((song, index, all) => {
    return all.findIndex((candidate) => candidate.id === song.id) === index;
  });
}
