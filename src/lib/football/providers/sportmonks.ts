import "server-only";

import { competitionForLeagueId, competitionsForProvider } from "../leagues";
import { resolveMarketCategory } from "../markets";
import type {
  Fixture,
  FixtureFeed,
  FixtureQuery,
  FixtureScore,
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
import { clampPage, toIsoDate, toKickoff, toNumber } from "./shared";
import type { FootballProvider, ProviderCompetition } from "./types";

/**
 * Sportmonks v3 adapter (primary provider).
 *
 * Field names follow the published v3 responses. Sub-resources (form, head-to-head,
 * sidelined, odds) are fetched as separate, individually guarded calls so one
 * unavailable include cannot fail the whole match centre. Every mapping is defensive:
 * an unexpected shape yields an empty section and a `false` entry in `MatchAvailability`
 * rather than invented data.
 *
 * NOTE: the exact include list available depends on the Sportmonks plan. Until a key is
 * connected this mapping cannot be exercised against live responses; anything a plan does
 * not return simply degrades to the "not available" state in the UI.
 */
const BASE_URL = "https://api.sportmonks.com/v3/football";
const PROVIDER = "sportmonks" as const;

const BASE_INCLUDES = ["participants", "league", "scores", "state", "venue"];
const DETAIL_INCLUDES = [...BASE_INCLUDES, "events.type", "lineups.player", "statistics.type"];

/**
 * Sportmonks `state.developer_name` -> normalised status.
 *
 * The codes are the ones the published /v3/football/states list returns (e.g. "NS" for
 * Not Started, "INPLAY_2ND_HALF", "FT"), not the human-readable `state.name`. Anything
 * unrecognised falls back to "unknown" so a new code can never be silently mislabelled.
 */
const STATE_MAP: Record<string, MatchStatus> = {
  NS: "scheduled",
  TBA: "scheduled",
  PENDING: "scheduled",
  INPLAY_1ST_HALF: "live",
  INPLAY_2ND_HALF: "live",
  INPLAY_ET: "live",
  INPLAY_ET_SECOND_HALF: "live",
  INPLAY_PENALTIES: "live",
  HT: "halftime",
  BREAK: "halftime",
  EXTRA_TIME_BREAK: "halftime",
  PEN_BREAK: "halftime",
  FT: "finished",
  AET: "finished",
  FT_PEN: "finished",
  AWARDED: "finished",
  WO: "finished",
  POSTPONED: "postponed",
  DELAYED: "postponed",
  INTERRUPTED: "postponed",
  CANCELLED: "cancelled",
  SUSPENDED: "cancelled",
  ABANDONED: "cancelled",
  DELETED: "cancelled",
};

const EVENT_TYPE_MAP: Record<string, MatchEventType> = {
  GOAL: "goal",
  OWN_GOAL: "own-goal",
  PENALTY: "penalty",
  PENALTY_MISSED: "penalty",
  YELLOWCARD: "yellow-card",
  YELLOW_RED_CARD: "red-card",
  REDCARD: "red-card",
  SUBSTITUTION: "substitution",
  VAR: "var",
};

/** Sportmonks statistic `type.developer_name` -> normalised field. */
const STATISTIC_FIELDS: Record<string, TeamStatisticField> = {
  POSSESSION: "possession",
  SHOTS_TOTAL: "shots",
  SHOTS: "shots",
  SHOTS_ON_TARGET: "shotsOnTarget",
  CORNERS: "corners",
  FOULS: "fouls",
  OFFSIDES: "offsides",
  YELLOWCARDS: "yellowCards",
  REDCARDS: "redCards",
  EXPECTED_GOALS: "expectedGoals",
  XG: "expectedGoals",
};

interface SmParticipant {
  id?: number;
  name?: string;
  short_code?: string | null;
  image_path?: string | null;
  meta?: { location?: "home" | "away" };
}

interface SmScore {
  description?: string | null;
  participant?: "home" | "away" | null;
  score?: { goals?: number | null; participant?: "home" | "away" | null } | null;
}

interface SmLeague {
  id?: number;
  name?: string;
  image_path?: string | null;
  country?: { name?: string } | null;
}

interface SmFixture {
  id?: number;
  league_id?: number;
  starting_at?: string | null;
  starting_at_timestamp?: number | null;
  state?: { developer_name?: string | null; name?: string | null } | null;
  participants?: SmParticipant[] | null;
  league?: SmLeague | null;
  scores?: SmScore[] | null;
  venue?: { name?: string | null } | null;
  events?: SmEvent[] | null;
  lineups?: SmLineup[] | null;
  statistics?: SmStatistic[] | null;
}

interface SmEvent {
  id?: number;
  minute?: number | null;
  participant_id?: number | null;
  player_name?: string | null;
  type?: { developer_name?: string | null; name?: string | null } | null;
}

interface SmLineup {
  id?: number;
  player_id?: number | null;
  team_id?: number | null;
  jersey_number?: number | null;
  formation_field?: string | null;
  type_id?: number | null;
  player_name?: string | null;
  position?: { name?: string | null } | null;
  player?: { display_name?: string | null; name?: string | null } | null;
}

interface SmStatistic {
  participant_id?: number | null;
  type?: { developer_name?: string | null; name?: string | null } | null;
  data?: { value?: number | string | null } | null;
  value?: number | string | null;
}

interface SmSidelined {
  id?: number;
  player_name?: string | null;
  type?: { developer_name?: string | null; name?: string | null } | null;
  category?: string | null;
  start_date?: string | null;
  player?: { display_name?: string | null } | null;
}

interface SmOdd {
  market_id?: number | null;
  label?: string | null;
  value?: string | number | null;
  handicap?: string | number | null;
  total?: string | number | null;
  market?: { id?: number | null; name?: string | null; developer_name?: string | null } | null;
  bookmaker?: { name?: string | null } | null;
}

interface SmCollection<T> {
  data?: T[] | T | null;
  pagination?: {
    current_page?: number;
    per_page?: number;
    has_more?: boolean;
  } | null;
}

export function createSportmonksProvider(apiKey: string | undefined): FootballProvider {
  const key = apiKey?.trim();

  const request = <T>(path: string) =>
    providerFetchJson<T>(`${BASE_URL}${path}`, {
      provider: PROVIDER,
      apiKey: key ?? "",
      auth: { query: "api_token" },
    });

  const loadFixture = async (providerId: string, includes: string[]) => {
    const payload = await request<SmCollection<SmFixture>>(
      `/fixtures/${encodeURIComponent(providerId)}?include=${includes.join(";")}`,
    );
    return asArray(payload.data)[0] ?? null;
  };

  /** Full include list, falling back to the base set when the plan rejects an include. */
  const loadFixtureWithDetail = async (providerId: string) => {
    try {
      return await loadFixture(providerId, DETAIL_INCLUDES);
    } catch {
      return loadFixture(providerId, BASE_INCLUDES);
    }
  };

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

    /**
     * Sportmonks scopes `/leagues` to the competitions the subscription can read, so a
     * single request reports exactly what this plan can serve. A failure returns `null`
     * rather than an empty set, so a transient error never hides the whole league list.
     */
    async listAccessibleCompetitionIds(): Promise<Set<string> | null> {
      try {
        const payload = await request<SmCollection<SmLeague>>("/leagues?per_page=100");
        const ids = asArray(payload.data)
          .map((league) => league.id)
          .filter((id): id is number => typeof id === "number");
        if (!ids.length) return null;
        return new Set(ids.map((id) => `${PROVIDER}:${id}`));
      } catch {
        return null;
      }
    },

    async getFixtures(query: FixtureQuery): Promise<FixtureFeed> {
      const page = clampPage(query.page, 1, 50);
      const perPage = clampPage(query.perPage, 40, 100);

      const leagueIds = (query.leagueIds ?? [])
        .map((leagueId) => leagueId.split(":")[1])
        .filter((id): id is string => Boolean(id));

      const params = new URLSearchParams({
        include: BASE_INCLUDES.join(";"),
        per_page: String(perPage),
        page: String(page),
      });
      if (leagueIds.length) params.set("filters", `fixtureLeagues:${leagueIds.join(",")}`);

      const payload = await request<SmCollection<SmFixture>>(
        `/fixtures/between/${toIsoDate(new Date(`${query.from}T00:00:00Z`))}/${toIsoDate(
          new Date(`${query.to}T00:00:00Z`),
        )}?${params.toString()}`,
      );

      const fixtures = asArray(payload.data)
        .map(toFixture)
        .filter((fixture): fixture is Fixture => fixture !== null)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

      const statuses = query.statuses;
      const filtered = statuses?.length
        ? fixtures.filter((fixture) => statuses.includes(fixture.status))
        : fixtures;

      return {
        fixtures: filtered,
        pagination: {
          page: payload.pagination?.current_page ?? page,
          perPage: payload.pagination?.per_page ?? perPage,
          hasMore: Boolean(payload.pagination?.has_more),
        },
      };
    },

    async getFixture(providerId: string): Promise<Fixture | null> {
      const raw = await loadFixture(providerId, BASE_INCLUDES);
      return raw ? toFixture(raw) : null;
    },

    async getMatchDetail(providerId: string): Promise<MatchDetail | null> {
      const raw = await loadFixtureWithDetail(providerId);
      if (!raw) return null;

      const fixture = toFixture(raw);
      if (!fixture) return null;

      const homeId = fixture.homeTeam.providerId;
      const awayId = fixture.awayTeam.providerId;
      const participantIds = [homeId, awayId].filter(Boolean);

      const [homeRecent, awayRecent, headToHead, sidelined, odds] = await Promise.all([
        guard(() => fetchTeamLatest(homeId)),
        guard(() => fetchTeamLatest(awayId)),
        guard(() => fetchHeadToHead(homeId, awayId)),
        guard(() => fetchSidelined(participantIds)),
        guard(() => fetchOdds(providerId)),
      ]);

      const events = toEvents(raw.events, fixture.id);
      const lineups = toLineups(raw.lineups, homeId, awayId, fixture.id);
      const statistics = toStatistics(raw.statistics, fixture.id, homeId, awayId);

      const homeForm = buildForm(homeRecent ?? [], homeId);
      const awayForm = buildForm(awayRecent ?? [], awayId);

      const available: MatchAvailability = {
        form: homeForm.length > 0 || awayForm.length > 0,
        headToHead: Boolean(headToHead),
        statistics: Boolean(statistics),
        expectedGoals:
          statistics?.home.expectedGoals !== undefined ||
          statistics?.away.expectedGoals !== undefined,
        lineups: Boolean(lineups),
        events: events.length > 0,
        sidelined: (sidelined?.length ?? 0) > 0,
        odds: (odds?.length ?? 0) > 0,
      };

      const detail: MatchDetail = {
        fixture,
        homeForm,
        awayForm,
        events,
        sidelined: sidelined ?? [],
        odds: odds ?? [],
        available,
      };
      if (headToHead) detail.headToHead = headToHead;
      if (statistics) detail.statistics = statistics;
      if (lineups) detail.lineups = lineups;
      return detail;
    },
  };

  async function fetchTeamLatest(teamProviderId: string): Promise<SmFixture[]> {
    if (!teamProviderId) return [];
    const payload = await request<SmCollection<{ latest?: SmFixture[] | null }>>(
      `/teams/${encodeURIComponent(teamProviderId)}?include=latest`,
    );
    const team = asArray(payload.data)[0];
    return asArray(team?.latest).slice(0, 10);
  }

  async function fetchHeadToHead(
    homeProviderId: string,
    awayProviderId: string,
  ): Promise<HeadToHeadSummary | undefined> {
    if (!homeProviderId || !awayProviderId) return undefined;

    const payload = await request<SmCollection<SmFixture>>(
      `/fixtures/head-to-head/${encodeURIComponent(homeProviderId)}/${encodeURIComponent(
        awayProviderId,
      )}?include=${BASE_INCLUDES.join(";")}`,
    );

    const played = asArray(payload.data)
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

  async function fetchSidelined(teamProviderIds: string[]): Promise<SidelinedPlayer[]> {
    const results = await Promise.all(
      teamProviderIds.map(async (teamProviderId) => {
        const payload = await request<SmCollection<SmSidelined>>(
          `/sidelined/teams/${encodeURIComponent(teamProviderId)}`,
        );
        return asArray(payload.data).map((entry) => toSidelined(entry, teamProviderId));
      }),
    );
    return results.flat();
  }

  async function fetchOdds(providerId: string): Promise<OddsMarket[]> {
    const payload = await request<SmCollection<SmOdd>>(
      `/odds/pre-match/fixtures/${encodeURIComponent(providerId)}?include=market;bookmaker&per_page=100`,
    );
    return groupOdds(asArray(payload.data));
  }

  return provider;
}

/** Any single optional sub-resource failing must not break the match centre. */
async function guard<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

// ---- normalisation ---------------------------------------------------------

function toFixture(raw: SmFixture): Fixture | null {
  if (!raw?.id) return null;

  const participants = asArray(raw.participants);
  const home = participants.find((entry) => entry.meta?.location === "home") ?? participants[0];
  const away = participants.find((entry) => entry.meta?.location === "away") ?? participants[1];
  if (!home || !away) return null;

  const kickoff = toKickoff(raw.starting_at_timestamp, raw.starting_at);
  if (!kickoff) return null;

  const stateKey = (raw.state?.developer_name ?? "").toUpperCase();

  const fixture: Fixture = {
    id: `${PROVIDER}:${raw.id}`,
    provider: PROVIDER,
    providerId: String(raw.id),
    league: toLeagueRef(raw.league, raw.league_id),
    homeTeam: toTeam(home),
    awayTeam: toTeam(away),
    kickoff,
    status: STATE_MAP[stateKey] ?? "unknown",
    statusLabel: raw.state?.name?.trim() || "Status unavailable",
  };

  const score = toScore(raw.scores);
  if (score) fixture.score = score;
  if (raw.venue?.name) fixture.venue = raw.venue.name;

  return fixture;
}

function toLeagueRef(raw: SmLeague | null | undefined, fallbackId?: number): Fixture["league"] {
  const providerId = String(raw?.id ?? fallbackId ?? "");
  const tracked = providerId ? competitionForLeagueId(`${PROVIDER}:${providerId}`) : undefined;

  const league: Pick<League, "id" | "name" | "country" | "logoUrl"> = {
    id: `${PROVIDER}:${providerId}`,
    name: tracked?.name ?? raw?.name ?? "Competition",
    country: tracked?.country ?? raw?.country?.name ?? "",
  };
  if (raw?.image_path) league.logoUrl = raw.image_path;
  return league;
}

function toTeam(raw: SmParticipant): Team {
  const team: Team = {
    id: `${PROVIDER}:${raw.id ?? raw.name ?? "unknown"}`,
    provider: PROVIDER,
    providerId: String(raw.id ?? ""),
    name: raw.name ?? "Unknown team",
  };
  if (raw.short_code) team.shortName = raw.short_code;
  if (raw.image_path) team.logoUrl = raw.image_path;
  return team;
}

function toScore(scores: SmScore[] | null | undefined): FixtureScore | undefined {
  const entries = asArray(scores);
  if (!entries.length) return undefined;

  const current = entries.filter((entry) => (entry.description ?? "").toUpperCase() === "CURRENT");
  const source = current.length ? current : entries;

  let home: number | null = null;
  let away: number | null = null;

  for (const entry of source) {
    const side = entry.score?.participant ?? entry.participant;
    const goals = toNumber(entry.score?.goals);
    if (goals === undefined) continue;
    if (side === "home") home = goals;
    else if (side === "away") away = goals;
  }

  return home === null && away === null ? undefined : { home, away };
}

function toEvents(events: SmEvent[] | null | undefined, fixtureId: string): MatchEvent[] {
  return asArray(events)
    .map((event, index) => {
      const typeKey = (event.type?.developer_name ?? "").toUpperCase();
      const mapped: MatchEvent = {
        id: `${PROVIDER}:event:${fixtureId}:${event.id ?? index}`,
        minute: event.minute ?? 0,
        type: EVENT_TYPE_MAP[typeKey] ?? "other",
      };
      if (event.player_name) mapped.playerName = event.player_name;
      if (event.participant_id) mapped.teamId = `${PROVIDER}:${event.participant_id}`;
      if (event.type?.name) mapped.detail = event.type.name;
      return mapped;
    })
    .sort((a, b) => a.minute - b.minute);
}

function toLineups(
  entries: SmLineup[] | null | undefined,
  homeProviderId: string,
  awayProviderId: string,
  fixtureId: string,
): MatchLineups | undefined {
  const grouped = new Map<string, LineupPlayer[]>();

  for (const entry of asArray(entries)) {
    const teamProviderId = String(entry.team_id ?? "");
    if (!teamProviderId) continue;

    const player: LineupPlayer = {
      playerId: String(entry.player_id ?? entry.id ?? entry.player_name ?? ""),
      name: entry.player?.display_name ?? entry.player_name ?? entry.player?.name ?? "Unknown player",
      // Sportmonks gives the starting XI a formation slot; substitutes have none.
      starter: Boolean(entry.formation_field) || entry.type_id === 11,
    };
    if (typeof entry.jersey_number === "number") player.number = entry.jersey_number;
    if (entry.position?.name) player.position = entry.position.name;

    const list = grouped.get(teamProviderId) ?? [];
    list.push(player);
    grouped.set(teamProviderId, list);
  }

  const build = (providerId: string): TeamLineup | undefined => {
    const players = grouped.get(providerId);
    if (!players?.length) return undefined;
    return {
      teamId: `${PROVIDER}:${providerId}`,
      players: [...players].sort((a, b) => Number(b.starter) - Number(a.starter)),
    };
  };

  const home = build(homeProviderId);
  const away = build(awayProviderId);
  if (!home && !away) return undefined;

  const lineups: MatchLineups = { fixtureId, confirmed: false };
  if (home) lineups.home = home;
  if (away) lineups.away = away;
  return lineups;
}

function toStatistics(
  entries: SmStatistic[] | null | undefined,
  fixtureId: string,
  homeProviderId: string,
  awayProviderId: string,
): MatchStatistics | undefined {
  const home: TeamStatistics = { teamId: `${PROVIDER}:${homeProviderId}` };
  const away: TeamStatistics = { teamId: `${PROVIDER}:${awayProviderId}` };
  let matched = 0;

  for (const entry of asArray(entries)) {
    const developerName = (entry.type?.developer_name ?? "").toUpperCase();
    const field = STATISTIC_FIELDS[developerName];
    if (!field) continue;

    const value = toNumber(entry.data?.value ?? entry.value);
    if (value === undefined) continue;

    const target = String(entry.participant_id ?? "") === homeProviderId ? home : away;
    target[field] = value;
    matched += 1;
  }

  return matched ? { fixtureId, home, away } : undefined;
}

function toSidelined(entry: SmSidelined, teamProviderId: string): SidelinedPlayer {
  const developerName = (entry.type?.developer_name ?? "").toUpperCase();
  const namedKind = `${developerName} ${entry.type?.name ?? ""} ${entry.category ?? ""}`.toUpperCase();

  const player: SidelinedPlayer = {
    teamId: `${PROVIDER}:${teamProviderId}`,
    playerName: entry.player?.display_name ?? entry.player_name ?? "Unknown player",
    kind: namedKind.includes("SUSPENSION")
      ? "suspension"
      : namedKind.includes("INJUR")
        ? "injury"
        : "other",
  };
  if (entry.type?.name) player.reason = entry.type.name;
  if (entry.start_date) player.since = entry.start_date;
  return player;
}

function groupOdds(entries: SmOdd[]): OddsMarket[] {
  const markets = new Map<string, OddsMarket>();

  for (const entry of entries) {
    const marketId = String(entry.market_id ?? entry.market?.id ?? "");
    if (!marketId) continue;

    const marketName = entry.market?.name ?? entry.market?.developer_name ?? "";
    const category = resolveMarketCategory(marketId, marketName, PROVIDER);
    if (!category) continue;

    const price = toNumber(entry.value);
    if (price === undefined) continue;

    const line = entry.total ?? entry.handicap ?? undefined;
    const bookmaker = entry.bookmaker?.name ?? undefined;
    const groupKey = `${category}:${marketId}:${bookmaker ?? ""}:${line ?? ""}`;

    const market: OddsMarket = markets.get(groupKey) ?? {
      category,
      marketId,
      name: marketName || category,
      selections: [],
    };
    if (bookmaker) market.bookmaker = bookmaker;
    if (line !== undefined) market.line = String(line);

    const selection: OddsSelection = { label: entry.label?.trim() || "Selection", price };
    market.selections.push(selection);
    markets.set(groupKey, market);
  }

  return [...markets.values()].filter((market) => market.selections.length >= 2);
}

function buildForm(fixtures: SmFixture[], teamProviderId: string): FormResult[] {
  return asArray(fixtures)
    .map((raw) => {
      const fixture = toFixture(raw);
      if (!fixture) return null;

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
