import "server-only";

import { competitionForLeagueId, competitionsForProvider } from "../leagues";
import { resolveMarketCategory } from "../markets";
import type {
  Fixture,
  FixtureFeed,
  FixtureQuery,
  FormResult,
  HeadToHeadSummary,
  League,
  LineupPlayer,
  MatchAvailability,
  MatchDetail,
  MatchEvent,
  MatchEventType,
  MatchLineups,
  MatchStatistics,
  MatchStatus,
  OddsMarket,
  OddsSelection,
  SidelinedPlayer,
  Team,
  TeamLineup,
  TeamStatisticField,
  TeamStatistics,
} from "../types";
import { providerFetchJson } from "./http";
import { clampPage, toNumber } from "./shared";
import {
  ProviderResponseError,
  type FootballProvider,
  type ProviderCompetition,
} from "./types";

/**
 * API-Football (v3) adapter - the alternate provider.
 *
 * It implements the same `FootballProvider` contract as Sportmonks, so switching is a
 * configuration change only: set `FOOTBALL_PROVIDER=api-football` and `APIFOOTBALL_API_KEY`.
 *
 * Two deliberate differences from the Sportmonks adapter:
 *  - Market categories resolve by **name first**, because the provider's numeric bet ids
 *    change between documentation revisions. The id table in markets.ts is the fallback.
 *  - `/fixtures?from=&to=` returns every competition, so results are filtered down to the
 *    tracked competition ids before they leave this module.
 */
const BASE_URL = "https://v3.football.api-sports.io";
const PROVIDER = "api-football" as const;

const STATUS_MAP: Record<string, MatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  HT: "halftime",
  "2H": "live",
  ET: "live",
  BT: "halftime",
  P: "live",
  SUSP: "postponed",
  INT: "live",
  LIVE: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "cancelled",
  AWD: "finished",
  WO: "finished",
};

const STATISTIC_FIELDS: Record<string, TeamStatisticField> = {
  "ball possession": "possession",
  "total shots": "shots",
  "shots on goal": "shotsOnTarget",
  "corner kicks": "corners",
  fouls: "fouls",
  offsides: "offsides",
  "yellow cards": "yellowCards",
  "red cards": "redCards",
  expected_goals: "expectedGoals",
};

interface AfEnvelope<T> {
  errors?: unknown;
  results?: number;
  paging?: { current?: number; total?: number };
  response?: T[];
}

interface AfFixtureEntry {
  fixture?: {
    id?: number;
    date?: string | null;
    timestamp?: number | null;
    venue?: { name?: string | null } | null;
    status?: {
      long?: string | null;
      short?: string | null;
      elapsed?: number | null;
    } | null;
  } | null;
  league?: {
    id?: number;
    name?: string;
    logo?: string | null;
    country?: string | null;
  } | null;
  teams?: {
    home?: { id?: number; name?: string; logo?: string | null } | null;
    away?: { id?: number; name?: string; logo?: string | null } | null;
  } | null;
  goals?: { home?: number | null; away?: number | null } | null;
}

interface AfEventEntry {
  time?: { elapsed?: number | null; extra?: number | null } | null;
  team?: { id?: number | null } | null;
  player?: { name?: string | null } | null;
  assist?: { name?: string | null } | null;
  type?: string | null;
  detail?: string | null;
}

interface AfStatisticsEntry {
  team?: { id?: number | null } | null;
  statistics?: { type?: string | null; value?: number | string | null }[] | null;
}

interface AfLineupEntry {
  team?: { id?: number | null } | null;
  formation?: string | null;
  coach?: { name?: string | null } | null;
  startXI?: { player?: { id?: number; name?: string; number?: number | null; pos?: string | null } | null }[] | null;
  substitutes?: { player?: { id?: number; name?: string; number?: number | null; pos?: string | null } | null }[] | null;
}

interface AfInjuryEntry {
  team?: { id?: number | null } | null;
  player?: { name?: string | null; reason?: string | null } | null;
  fixture?: { id?: number | null } | null;
  type?: string | null;
  reason?: string | null;
}

interface AfOddsEntry {
  bookmakers?: {
    name?: string | null;
    bets?: { id?: number | null; name?: string | null; values?: { value?: string | number | null; odd?: string | number | null }[] | null }[] | null;
  }[] | null;
}

export function createApiFootballProvider(apiKey: string | undefined): FootballProvider {
  const key = apiKey?.trim();

  const request = async <T>(path: string): Promise<T[]> => {
    const payload = await providerFetchJson<AfEnvelope<T>>(`${BASE_URL}${path}`, {
      provider: PROVIDER,
      apiKey: key ?? "",
      auth: { header: "x-apisports-key" },
    });
    assertNoErrors(payload);
    return payload.response ?? [];
  };

  /**
   * API-Football only accepts a season alongside a league id, and European seasons straddle
   * the calendar year. Infer the season from the fixture date rather than from "now".
   */
  const seasonFor = (date: Date) => date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;

  const provider: FootballProvider = {
    name: PROVIDER,
    configured: Boolean(key),

    listCompetitions(): ProviderCompetition[] {
      return competitionsForProvider(PROVIDER).map((competition) => ({
        id: `${PROVIDER}:${competition.providerIds[PROVIDER]}`,
        providerId: competition.providerIds[PROVIDER] ?? "",
        name: competition.name,
        country: competition.country,
        flag: competition.flag,
        short: competition.short,
      }));
    },

    async getFixtures(query: FixtureQuery): Promise<FixtureFeed> {
      const page = clampPage(query.page, 1, 50);
      const requested = (query.leagueIds ?? [])
        .map((leagueId) => leagueId.split(":")[1])
        .filter((id): id is string => Boolean(id));
      const tracked = trackedProviderIds();

      const params = new URLSearchParams({ from: query.from, to: query.to, timezone: "UTC" });
      // A single tracked league is cheap to scope server-side; otherwise fetch the range and
      // narrow it here so one request covers every league in the date window.
      if (requested.length === 1) {
        params.set("league", requested[0]);
        params.set("season", String(seasonFor(new Date(`${query.from}T00:00:00Z`))));
      }
      params.set("page", String(page));

      const entries = await request<AfFixtureEntry>(`/fixtures?${params.toString()}`);

      const allowed = requested.length ? new Set(requested) : tracked;
      const fixtures = entries
        .map(toFixture)
        .filter((fixture): fixture is Fixture => fixture !== null)
        .filter((fixture) => allowed.has(fixture.league.id.split(":")[1] ?? ""))
        .filter((fixture) => (query.statuses?.length ? query.statuses.includes(fixture.status) : true))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

      return {
        fixtures,
        pagination: { page, perPage: fixtures.length, hasMore: false },
      };
    },

    async getFixture(providerId: string): Promise<Fixture | null> {
      const entries = await request<AfFixtureEntry>(
        `/fixtures?id=${encodeURIComponent(providerId)}`,
      );
      const entry = entries[0];
      return entry ? toFixture(entry) : null;
    },

    async getMatchDetail(providerId: string): Promise<MatchDetail | null> {
      const entries = await request<AfFixtureEntry>(
        `/fixtures?id=${encodeURIComponent(providerId)}`,
      );
      const entry = entries[0];
      if (!entry) return null;

      const fixture = toFixture(entry);
      if (!fixture) return null;

      const homeId = fixture.homeTeam.providerId;
      const awayId = fixture.awayTeam.providerId;

      const [homeRecent, awayRecent, headToHead, statistics, lineups, events, sidelined, odds] =
        await Promise.all([
          guard(() => request<AfFixtureEntry>(`/fixtures?team=${homeId}&last=5`)),
          guard(() => request<AfFixtureEntry>(`/fixtures?team=${awayId}&last=5`)),
          guard(() => fetchHeadToHead(homeId, awayId)),
          guard(() => request<AfStatisticsEntry>(`/fixtures/statistics?fixture=${providerId}`)),
          guard(() => request<AfLineupEntry>(`/fixtures/lineups?fixture=${providerId}`)),
          guard(() => request<AfEventEntry>(`/fixtures/events?fixture=${providerId}`)),
          guard(() => request<AfInjuryEntry>(`/injuries?fixture=${providerId}`)),
          guard(() => fetchOdds(providerId)),
        ]);

      const homeForm = buildForm(homeRecent ?? [], homeId);
      const awayForm = buildForm(awayRecent ?? [], awayId);
      const matchStatistics = toStatistics(statistics ?? [], fixture.id, homeId, awayId);
      const matchEvents = (events ?? []).map((event, index) => toEvent(event, fixture.id, index));
      const matchLineups = toLineups(lineups ?? [], fixture.id, homeId, awayId);
      const sidelinedPlayers = (sidelined ?? []).map(toSidelined).filter((entry): entry is SidelinedPlayer => entry !== null);
      const oddsMarkets = odds ?? [];

      const available: MatchAvailability = {
        form: homeForm.length > 0 || awayForm.length > 0,
        headToHead: Boolean(headToHead),
        statistics: Boolean(matchStatistics),
        expectedGoals:
          matchStatistics?.home.expectedGoals !== undefined ||
          matchStatistics?.away.expectedGoals !== undefined,
        lineups: Boolean(matchLineups),
        events: matchEvents.length > 0,
        sidelined: sidelinedPlayers.length > 0,
        odds: oddsMarkets.length > 0,
      };

      const detail: MatchDetail = {
        fixture,
        homeForm,
        awayForm,
        events: matchEvents,
        sidelined: sidelinedPlayers,
        odds: oddsMarkets,
        available,
      };
      if (headToHead) detail.headToHead = headToHead;
      if (matchStatistics) detail.statistics = matchStatistics;
      if (matchLineups) detail.lineups = matchLineups;
      return detail;
    },
  };

  async function fetchHeadToHead(
    homeProviderId: string,
    awayProviderId: string,
  ): Promise<HeadToHeadSummary | undefined> {
    if (!homeProviderId || !awayProviderId) return undefined;

    const entries = await request<AfFixtureEntry>(
      `/fixtures/headtohead?h2h=${homeProviderId}-${awayProviderId}&last=10`,
    );
    const played = entries
      .map(toFixture)
      .filter((fixture): fixture is Fixture => fixture !== null)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    if (!played.length) return undefined;

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    for (const fixture of played) {
      const homeScore = fixture.score?.home;
      const awayScore = fixture.score?.away;
      if (typeof homeScore !== "number" || typeof awayScore !== "number") continue;
      const homeIsHome = fixture.homeTeam.providerId === homeProviderId;
      const margin = homeIsHome ? homeScore - awayScore : awayScore - homeScore;
      if (margin > 0) homeWins += 1;
      else if (margin < 0) awayWins += 1;
      else draws += 1;
    }

    return {
      played: played.length,
      homeWins,
      draws,
      awayWins,
      recent: played
        .slice(-5)
        .reverse()
        .map((fixture) => ({
          fixtureId: fixture.id,
          kickoff: fixture.kickoff,
          homeTeam: fixture.homeTeam.name,
          awayTeam: fixture.awayTeam.name,
          score: `${fixture.score?.home ?? "-"}-${fixture.score?.away ?? "-"}`,
        })),
    };
  }

  async function fetchOdds(providerId: string): Promise<OddsMarket[]> {
    const entries = await request<AfOddsEntry>(`/odds?fixture=${encodeURIComponent(providerId)}`);
    const markets = new Map<string, OddsMarket>();

    for (const entry of entries) {
      for (const bookmaker of entry.bookmakers ?? []) {
        for (const bet of bookmaker.bets ?? []) {
          const name = bet.name ?? "";
          // Name first: the provider's numeric bet ids drift between doc revisions.
          const category =
            resolveMarketCategory("", name, PROVIDER) ??
            resolveMarketCategory(String(bet.id ?? ""), name, PROVIDER);
          if (!category) continue;

          const groupKey = `${category}:${bet.id ?? name}:${bookmaker.name ?? ""}`;
          const market: OddsMarket = markets.get(groupKey) ?? {
            category,
            marketId: String(bet.id ?? name),
            name: name || category,
            selections: [],
          };
          if (bookmaker.name) market.bookmaker = bookmaker.name;

          for (const value of bet.values ?? []) {
            const price = toNumber(value.odd);
            if (price === undefined) continue;
            const selection: OddsSelection = {
              label: String(value.value ?? "Selection").trim() || "Selection",
              price,
            };
            market.selections.push(selection);
          }

          if (market.selections.length >= 2) markets.set(groupKey, market);
        }
      }
    }

    return [...markets.values()];
  }

  function trackedProviderIds(): Set<string> {
    return new Set(
      competitionsForProvider(PROVIDER)
        .map((competition) => competition.providerIds[PROVIDER])
        .filter((id): id is string => Boolean(id)),
    );
  }

  return provider;
}

function assertNoErrors(payload: { errors?: unknown }) {
  const { errors } = payload;
  if (!errors) return;

  if (Array.isArray(errors)) {
    if (errors.length) throw new ProviderResponseError(`api-football: ${String(errors[0])}`);
    return;
  }

  if (typeof errors === "string") {
    if (errors) throw new ProviderResponseError(`api-football: ${errors}`);
    return;
  }

  if (typeof errors === "object") {
    const values = Object.values(errors as Record<string, unknown>).filter(Boolean);
    if (values.length) throw new ProviderResponseError(`api-football: ${values.join("; ")}`);
  }
}

async function guard<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

// ---- normalisation ---------------------------------------------------------

function toFixture(entry: AfFixtureEntry): Fixture | null {
  const raw = entry.fixture;
  const home = entry.teams?.home;
  const away = entry.teams?.away;
  if (!raw?.id || !home?.id || !away?.id) return null;

  const kickoffSource =
    typeof raw.timestamp === "number" ? new Date(raw.timestamp * 1000) : raw.date ? new Date(raw.date) : null;
  if (!kickoffSource || Number.isNaN(kickoffSource.getTime())) return null;

  const short = (raw.status?.short ?? "").toUpperCase();

  const fixture: Fixture = {
    id: `${PROVIDER}:${raw.id}`,
    provider: PROVIDER,
    providerId: String(raw.id),
    league: toLeagueRef(entry.league),
    homeTeam: toTeam(home),
    awayTeam: toTeam(away),
    kickoff: kickoffSource.toISOString(),
    status: STATUS_MAP[short] ?? "unknown",
    statusLabel: raw.status?.long?.trim() || "Status unavailable",
  };

  if (typeof raw.status?.elapsed === "number") fixture.minute = raw.status.elapsed;

  const homeGoals = toNumber(entry.goals?.home);
  const awayGoals = toNumber(entry.goals?.away);
  if (homeGoals !== undefined || awayGoals !== undefined) {
    fixture.score = { home: homeGoals ?? null, away: awayGoals ?? null };
  }

  if (raw.venue?.name) fixture.venue = raw.venue.name;
  return fixture;
}

function toLeagueRef(raw: AfFixtureEntry["league"]): Fixture["league"] {
  const providerId = String(raw?.id ?? "");
  const tracked = providerId ? competitionForLeagueId(`${PROVIDER}:${providerId}`) : undefined;

  const league: Pick<League, "id" | "name" | "country" | "logoUrl"> = {
    id: `${PROVIDER}:${providerId}`,
    name: tracked?.name ?? raw?.name ?? "Competition",
    country: tracked?.country ?? raw?.country ?? "",
  };
  if (raw?.logo) league.logoUrl = raw.logo;
  return league;
}

function toTeam(raw: { id?: number; name?: string; logo?: string | null }): Team {
  const team: Team = {
    id: `${PROVIDER}:${raw.id ?? "unknown"}`,
    provider: PROVIDER,
    providerId: String(raw.id ?? ""),
    name: raw.name ?? "Unknown team",
  };
  if (raw.logo) team.logoUrl = raw.logo;
  return team;
}

function toStatistics(
  entries: AfStatisticsEntry[],
  fixtureId: string,
  homeProviderId: string,
  awayProviderId: string,
): MatchStatistics | undefined {
  const home: TeamStatistics = { teamId: `${PROVIDER}:${homeProviderId}` };
  const away: TeamStatistics = { teamId: `${PROVIDER}:${awayProviderId}` };
  let matched = 0;

  for (const entry of entries) {
    const teamProviderId = String(entry.team?.id ?? "");
    if (!teamProviderId) continue;
    const target = teamProviderId === homeProviderId ? home : away;

    for (const statistic of entry.statistics ?? []) {
      const field = STATISTIC_FIELDS[(statistic.type ?? "").toLowerCase()];
      if (!field) continue;
      const value = parseStatisticValue(statistic.value);
      if (value === undefined) continue;
      target[field] = value;
      matched += 1;
    }
  }

  return matched ? { fixtureId, home, away } : undefined;
}

/** Possession arrives as "52%"; every other statistic arrives as a number. */
function parseStatisticValue(value: number | string | null | undefined): number | undefined {
  if (typeof value === "string" && value.endsWith("%")) return toNumber(value.slice(0, -1));
  return toNumber(value);
}

function toEvent(entry: AfEventEntry, fixtureId: string, index: number): MatchEvent {
  const type = (entry.type ?? "").toLowerCase();
  const detail = (entry.detail ?? "").toLowerCase();

  let mapped: MatchEventType = "other";
  if (type === "goal") {
    mapped = detail.includes("own") ? "own-goal" : detail.includes("penalty") ? "penalty" : "goal";
  } else if (type === "card") {
    mapped = detail.includes("red") ? "red-card" : "yellow-card";
  } else if (type === "subst") {
    mapped = "substitution";
  } else if (type === "var") {
    mapped = "var";
  }

  const event: MatchEvent = {
    id: `${PROVIDER}:event:${fixtureId}:${index}`,
    minute: (entry.time?.elapsed ?? 0) + (entry.time?.extra ?? 0),
    type: mapped,
  };
  if (entry.player?.name) event.playerName = entry.player.name;
  if (entry.team?.id) event.teamId = `${PROVIDER}:${entry.team.id}`;
  if (entry.detail) event.detail = entry.detail;
  return event;
}

function toLineups(
  entries: AfLineupEntry[],
  fixtureId: string,
  homeProviderId: string,
  awayProviderId: string,
): MatchLineups | undefined {
  const build = (providerId: string): TeamLineup | undefined => {
    const entry = entries.find((candidate) => String(candidate.team?.id ?? "") === providerId);
    if (!entry) return undefined;

    const starters: LineupPlayer[] = (entry.startXI ?? [])
      .map(({ player }) => toLineupPlayer(player, true))
      .filter((player): player is LineupPlayer => player !== null);
    const substitutes: LineupPlayer[] = (entry.substitutes ?? [])
      .map(({ player }) => toLineupPlayer(player, false))
      .filter((player): player is LineupPlayer => player !== null);

    if (!starters.length && !substitutes.length) return undefined;

    const lineup: TeamLineup = {
      teamId: `${PROVIDER}:${providerId}`,
      players: [...starters, ...substitutes],
    };
    if (entry.formation) lineup.formation = entry.formation;
    if (entry.coach?.name) lineup.coach = entry.coach.name;
    return lineup;
  };

  const home = build(homeProviderId);
  const away = build(awayProviderId);
  if (!home && !away) return undefined;

  const lineups: MatchLineups = { fixtureId, confirmed: true };
  if (home) lineups.home = home;
  if (away) lineups.away = away;
  return lineups;
}

function toLineupPlayer(
  raw: { id?: number; name?: string; number?: number | null; pos?: string | null } | null | undefined,
  starter: boolean,
): LineupPlayer | null {
  if (!raw?.id && !raw?.name) return null;
  const player: LineupPlayer = {
    playerId: String(raw.id ?? raw.name),
    name: raw.name ?? "Unknown player",
    starter,
  };
  if (typeof raw.number === "number") player.number = raw.number;
  if (raw.pos) player.position = raw.pos;
  return player;
}

function toSidelined(entry: AfInjuryEntry): SidelinedPlayer | null {
  const teamProviderId = String(entry.team?.id ?? "");
  if (!teamProviderId) return null;

  const reason = entry.reason ?? entry.player?.reason ?? undefined;
  const descriptor = `${entry.type ?? ""} ${reason ?? ""}`.toUpperCase();

  const player: SidelinedPlayer = {
    teamId: `${PROVIDER}:${teamProviderId}`,
    playerName: entry.player?.name ?? "Unknown player",
    kind: descriptor.includes("SUSPENSION") ? "suspension" : descriptor.includes("INJUR") ? "injury" : "other",
  };
  if (reason) player.reason = reason;
  return player;
}

function buildForm(entries: AfFixtureEntry[], teamProviderId: string): FormResult[] {
  return entries
    .map(toFixture)
    .filter((fixture): fixture is Fixture => fixture !== null)
    .map((fixture) => {
      const homeScore = fixture.score?.home;
      const awayScore = fixture.score?.away;
      if (typeof homeScore !== "number" || typeof awayScore !== "number") return null;

      const isHome = fixture.homeTeam.providerId === teamProviderId;
      const scored = isHome ? homeScore : awayScore;
      const conceded = isHome ? awayScore : homeScore;
      const opponent = isHome ? fixture.awayTeam : fixture.homeTeam;

      const result: FormResult = {
        fixtureId: fixture.id,
        result: scored > conceded ? "W" : scored < conceded ? "L" : "D",
        opponent: opponent.name,
        score: `${scored}-${conceded}`,
        kickoff: fixture.kickoff,
        home: isHome,
      };
      return result;
    })
    .filter((entry): entry is FormResult => entry !== null)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, 5);
}
