import type { MarketCategoryKey } from "@/lib/football/types";

/**
 * UI-level types that are not part of the football domain.
 *
 * The market vocabulary is the canonical one from the football layer (see
 * `@/lib/football/markets`), so a market named in a request means the same thing
 * everywhere in the app.
 */
export type MarketKey = MarketCategoryKey;

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
}

export interface PredictionRequest {
  fixtureIds: string[];
  markets: MarketCategoryKey[];
  mode: "automatic" | "manual" | "screenshot";
  options?: Record<string, string | number | boolean>;
}
