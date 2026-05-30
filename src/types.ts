export type TabId = "import" | "collection" | "settings";

export type RatingKey =
  | "lyrics"
  | "composition"
  | "arrangementProduction"
  | "performance"
  | "preference";

export const ratingKeys: RatingKey[] = [
  "lyrics",
  "composition",
  "arrangementProduction",
  "performance",
  "preference",
];

export const ratingLabels: Record<RatingKey, string> = {
  lyrics: "歌词",
  composition: "作曲",
  arrangementProduction: "编曲制作",
  performance: "演唱演奏",
  preference: "个人喜好",
};

export type Ratings = Record<RatingKey, number>;
export type RatingWeights = Record<RatingKey, number>;

export interface Artist {
  id: string;
  name: string;
  disambiguation?: string;
  country?: string;
  type?: string;
}

export interface Album {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  type: string;
  firstReleaseDate?: string;
  genres: string[];
  tags: string[];
  coverUrl?: string;
}

export interface Song {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  albumId: string;
  position: string;
  genres: string[];
  tags: string[];
  albumGenres: string[];
  albumTags: string[];
  coverUrl?: string;
  albumType?: string;
  sourceRecordingId?: string;
}

export interface FavoriteSong {
  song: Song;
  ratings: Ratings;
  customTags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CacheEntry<T = unknown> {
  savedAt: number;
  value: T;
}

export interface AppData {
  version: 1;
  favorites: FavoriteSong[];
  weights: RatingWeights;
  cache: Record<string, CacheEntry>;
}

export interface CacheStore {
  get<T>(key: string, maxAgeMs: number): T | null;
  set<T>(key: string, value: T): void;
}
