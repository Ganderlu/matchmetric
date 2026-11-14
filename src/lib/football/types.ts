/**
 * Normalized football domain types.
 *
 * These shapes are provider-agnostic. Each provider adapter maps its own payload
 * into these types, so the UI, the API routes and the Firestore layer never depend
 * on Sportmonks or API-Football specifics.
 */

export type ProviderName = "sportmonks" | "api-football" | "demo";

/** Canonical market vocabulary for the whole app (see markets.ts for the registry). */
export type MarketCategoryKey =
  | "match-winner"
  | "double-chance"
  | "draw-no-bet"
  | "over-under"
  | "btts"
  | "asian-handicap"
  | "corners"
  | "first-half";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

export interface League {
  /** Provider-scoped stable key, e.g. "sportmonks:8". */
  id: string;
  provider: ProviderName;
  providerId: string;
  name: string;
  country: string;
  logoUrl?: string;
}

export interface Team {
  id: string;
  provider: ProviderName;
  providerId: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
}

export interface FormResult {
  fixtureId: string;
  result: "W" | "D" | "L";
  opponent: string;
  score: string;
  kickoff: string;
  home: boolean;
}

export interface FixtureScore {
  home: number | null;
  away: number | null;
}

export interface Fixture {
  id: string;
  provider: ProviderName;
  providerId: string;
  league: Pick<League, "id" | "name" | "country" | "logoUrl">;
  homeTeam: Team;
  awayTeam: Team;
  /** ISO-8601 UTC kickoff instant. Rendered in the viewer's timezone. */
  kickoff: string;
  status: MatchStatus;
  /** Provider's own status label, e.g. "Not started", "2nd half", "Finished". */
  statusLabel: string;
  minute?: number;
  score?: FixtureScore;
  venue?: string;
}

export interface TeamStatistics {
  teamId: string;
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  yellowCards?: number;
  redCards?: number;
  expectedGoals?: number;
}

export interface MatchStatistics {
  fixtureId: string;
  home: TeamStatistics;
  away: TeamStatistics;
}

/** The numeric keys of `TeamStatistics`, i.e. everything except the team reference. */
export type TeamStatisticField = Exclude<keyof TeamStatistics, "teamId">;

export interface HeadToHeadSummary {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  recent: {
    fixtureId: string;
    kickoff: string;
    homeTeam: string;
    awayTeam: string;
    score: string;
  }[];
}

export interface SidelinedPlayer {
  teamId: string;
  playerName: string;
  kind: "injury" | "suspension" | "other";
  reason?: string;
  since?: string;
}

export interface LineupPlayer {
  playerId: string;
  name: string;
  number?: number;
  position?: string;
  starter: boolean;
}

export interface TeamLineup {
  teamId: string;
  formation?: string;
  coach?: string;
  players: LineupPlayer[];
}

export interface MatchLineups {
  fixtureId: string;
  home?: TeamLineup;
  away?: TeamLineup;
  /** True once the provider marks the lineups as confirmed. */
  confirmed: boolean;
}

export type MatchEventType =
  | "goal"
  | "own-goal"
  | "penalty"
  | "yellow-card"
  | "red-card"
  | "substitution"
  | "var"
  | "other";

export interface MatchEvent {
  id: string;
  minute: number;
  type: MatchEventType;
  teamId?: string;
  playerName?: string;
  detail?: string;
}

export interface OddsSelection {
  label: string;
  price: number;
}

export interface OddsMarket {
  /** Canonical category resolved through the market registry. */
  category: MarketCategoryKey;
  marketId: string;
  name: string;
  bookmaker?: string;
  selections: OddsSelection[];
  /** Provider line modifier, e.g. "+1.5" for handicaps or "2.5" for totals. */
  line?: string;
}

/** Which provider resources were actually available for a match. */
export interface MatchAvailability {
  form: boolean;
  headToHead: boolean;
  statistics: boolean;
  expectedGoals: boolean;
  lineups: boolean;
  events: boolean;
  sidelined: boolean;
  odds: boolean;
}

export interface MatchDetail {
  fixture: Fixture;
  homeForm: FormResult[];
  awayForm: FormResult[];
  headToHead?: HeadToHeadSummary;
  statistics?: MatchStatistics;
  lineups?: MatchLineups;
  events: MatchEvent[];
  sidelined: SidelinedPlayer[];
  odds: OddsMarket[];
  available: MatchAvailability;
}

export interface Pagination {
  page: number;
  perPage: number;
  hasMore: boolean;
}

export interface FixtureFeed {
  fixtures: Fixture[];
  pagination: Pagination;
}

export interface FixtureQuery {
  /** Inclusive ISO date, YYYY-MM-DD. */
  from: string;
  /** Inclusive ISO date, YYYY-MM-DD. */
  to: string;
  leagueIds?: string[];
  statuses?: MatchStatus[];
  page?: number;
  perPage?: number;
}

/** Where a given API response actually came from. Surfaced to the UI. */
export type DataSource = "provider" | "cache" | "demo" | "unconfigured";

export interface MarketCategory {
  key: MarketCategoryKey;
  label: string;
  short: string;
  /** Provider market identifiers. Verified per provider in the provider dashboard. */
  providerMarketIds: Partial<Record<ProviderName, string[]>>;
  /** Lower-cased fragments used to match a provider market name when IDs drift. */
  namePatterns: string[];
}
