import "server-only";

import { demoFixtureSeeds, type DemoFixtureSeed } from "../demo-data";
import { competitionBySlug } from "../leagues";
import type { Fixture, FixtureFeed, FixtureQuery, MatchDetail, MarketCategoryKey, Team } from "../types";
import { addDays, toIsoDate } from "./shared";
import type { FootballProvider, ProviderCompetition } from "./types";

/** The demo provider is always "configured"; it never reports live data. */
export const DEMO = "demo";

export interface DemoPreview {
  market: MarketCategoryKey;
  pick: string;
  homeForm: ("W" | "D" | "L")[];
  awayForm: ("W" | "D" | "L")[];
}

/** Extra, clearly-mock presentation data that only the demo provider supplies. */
export function demoPreview(fixtureId: string): DemoPreview | undefined {
  const seed = demoFixtureSeeds.find((candidate) => `${DEMO}:${candidate.id}` === fixtureId);
  if (!seed) return undefined;
  return {
    market: seed.preview.market,
    pick: seed.preview.pick,
    homeForm: seed.homeForm,
    awayForm: seed.awayForm,
  };
}

export function demoKickoff(seed: DemoFixtureSeed, now = new Date()): string {
  const [hours, minutes] = seed.kickoffTime.split(":").map(Number);
  const day = addDays(new Date(`${toIsoDate(now)}T00:00:00Z`), seed.dayOffset);
  day.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0);
  return day.toISOString();
}

export function toDemoFixture(seed: DemoFixtureSeed, now = new Date()): Fixture {
  const competition = competitionBySlug(seed.leagueSlug);
  const fixture: Fixture = {
    id: `${DEMO}:${seed.id}`,
    provider: DEMO,
    providerId: seed.id,
    league: {
      id: `${DEMO}:${seed.leagueSlug}`,
      name: competition?.name ?? seed.leagueSlug,
      country: competition?.country ?? "",
    },
    homeTeam: toDemoTeam(seed.homeTeam, `${seed.id}-home`),
    awayTeam: toDemoTeam(seed.awayTeam, `${seed.id}-away`),
    kickoff: demoKickoff(seed, now),
    status: seed.status,
    statusLabel: demoStatusLabel(seed),
  };
  if (seed.minute !== undefined) fixture.minute = seed.minute;
  if (seed.score) fixture.score = { home: seed.score.home, away: seed.score.away };
  return fixture;
}

export function createDemoProvider(): FootballProvider {
  const provider: FootballProvider = {
    name: DEMO,
    configured: true,

    listCompetitions(): ProviderCompetition[] {
      const seen = new Map<string, ProviderCompetition>();
      for (const seed of demoFixtureSeeds) {
        const competition = competitionBySlug(seed.leagueSlug);
        if (!competition || seen.has(competition.slug)) continue;
        seen.set(competition.slug, {
          id: `${DEMO}:${competition.slug}`,
          providerId: competition.slug,
          name: competition.name,
          country: competition.country,
          flag: competition.flag,
          short: competition.short,
        });
      }
      return [...seen.values()];
    },

    async getFixtures(query: FixtureQuery): Promise<FixtureFeed> {
      const now = new Date();
      const requested = new Set(
        (query.leagueIds ?? []).map((leagueId) => leagueId.split(":")[1] ?? leagueId),
      );

      const fixtures = demoFixtureSeeds
        .map((seed) => toDemoFixture(seed, now))
        .filter((fixture) => {
          const day = fixture.kickoff.slice(0, 10);
          if (day < query.from || day > query.to) return false;
          if (requested.size && !requested.has(fixtureLeagueSlug(fixture))) return false;
          if (query.statuses?.length && !query.statuses.includes(fixture.status)) return false;
          return true;
        })
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

      return {
        fixtures,
        pagination: { page: 1, perPage: fixtures.length, hasMore: false },
      };
    },

    async getFixture(providerId: string): Promise<Fixture | null> {
      const seed = demoFixtureSeeds.find((candidate) => candidate.id === providerId);
      return seed ? toDemoFixture(seed) : null;
    },

    async getMatchDetail(providerId: string): Promise<MatchDetail | null> {
      const seed = demoFixtureSeeds.find((candidate) => candidate.id === providerId);
      if (!seed) return null;

      // Nothing is invented: without a provider there is no form, head-to-head,
      // statistics, lineup, event, injury or odds data to show. The match centre renders
      // its "not available" state for every section.
      return {
        fixture: toDemoFixture(seed),
        homeForm: [],
        awayForm: [],
        events: [],
        sidelined: [],
        odds: [],
        available: {
          form: false,
          headToHead: false,
          statistics: false,
          expectedGoals: false,
          lineups: false,
          events: false,
          sidelined: false,
          odds: false,
        },
      };
    },
  };

  return provider;
}

function toDemoTeam(name: string, providerId: string): Team {
  return { id: `${DEMO}:${providerId}`, provider: DEMO, providerId, name };
}

function fixtureLeagueSlug(fixture: Fixture): string {
  return fixture.league.id.split(":")[1] ?? "";
}

function demoStatusLabel(seed: DemoFixtureSeed): string {
  if (seed.status === "live" && seed.minute) return `Live · ${seed.minute}'`;
  if (seed.status === "finished") return "Full time";
  if (seed.status === "halftime") return "Half time";
  return "Not started";
}
