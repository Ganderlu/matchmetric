import type {
  DataSource,
  FixtureScore,
  FormResult,
  MatchDetail,
  MatchStatus,
  ProviderName,
} from "./types";

/**
 * Presentation shapes exchanged between the API routes and the client.
 *
 * This module is deliberately free of `server-only` so the dashboard can type the JSON it
 * receives. The provider payload never crosses the boundary: these views already carry the
 * display metadata (competition flag, abbreviation) and the `source` the data came from,
 * so the UI can label mock data honestly.
 */

export interface LeagueView {
  id: string;
  name: string;
  country: string;
  flag: string;
  short: string;
  logoUrl?: string;
  provider: ProviderName;
  /** True only when a live provider backs this competition. */
  available: boolean;
}

export interface TeamView {
  /** Provider-scoped team id, so match-centre sections can be grouped by team. */
  id: string;
  name: string;
  short?: string;
  logoUrl?: string;
}

/** Mock-only preview attached to demo fixtures so the layout can be exercised. */
export interface SamplePreview {
  marketLabel: string;
  pick: string;
  note: string;
  /** Mock-only recent form, rendered behind the same "Mock data" label. */
  homeForm?: ("W" | "D" | "L")[];
  awayForm?: ("W" | "D" | "L")[];
}

export interface FixtureView {
  id: string;
  provider: ProviderName;
  source: DataSource;
  league: LeagueView;
  home: TeamView;
  away: TeamView;
  /** ISO-8601 UTC instant; the client renders it in the viewer's timezone. */
  kickoff: string;
  status: MatchStatus;
  statusLabel: string;
  minute?: number;
  score?: FixtureScore;
  venue?: string;
  /** Only populated when the match centre has already been loaded for this fixture. */
  form?: { home: FormResult[]; away: FormResult[] };
  sample?: SamplePreview;
}

export type MatchDetailView = Omit<MatchDetail, "fixture"> & {
  fixture: FixtureView;
  source: DataSource;
};

export interface FixtureFeedView {
  fixtures: FixtureView[];
  source: DataSource;
  provider: ProviderName;
  page: number;
  perPage: number;
  hasMore: boolean;
  /** Human-readable explanation when the app is running without a provider key. */
  notice?: string;
}

export interface MatchCentreView {
  detail: MatchDetailView | null;
  source: DataSource;
  notice?: string;
}

export interface LeagueListView {
  leagues: LeagueView[];
  provider: ProviderName;
  source: DataSource;
}
