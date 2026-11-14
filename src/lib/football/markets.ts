import type { MarketCategory, MarketCategoryKey } from "./types";

/**
 * Canonical market categories.
 *
 * The provider identifiers below are the documented Sportmonks / API-Football
 * market ids. They are declared in one place so a provider change or an id drift
 * is a single-file edit. `namePatterns` is the fallback used when a provider
 * returns a market whose id is not in the table.
 */
export const marketCategories: Record<MarketCategoryKey, MarketCategory> = {
  "match-winner": {
    key: "match-winner",
    label: "Match winner",
    short: "1X2",
    providerMarketIds: { sportmonks: ["1"], "api-football": ["1"] },
    namePatterns: ["fulltime result", "full time result", "match winner", "1x2", "winner"],
  },
  "double-chance": {
    key: "double-chance",
    label: "Double chance",
    short: "DC",
    providerMarketIds: { sportmonks: ["2"], "api-football": ["12"] },
    namePatterns: ["double chance"],
  },
  "draw-no-bet": {
    key: "draw-no-bet",
    label: "Draw no bet",
    short: "DNB",
    providerMarketIds: { sportmonks: ["3"], "api-football": ["13"] },
    namePatterns: ["draw no bet"],
  },
  "over-under": {
    key: "over-under",
    label: "Over/under goals",
    short: "O/U",
    providerMarketIds: { sportmonks: ["5"], "api-football": ["36"] },
    namePatterns: ["over/under", "total goals", "goals over/under", "over under"],
  },
  btts: {
    key: "btts",
    label: "Both teams to score",
    short: "BTTS",
    providerMarketIds: { sportmonks: ["14"], "api-football": ["8"] },
    namePatterns: ["both teams to score", "btts"],
  },
  "asian-handicap": {
    key: "asian-handicap",
    label: "Asian handicap",
    short: "AH",
    providerMarketIds: { sportmonks: ["4"], "api-football": ["4"] },
    namePatterns: ["asian handicap", "handicap"],
  },
  corners: {
    key: "corners",
    label: "Corners",
    short: "Corners",
    providerMarketIds: { sportmonks: ["81"], "api-football": ["45"] },
    namePatterns: ["corner"],
  },
  "first-half": {
    key: "first-half",
    label: "First-half markets",
    short: "1st half",
    providerMarketIds: { sportmonks: ["90"], "api-football": ["21"] },
    namePatterns: ["first half", "1st half", "half time result", "ht/ft"],
  },
};

/** Display order used by the market strip and the match centre odds grid. */
export const marketCategoryOrder: MarketCategoryKey[] = [
  "match-winner",
  "double-chance",
  "draw-no-bet",
  "over-under",
  "btts",
  "asian-handicap",
  "corners",
  "first-half",
];

/** Resolve a provider market (id + description) onto a canonical category. */
export function resolveMarketCategory(
  providerId: string,
  marketName: string,
  provider: string,
): MarketCategoryKey | null {
  const name = marketName.toLowerCase();
  for (const key of marketCategoryOrder) {
    const category = marketCategories[key];
    const ids = category.providerMarketIds[provider as "sportmonks" | "api-football"];
    if (ids?.includes(providerId)) return key;
  }
  for (const key of marketCategoryOrder) {
    if (marketCategories[key].namePatterns.some((pattern) => name.includes(pattern))) return key;
  }
  return null;
}
