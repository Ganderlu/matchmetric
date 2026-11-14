import "server-only";

import type {
  Fixture,
  FixtureFeed,
  FixtureQuery,
  MatchDetail,
  ProviderName,
} from "../types";

/** A competition a provider can serve, resolved to a provider-scoped id. */
export interface ProviderCompetition {
  id: string;
  providerId: string;
  name: string;
  country: string;
  flag: string;
  short: string;
}

/**
 * The single contract every football data provider implements.
 *
 * Sportmonks is wired first; API-Football is added by implementing this same interface
 * and registering it in ./index.ts. Nothing outside this folder imports a concrete
 * adapter, so swapping provider never reaches the UI, the routes or Firestore.
 */
export interface FootballProvider {
  readonly name: ProviderName;
  /** False when the credentials this provider needs are missing. Callers must not fetch. */
  readonly configured: boolean;
  listCompetitions(): ProviderCompetition[];
  /**
   * The provider-scoped competition ids the current credential/plan can actually read.
   *
   * Optional: a provider that cannot report this cheaply omits it, and every tracked
   * competition is treated as available. Sportmonks implements it because a free plan
   * exposes only a subset of the tracked competitions, and listing the rest would advertise
   * leagues whose fixture feed is always empty.
   *
   * `null` means "unknown" and must never be treated as "nothing is available".
   */
  listAccessibleCompetitionIds?(): Promise<Set<string> | null>;
  getFixtures(query: FixtureQuery): Promise<FixtureFeed>;
  getFixture(providerId: string): Promise<Fixture | null>;
  getMatchDetail(providerId: string): Promise<MatchDetail | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: ProviderName) {
    super(`${provider} is not configured. Add its API key to the server environment.`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderResponseError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderResponseError";
    this.status = status;
  }
}

/** Every provider degrades identically when it has no credentials. */
export function assertConfigured(provider: FootballProvider): void {
  if (!provider.configured) throw new ProviderNotConfiguredError(provider.name);
}
