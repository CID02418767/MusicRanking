import type { Ratings, RatingWeights } from "../types";
import { ratingKeys } from "../types";

export const defaultRatings: Ratings = {
  lyrics: 0,
  composition: 0,
  arrangementProduction: 0,
  performance: 0,
  preference: 0,
};

export const defaultWeights: RatingWeights = {
  lyrics: 1,
  composition: 1,
  arrangementProduction: 1,
  performance: 1,
  preference: 1,
};

export function clampRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(10, Math.max(0, parsed));
}

export function normalizeRatings(value: Partial<Ratings> | undefined): Ratings {
  return ratingKeys.reduce((ratings, key) => {
    ratings[key] = clampRating(value?.[key] ?? 0);
    return ratings;
  }, {} as Ratings);
}

export function normalizeWeights(value: Partial<RatingWeights> | undefined): RatingWeights {
  return ratingKeys.reduce((weights, key) => {
    const parsed = Number(value?.[key] ?? defaultWeights[key]);
    weights[key] = Number.isFinite(parsed) ? Math.max(0, parsed) : defaultWeights[key];
    return weights;
  }, {} as RatingWeights);
}

export function calculateScore(ratings: Ratings, weights: RatingWeights): number {
  const totalWeight = ratingKeys.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  const effectiveWeights = totalWeight > 0 ? weights : defaultWeights;
  const denominator = totalWeight > 0 ? totalWeight : ratingKeys.length;

  const numerator = ratingKeys.reduce((sum, key) => {
    return sum + clampRating(ratings[key]) * Math.max(0, effectiveWeights[key]);
  }, 0);

  return numerator / denominator;
}

export function formatScore(score: number): string {
  return Number.isFinite(score) ? score.toFixed(2) : "0.00";
}
