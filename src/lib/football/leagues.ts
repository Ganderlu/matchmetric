import type { League, ProviderName } from "./types";

/**
 * The competitions MatchMetric tracks.
 *
 * League names are not unique across providers, so every lookup goes through the
 * provider-scoped competition id below. Never key fixtures off the display name.
 *
 * The Sportmonks ids are their published competition ids; confirm them against the
 * Sportmonks dashboard once an API key is connected, as ids can differ per plan.
 */
export interface TrackedCompetition {
  slug: string;
  name: string;
  country: string;
  flag: string;
  short: string;
  providerIds: Partial<Record<ProviderName, string>>;
}

export const trackedCompetitions: TrackedCompetition[] = [
  { slug: "premier-league", name: "Premier League", country: "England", flag: "🏴", short: "PL", providerIds: { sportmonks: "8", "api-football": "39" } },
  { slug: "la-liga", name: "La Liga", country: "Spain", flag: "🇪🇸", short: "LL", providerIds: { sportmonks: "564", "api-football": "140" } },
  { slug: "bundesliga", name: "Bundesliga", country: "Germany", flag: "🇩🇪", short: "BL", providerIds: { sportmonks: "82", "api-football": "78" } },
  { slug: "serie-a", name: "Serie A", country: "Italy", flag: "🇮🇹", short: "SA", providerIds: { sportmonks: "384", "api-football": "135" } },
  { slug: "ligue-1", name: "Ligue 1", country: "France", flag: "🇫🇷", short: "L1", providerIds: { sportmonks: "301", "api-football": "61" } },
  { slug: "champions-league", name: "Champions League", country: "Europe", flag: "✦", short: "CL", providerIds: { sportmonks: "2", "api-football": "2" } },
  { slug: "europa-league", name: "Europa League", country: "Europe", flag: "◆", short: "UEL", providerIds: { sportmonks: "5", "api-football": "3" } },
  // The two competitions Sportmonks' Football Free Plan actually exposes. Their Sportmonks
  // ids are verified against /v3/football/leagues; the api-football ids are deliberately
  // omitted rather than guessed, so these rows simply do not appear when that provider is
  // active.
  { slug: "superliga", name: "Superliga", country: "Denmark", flag: "🇩🇰", short: "SL", providerIds: { sportmonks: "271" } },
  { slug: "scottish-premiership", name: "Scottish Premiership", country: "Scotland", flag: "🏴", short: "SP", providerIds: { sportmonks: "501" } },
];

export function competitionBySlug(slug: string): TrackedCompetition | undefined {
  return trackedCompetitions.find((competition) => competition.slug === slug);
}

/** Sportmonks competition id for a competition, or undefined when unmapped. */
export function providerCompetitionId(slug: string, provider: ProviderName): string | undefined {
  return competitionBySlug(slug)?.providerIds[provider];
}

export function providerLeagueId(slug: string, provider: ProviderName): string | undefined {
  const providerId = competitionBySlug(slug)?.providerIds[provider];
  return providerId ? `${provider}:${providerId}` : undefined;
}

/** Resolve a provider-scoped league id back to the tracked competition. */
export function competitionForLeagueId(leagueId: string): TrackedCompetition | undefined {
  const [provider, providerId] = leagueId.split(":");
  if (!provider || !providerId) return undefined;
  return trackedCompetitions.find(
    (competition) => competition.providerIds[provider as ProviderName] === providerId,
  );
}

export function competitionToLeague(
  competition: TrackedCompetition,
  provider: ProviderName,
): League | null {
  const providerId = competition.providerIds[provider];
  if (!providerId) return null;
  return {
    id: `${provider}:${providerId}`,
    provider,
    providerId,
    name: competition.name,
    country: competition.country,
  };
}

/** The tracked competitions a provider can serve. */
export function competitionsForProvider(provider: ProviderName): TrackedCompetition[] {
  return trackedCompetitions.filter((competition) => competition.providerIds[provider]);
}
