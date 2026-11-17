import { marketCategoryOrder } from "@/lib/football/markets";
import type { MarketCategoryKey } from "@/lib/football/types";
import { trackedCompetitions } from "@/lib/football/leagues";

/**
 * The signed-in member's profile and preferences, stored at `users/{userId}`.
 *
 * Everything here is either entered by the member or derived from their Firebase
 * account. Nothing is fabricated: unknown or malformed values fall back to the
 * defaults below rather than inventing account details.
 */

export type MembershipTier = "free" | "plus" | "pro";
export type PredictionCategory = "highest_probability" | "best_value";
export type ThemePreference = "dark" | "light" | "system";
export type ProbabilityDisplay = "percent" | "decimal";
export type DashboardFilter = "all" | "live" | "upcoming";

export interface DashboardPreferences {
  /** Highlight fixtures that involve one of the member's favourite teams. */
  highlightFavouriteTeams: boolean;
  /** The filter the dashboard opens on. */
  defaultFilter: DashboardFilter;
  /** Show live fixtures above upcoming ones. */
  liveFirst: boolean;
}

export interface PredictionPreferences {
  /** Changes the default view only, never the engine's calculation. */
  defaultCategory: PredictionCategory;
  preferredMarkets: MarketCategoryKey[];
  defaultPickCount: number;
  /** Competition slugs the Auto Picks workflow pre-selects. */
  defaultCompetitions: string[];
  oneSelectionPerLeague: boolean;
  showConfidenceIndicator: boolean;
  showAdvancedAnalysis: boolean;
  probabilityDisplay: ProbabilityDisplay;
}

export interface NotificationPreferences {
  /** Master switch. When off, every delivery below is suppressed. */
  enabled: boolean;
  matchStarting: boolean;
  matchLive: boolean;
  matchFinished: boolean;
  analysisCompleted: boolean;
  predictionUpdated: boolean;
  predictionSettled: boolean;
  savedPredictionResult: boolean;
  accountSecurity: boolean;
  accountChanges: boolean;
  platformAnnouncements: boolean;
}

export interface AppearancePreferences {
  theme: ThemePreference;
  oddsFormat: "decimal" | "american" | "fractional";
}

export interface UserProfile {
  uid: string;
  displayName: string;
  username?: string;
  email: string;
  photoURL?: string;

  membershipTier: MembershipTier;

  favouriteTeams: string[];
  /** Competition slugs from `trackedCompetitions`. */
  favouriteCompetitions: string[];

  dashboard: DashboardPreferences;
  predictionPreferences: PredictionPreferences;
  notificationPreferences: NotificationPreferences;
  appearancePreferences: AppearancePreferences;

  createdAt?: string;
  updatedAt?: string;
}

export const MIN_PICK_COUNT = 1;
export const MAX_PICK_COUNT = 12;
export const MAX_FAVOURITE_TEAMS = 24;
export const MAX_FAVOURITE_COMPETITIONS = 12;
export const MAX_TEAM_NAME_LENGTH = 48;

export function defaultUserProfile(
  uid: string,
  email: string,
  displayName = "",
  photoURL?: string,
): UserProfile {
  return {
    uid,
    displayName: displayName.trim(),
    email,
    photoURL,
    membershipTier: "free",
    favouriteTeams: [],
    favouriteCompetitions: [],
    dashboard: {
      highlightFavouriteTeams: true,
      defaultFilter: "all",
      liveFirst: true,
    },
    predictionPreferences: {
      defaultCategory: "highest_probability",
      preferredMarkets: [],
      defaultPickCount: 3,
      defaultCompetitions: [],
      oneSelectionPerLeague: false,
      showConfidenceIndicator: true,
      showAdvancedAnalysis: true,
      probabilityDisplay: "percent",
    },
    notificationPreferences: {
      enabled: true,
      matchStarting: true,
      matchLive: true,
      matchFinished: true,
      analysisCompleted: true,
      predictionUpdated: true,
      predictionSettled: true,
      savedPredictionResult: true,
      accountSecurity: true,
      accountChanges: true,
      platformAnnouncements: false,
    },
    appearancePreferences: {
      theme: "dark",
      oddsFormat: "decimal",
    },
  };
}

const MEMBERSHIP_TIERS: MembershipTier[] = ["free", "plus", "pro"];
const PREDICTION_CATEGORIES: PredictionCategory[] = ["highest_probability", "best_value"];
const THEMES: ThemePreference[] = ["dark", "light", "system"];
const PROBABILITY_DISPLAYS: ProbabilityDisplay[] = ["percent", "decimal"];
const DASHBOARD_FILTERS: DashboardFilter[] = ["all", "live", "upcoming"];
const ODDS_FORMATS: AppearancePreferences["oddsFormat"][] = ["decimal", "american", "fractional"];

const COMPETITION_SLUGS = new Set(trackedCompetitions.map((competition) => competition.slug));
const MARKET_KEYS = new Set<string>(marketCategoryOrder);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function pickString(value: unknown, fallback: string, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : fallback;
}

function pickNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function pickStringList(value: unknown, allowed?: Set<string>, max = 32, maxLength = 64): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim().slice(0, maxLength);
    if (!trimmed) continue;
    if (allowed && !allowed.has(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
    if (output.length >= max) break;
  }
  return output;
}

/**
 * Normalise an untrusted value (a Firestore document or a cached blob) into a valid
 * profile. `base` carries the details only Firebase Auth can be trusted for.
 */
export function normaliseUserProfile(value: unknown, base: UserProfile): UserProfile {
  const source = asRecord(value);
  const dashboard = asRecord(source.dashboard);
  const prediction = asRecord(source.predictionPreferences);
  const notifications = asRecord(source.notificationPreferences);
  const appearance = asRecord(source.appearancePreferences);
  const defaults = defaultUserProfile(base.uid, base.email, base.displayName, base.photoURL);

  return {
    uid: base.uid,
    email: base.email,
    displayName: pickString(source.displayName, base.displayName, 60),
    username: source.username === undefined ? undefined : pickString(source.username, "", 24) || undefined,
    photoURL: pickString(source.photoURL, base.photoURL ?? "", 500) || undefined,
    membershipTier: pickEnum(source.membershipTier, MEMBERSHIP_TIERS, defaults.membershipTier),
    favouriteTeams: pickStringList(source.favouriteTeams, undefined, MAX_FAVOURITE_TEAMS, MAX_TEAM_NAME_LENGTH),
    favouriteCompetitions: pickStringList(
      source.favouriteCompetitions,
      COMPETITION_SLUGS,
      MAX_FAVOURITE_COMPETITIONS,
    ),
    dashboard: {
      highlightFavouriteTeams: pickBoolean(
        dashboard.highlightFavouriteTeams,
        defaults.dashboard.highlightFavouriteTeams,
      ),
      defaultFilter: pickEnum(dashboard.defaultFilter, DASHBOARD_FILTERS, defaults.dashboard.defaultFilter),
      liveFirst: pickBoolean(dashboard.liveFirst, defaults.dashboard.liveFirst),
    },
    predictionPreferences: {
      defaultCategory: pickEnum(
        prediction.defaultCategory,
        PREDICTION_CATEGORIES,
        defaults.predictionPreferences.defaultCategory,
      ),
      preferredMarkets: pickStringList(
        prediction.preferredMarkets,
        MARKET_KEYS,
        marketCategoryOrder.length,
        40,
      ) as MarketCategoryKey[],
      defaultPickCount: pickNumber(
        prediction.defaultPickCount,
        defaults.predictionPreferences.defaultPickCount,
        MIN_PICK_COUNT,
        MAX_PICK_COUNT,
      ),
      defaultCompetitions: pickStringList(
        prediction.defaultCompetitions,
        COMPETITION_SLUGS,
        MAX_FAVOURITE_COMPETITIONS,
      ),
      oneSelectionPerLeague: pickBoolean(
        prediction.oneSelectionPerLeague,
        defaults.predictionPreferences.oneSelectionPerLeague,
      ),
      showConfidenceIndicator: pickBoolean(
        prediction.showConfidenceIndicator,
        defaults.predictionPreferences.showConfidenceIndicator,
      ),
      showAdvancedAnalysis: pickBoolean(
        prediction.showAdvancedAnalysis,
        defaults.predictionPreferences.showAdvancedAnalysis,
      ),
      probabilityDisplay: pickEnum(
        prediction.probabilityDisplay,
        PROBABILITY_DISPLAYS,
        defaults.predictionPreferences.probabilityDisplay,
      ),
    },
    notificationPreferences: {
      enabled: pickBoolean(notifications.enabled, defaults.notificationPreferences.enabled),
      matchStarting: pickBoolean(notifications.matchStarting, defaults.notificationPreferences.matchStarting),
      matchLive: pickBoolean(notifications.matchLive, defaults.notificationPreferences.matchLive),
      matchFinished: pickBoolean(notifications.matchFinished, defaults.notificationPreferences.matchFinished),
      analysisCompleted: pickBoolean(
        notifications.analysisCompleted,
        defaults.notificationPreferences.analysisCompleted,
      ),
      predictionUpdated: pickBoolean(
        notifications.predictionUpdated,
        defaults.notificationPreferences.predictionUpdated,
      ),
      predictionSettled: pickBoolean(
        notifications.predictionSettled,
        defaults.notificationPreferences.predictionSettled,
      ),
      savedPredictionResult: pickBoolean(
        notifications.savedPredictionResult,
        defaults.notificationPreferences.savedPredictionResult,
      ),
      accountSecurity: pickBoolean(
        notifications.accountSecurity,
        defaults.notificationPreferences.accountSecurity,
      ),
      accountChanges: pickBoolean(notifications.accountChanges, defaults.notificationPreferences.accountChanges),
      platformAnnouncements: pickBoolean(
        notifications.platformAnnouncements,
        defaults.notificationPreferences.platformAnnouncements,
      ),
    },
    appearancePreferences: {
      theme: pickEnum(appearance.theme, THEMES, defaults.appearancePreferences.theme),
      oddsFormat: pickEnum(appearance.oddsFormat, ODDS_FORMATS, defaults.appearancePreferences.oddsFormat),
    },
    createdAt: typeof source.createdAt === "string" ? source.createdAt : base.createdAt,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : base.updatedAt,
  };
}

/** Trim + validate a team name typed by the member. Returns null when unusable. */
export function cleanTeamName(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ").slice(0, MAX_TEAM_NAME_LENGTH);
  return trimmed.length >= 2 ? trimmed : null;
}

/** Trim + validate a username. Returns null when unusable. */
export function cleanUsername(value: string): string | null {
  const trimmed = value.trim().replace(/^@+/, "").slice(0, 24);
  return /^[a-zA-Z0-9._-]{3,24}$/.test(trimmed) ? trimmed : null;
}
