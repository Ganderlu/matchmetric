import "server-only";

import { competitionBySlug, competitionForLeagueId } from "./leagues";
import { marketCategories } from "./markets";
import type { DataSource, Fixture, MatchDetail, MarketCategoryKey } from "./types";
import type {
  FixtureView,
  LeagueView,
  MatchDetailView,
  SamplePreview,
  TeamView,
} from "./views";

/** Maps the normalized domain layer onto the shapes the API routes send to the client. */

export type {
  FixtureFeedView,
  FixtureView,
  LeagueListView,
  LeagueView,
  MatchCentreView,
  MatchDetailView,
  SamplePreview,
  TeamView,
} from "./views";

export function leagueMeta(leagueId: string) {
  const slug = leagueId.split(":")[1] ?? "";
  return competitionForLeagueId(leagueId) ?? competitionBySlug(slug);
}

function toLeagueView(fixture: Fixture, source: DataSource): LeagueView {
  const tracked = leagueMeta(fixture.league.id);
  const view: LeagueView = {
    id: fixture.league.id,
    name: tracked?.name ?? fixture.league.name,
    country: tracked?.country ?? fixture.league.country,
    flag: tracked?.flag ?? "•",
    short: tracked?.short ?? fixture.league.name.slice(0, 3).toUpperCase(),
    provider: fixture.provider,
    available: source === "provider" || source === "cache",
  };
  const logoUrl = fixture.league.logoUrl;
  if (logoUrl) view.logoUrl = logoUrl;
  return view;
}

export function toFixtureView(
  fixture: Fixture,
  source: DataSource,
  sample?: SamplePreview,
): FixtureView {
  const view: FixtureView = {
    id: fixture.id,
    provider: fixture.provider,
    source,
    league: toLeagueView(fixture, source),
    home: toTeamView(fixture.homeTeam),
    away: toTeamView(fixture.awayTeam),
    kickoff: fixture.kickoff,
    status: fixture.status,
    statusLabel: fixture.statusLabel,
  };
  if (fixture.minute !== undefined) view.minute = fixture.minute;
  if (fixture.score) view.score = fixture.score;
  if (fixture.venue) view.venue = fixture.venue;
  if (sample) view.sample = sample;
  return view;
}

function toTeamView(team: { id: string; name: string; shortName?: string; logoUrl?: string }): TeamView {
  const view: TeamView = { id: team.id, name: team.name };
  if (team.shortName) view.short = team.shortName;
  if (team.logoUrl) view.logoUrl = team.logoUrl;
  return view;
}

export function toMatchDetailView(detail: MatchDetail, source: DataSource): MatchDetailView {
  const view: Omit<MatchDetail, "fixture"> & { fixture: FixtureView; source: DataSource } = {
    fixture: toFixtureView(detail.fixture, source),
    homeForm: detail.homeForm,
    awayForm: detail.awayForm,
    events: detail.events,
    sidelined: detail.sidelined,
    odds: detail.odds,
    available: detail.available,
    source,
  };
  if (detail.headToHead) view.headToHead = detail.headToHead;
  if (detail.statistics) view.statistics = detail.statistics;
  if (detail.lineups) view.lineups = detail.lineups;
  return view;
}

/** Market label for a canonical category, e.g. "match-winner" -> "Match winner". */
export function marketLabel(key: MarketCategoryKey): string {
  return marketCategories[key].label;
}
