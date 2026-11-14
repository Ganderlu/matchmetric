import "server-only";

import type { ProviderName } from "../types";
import { createApiFootballProvider } from "./api-football";
import { createDemoProvider } from "./demo";
import { createSportmonksProvider } from "./sportmonks";
import type { FootballProvider } from "./types";

/** The server-side environment variable each provider reads its credential from. */
export const PROVIDER_ENV_KEYS: Record<ProviderName, string | null> = {
  sportmonks: "SPORTMONKS_API_KEY",
  "api-football": "APIFOOTBALL_API_KEY",
  demo: null,
};

/**
 * Which provider to use.
 *
 * `FOOTBALL_PROVIDER` wins when set; otherwise the first provider with a credential is
 * used, and Sportmonks is the declared default so the app is ready the moment a key is
 * added. With no key at all the app reports `unconfigured` and falls back to mock data.
 */
export function resolveProviderName(): ProviderName {
  const requested = process.env.FOOTBALL_PROVIDER?.trim().toLowerCase();
  if (requested === "demo" || requested === "sportmonks" || requested === "api-football") {
    return requested;
  }
  if (process.env.SPORTMONKS_API_KEY) return "sportmonks";
  if (process.env.APIFOOTBALL_API_KEY) return "api-football";
  return "sportmonks";
}

export function getProvider(name?: ProviderName): FootballProvider {
  switch (name ?? resolveProviderName()) {
    case "api-football":
      return createApiFootballProvider(process.env.APIFOOTBALL_API_KEY);
    case "demo":
      return createDemoProvider();
    default:
      return createSportmonksProvider(process.env.SPORTMONKS_API_KEY);
  }
}

export type { FootballProvider } from "./types";
