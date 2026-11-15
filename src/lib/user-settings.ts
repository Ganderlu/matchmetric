import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseFirestore } from "@/lib/firebase";
import { marketCategories } from "@/lib/football/markets";
import type { MarketCategoryKey } from "@/lib/football/types";

export type OddsFormat = "decimal" | "american" | "fractional";
export type TimeFormat = "24h" | "12h";
export type DensityPreference = "comfortable" | "compact";

export interface UserSettings {
  oddsFormat: OddsFormat;
  timeFormat: TimeFormat;
  density: DensityPreference;
  defaultMarkets: MarketCategoryKey[];
  notifySavedPicks: boolean;
  notifyMatchReminders: boolean;
  notifyWeeklyDigest: boolean;
  notifyProductUpdates: boolean;
}

export const defaultUserSettings: UserSettings = {
  oddsFormat: "decimal",
  timeFormat: "24h",
  density: "comfortable",
  defaultMarkets: [],
  notifySavedPicks: true,
  notifyMatchReminders: true,
  notifyWeeklyDigest: false,
  notifyProductUpdates: false,
};

/** Preference document for the signed-in member, which the Firestore rules keep owner-only. */
const PREFERENCES_COLLECTION = "settings";
const PREFERENCES_DOC = "preferences";
const LOCAL_KEY = "matchmetric:user-settings";

const ODDS_FORMATS: OddsFormat[] = ["decimal", "american", "fractional"];
const TIME_FORMATS: TimeFormat[] = ["24h", "12h"];
const DENSITIES: DensityPreference[] = ["comfortable", "compact"];

function isMarketKey(value: unknown): value is MarketCategoryKey {
  return typeof value === "string" && value in marketCategories;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** Normalise an untrusted value (Firestore document or local cache) into valid settings. */
function normalise(value: unknown): UserSettings {
  const source = (value ?? {}) as Record<string, unknown>;
  const markets = Array.isArray(source.defaultMarkets)
    ? source.defaultMarkets.filter(isMarketKey)
    : defaultUserSettings.defaultMarkets;

  return {
    oddsFormat: ODDS_FORMATS.includes(source.oddsFormat as OddsFormat)
      ? (source.oddsFormat as OddsFormat)
      : defaultUserSettings.oddsFormat,
    timeFormat: TIME_FORMATS.includes(source.timeFormat as TimeFormat)
      ? (source.timeFormat as TimeFormat)
      : defaultUserSettings.timeFormat,
    density: DENSITIES.includes(source.density as DensityPreference)
      ? (source.density as DensityPreference)
      : defaultUserSettings.density,
    defaultMarkets: markets,
    notifySavedPicks: pickBoolean(source.notifySavedPicks, defaultUserSettings.notifySavedPicks),
    notifyMatchReminders: pickBoolean(source.notifyMatchReminders, defaultUserSettings.notifyMatchReminders),
    notifyWeeklyDigest: pickBoolean(source.notifyWeeklyDigest, defaultUserSettings.notifyWeeklyDigest),
    notifyProductUpdates: pickBoolean(source.notifyProductUpdates, defaultUserSettings.notifyProductUpdates),
  };
}

export function readCachedSettings(): UserSettings {
  if (typeof window === "undefined") return defaultUserSettings;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? normalise(JSON.parse(raw)) : defaultUserSettings;
  } catch {
    return defaultUserSettings;
  }
}

function writeCachedSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(settings));
  } catch {
    // A blocked or full storage quota should never break the settings screen.
  }
}

export function clearCachedSettings() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Ignore storage failures on reset.
  }
}

/**
 * Load the member's preferences, keeping the local cache as a fast, offline-safe fallback
 * for when Cloud Firestore is not configured or the read fails.
 */
export async function loadUserSettings(uid: string): Promise<UserSettings> {
  if (!firebaseFirestore) return readCachedSettings();
  try {
    const snapshot = await getDoc(doc(firebaseFirestore, "users", uid, PREFERENCES_COLLECTION, PREFERENCES_DOC));
    const settings = snapshot.exists() ? normalise(snapshot.data()) : readCachedSettings();
    writeCachedSettings(settings);
    return settings;
  } catch {
    return readCachedSettings();
  }
}

export async function saveUserSettings(uid: string, settings: UserSettings): Promise<void> {
  writeCachedSettings(settings);
  if (!firebaseFirestore) throw new Error("Cloud Firestore is not configured, so preferences were kept on this device only.");
  await setDoc(
    doc(firebaseFirestore, "users", uid, PREFERENCES_COLLECTION, PREFERENCES_DOC),
    { ...settings, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
