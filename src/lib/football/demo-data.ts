import type { MarketCategoryKey, MatchStatus } from "./types";

/**
 * Clearly-labelled mock fixtures for local development.
 *
 * These exist so the dashboard, date navigation and live indicators can be exercised
 * before a data provider key is connected. Every consumer renders them behind a visible
 * "Mock data" label, and the demo provider is only reachable when no provider key is set
 * or `FOOTBALL_PROVIDER=demo`. Team names are intentionally fictional; no real fixture,
 * statistic, odd or prediction is invented here.
 */
export interface DemoFixtureSeed {
  id: string;
  leagueSlug: string;
  homeTeam: string;
  awayTeam: string;
  /** Days relative to today (UTC) so the preview always has today's and tomorrow's cards. */
  dayOffset: number;
  /** HH:MM in UTC. */
  kickoffTime: string;
  status: MatchStatus;
  minute?: number;
  score?: { home: number; away: number };
  homeForm: ("W" | "D" | "L")[];
  awayForm: ("W" | "D" | "L")[];
  preview: { market: MarketCategoryKey; pick: string };
}

export const demoFixtureSeeds: DemoFixtureSeed[] = [
  {
    id: "demo-001",
    leagueSlug: "premier-league",
    homeTeam: "Northbridge FC",
    awayTeam: "Kingsport United",
    dayOffset: 0,
    kickoffTime: "13:00",
    status: "live",
    minute: 63,
    score: { home: 1, away: 1 },
    homeForm: ["W", "W", "D", "W", "L"],
    awayForm: ["W", "D", "W", "L", "W"],
    preview: { market: "match-winner", pick: "Northbridge win" },
  },
  {
    id: "demo-002",
    leagueSlug: "la-liga",
    homeTeam: "Real Valoria",
    awayTeam: "Catalunya FC",
    dayOffset: 0,
    kickoffTime: "16:00",
    status: "finished",
    score: { home: 2, away: 0 },
    homeForm: ["W", "D", "W", "W", "D"],
    awayForm: ["W", "W", "L", "W", "D"],
    preview: { market: "btts", pick: "Both teams to score" },
  },
  {
    id: "demo-003",
    leagueSlug: "serie-a",
    homeTeam: "AC Monteluce",
    awayTeam: "Inter Verona",
    dayOffset: 0,
    kickoffTime: "19:45",
    status: "scheduled",
    homeForm: ["W", "W", "D", "L", "W"],
    awayForm: ["W", "W", "W", "D", "W"],
    preview: { market: "over-under", pick: "Over 2.5 goals" },
  },
  {
    id: "demo-004",
    leagueSlug: "bundesliga",
    homeTeam: "Bayernstadt",
    awayTeam: "Dortmund 09",
    dayOffset: 1,
    kickoffTime: "14:30",
    status: "scheduled",
    homeForm: ["W", "D", "W", "W", "W"],
    awayForm: ["L", "W", "W", "D", "W"],
    preview: { market: "over-under", pick: "Over 2.5 goals" },
  },
  {
    id: "demo-005",
    leagueSlug: "ligue-1",
    homeTeam: "Paris Montclair",
    awayTeam: "Olympique Rivière",
    dayOffset: 1,
    kickoffTime: "17:00",
    status: "scheduled",
    homeForm: ["W", "W", "W", "D", "W"],
    awayForm: ["D", "L", "W", "D", "W"],
    preview: { market: "double-chance", pick: "Montclair or draw" },
  },
  {
    id: "demo-006",
    leagueSlug: "champions-league",
    homeTeam: "Porto Azul",
    awayTeam: "Milanese Calcio",
    dayOffset: 1,
    kickoffTime: "19:00",
    status: "scheduled",
    homeForm: ["W", "D", "W", "L", "W"],
    awayForm: ["W", "W", "D", "W", "L"],
    preview: { market: "match-winner", pick: "Draw" },
  },
  {
    id: "demo-007",
    leagueSlug: "europa-league",
    homeTeam: "Rheinburg SV",
    awayTeam: "Lusitano CP",
    dayOffset: 1,
    kickoffTime: "16:45",
    status: "scheduled",
    homeForm: ["D", "W", "W", "L", "W"],
    awayForm: ["W", "L", "D", "W", "W"],
    preview: { market: "asian-handicap", pick: "Rheinburg -1" },
  },
];

export const demoSourceLabel =
  "Mock fixtures. No football data provider is connected, so no live fixture, statistic, odd or prediction is shown.";
