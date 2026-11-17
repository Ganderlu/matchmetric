import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import { settleDuePredictions } from "@/lib/football/accuracy";
import { marketCategories } from "@/lib/football/markets";
import {
  gradeLeg,
  readGradedFixtures,
  readSavedEntries,
  resolveRecordedPick,
  type GradedFixture,
  type SavedEntry,
} from "@/lib/football/ledger";
import type { MarketCategoryKey } from "@/lib/football/types";
import type { ManualPredictionResult, SavedSelectionRecord } from "@/lib/manual-predictions";
import type { SelectionSource } from "@/types/slip";
import type {
  HistoryAnalysis,
  HistoryEntry,
  HistoryEntrySource,
  HistoryFinalSelection,
  HistoryMatch,
  HistoryPayload,
  HistoryRecommendation,
  HistoryStatus,
  HistoryStatusCounts,
  HistorySummary,
} from "./types";

/**
 * History analytics.
 *
 * A completed record is assembled from what was actually stored: the entry the member saved
 * (`users/{uid}/savedPredictions`, carrying the engine's `results` plus the member's own
 * `selections`) and the engine's settled ledger (`prediction_results`). Each selection is graded
 * from the final score, never from the engine's own outcome, so a member's alternative pick is
 * scored on its own merits. An entry is listed only once every one of its selections has
 * resolved — anything still open or not gradable belongs to Open Games, not History.
 *
 * Nothing is estimated and nothing is recalculated after the fact: the odds, the probabilities,
 * the engine's original recommendation and the member's final selection are all reported exactly
 * as they were recorded at save time.
 */

const SOURCE_LABEL: Record<SelectionSource, string> = {
  manual: "Manual selection",
  automatic: "Automatic pick",
  screenshot: "Screenshot import",
};

export interface HistoryRequest {
  uid: string;
  fromMs: number | null;
  toMs: number | null;
  /** Free-text search across the reference, teams, competition, market and selection. */
  query: string;
}

export async function buildHistory(request: HistoryRequest): Promise<HistoryPayload> {
  const db = getAdminDb();
  if (!db) return unconfigured("History is not configured on the server.");

  // Fresh grades first: a member always reads up-to-date results without a background worker.
  try {
    await settleDuePredictions();
  } catch {
    // A settlement failure must not blank the page; the stored ledger is still read below.
  }

  const entries = await readSavedEntries(request.uid);
  const fixtureIds = [...new Set(entries.flatMap((entry) => entry.results.map((result) => result.fixtureId)))];
  const ledger = await readGradedFixtures(fixtureIds);

  const completed = entries
    .map((entry) => buildEntry(entry, ledger))
    .filter((entry): entry is HistoryEntry => entry !== null);

  const scoped = completed
    .filter((entry) => inRange(entry.dateMs, request))
    .filter((entry) => matchesQuery(entry, request.query))
    .sort((left, right) => right.dateMs - left.dateMs);

  return {
    configured: true,
    entries: scoped,
    summary: summarise(scoped),
    counts: countStatuses(scoped),
    generatedAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------- entry */

function buildEntry(entry: SavedEntry, ledger: Map<string, GradedFixture>): HistoryEntry | null {
  const matches: HistoryMatch[] = [];

  for (const result of entry.results) {
    const recorded = entry.selections.find((selection) => selection.fixtureId === result.fixtureId) ?? null;
    const resolved = recorded ? resolveRecordedPick(result, recorded) : null;

    const settlement = recorded ? resolved?.settlement ?? null : result.recommendedSettlement;
    const marketKey: MarketCategoryKey | "other" = recorded
      ? resolved?.category ?? "other"
      : result.recommendedMarket ?? "other";
    const marketLabel = recorded
      ? resolved?.category
        ? marketCategories[resolved.category].label
        : recorded.market
      : result.marketLabel ?? marketCategories[result.recommendedMarket ?? "match-winner"].label;
    const selection = recorded ? recorded.selection : result.recommendedSelection ?? "";

    // No pick at all: the engine withheld a recommendation and the member did not choose one.
    if (!recorded && (!result.recommendedSelection || !settlement)) continue;

    const graded = ledger.get(result.fixtureId) ?? null;

    matches.push({
      fixtureId: result.fixtureId,
      competition: result.leagueName || graded?.leagueName || "Unknown competition",
      kickoff: result.kickoff || graded?.kickoff || "",
      home: result.homeTeam,
      away: result.awayTeam,
      finalScore:
        graded && graded.homeScore !== null && graded.awayScore !== null
          ? { home: graded.homeScore, away: graded.awayScore }
          : null,
      settledAt: graded?.settledAt || null,
      marketKey,
      marketLabel,
      selection,
      outcome: gradeLeg(settlement, graded),
      recorded: recorded !== null,
      overridden: recorded !== null && recorded.selection !== (result.recommendedSelection ?? ""),
      recommendation: buildRecommendation(result),
      finalSelection: buildFinalSelection(result, recorded, marketLabel),
      engineOutcome: graded && graded.outcome !== "void" ? graded.outcome : null,
      analysis: buildAnalysis(result),
    });
  }

  if (!matches.length) return null;

  // History holds completed records only; an entry with an unresolved selection is not one.
  const status = entryStatus(matches);
  if (status === null) return null;

  const settledAt =
    matches
      .map((match) => match.settledAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const sources = new Set<SelectionSource>(
    matches.map((match) => match.finalSelection.source).filter((source): source is SelectionSource => source !== "unknown"),
  );
  const source: HistoryEntrySource = sources.size === 0 ? "unknown" : sources.size === 1 ? [...sources][0] : "mixed";

  return {
    id: entry.id,
    reference: entry.id,
    savedAt: entry.savedAt,
    settledAt,
    dateMs: Date.parse(settledAt ?? entry.savedAt) || 0,
    matchCount: matches.length,
    source,
    sourceLabel: source === "mixed" ? "Mixed selection" : source === "unknown" ? "MatchMetric pick" : SOURCE_LABEL[source],
    modelVersion: entry.results[0]?.modelVersion ?? "",
    status,
    matches,
    wonMatches: matches.filter((match) => match.outcome === "won").length,
    lostMatches: matches.filter((match) => match.outcome === "lost").length,
    voidedMatches: matches.filter((match) => match.outcome === "void" || match.outcome === "push").length,
  };
}

/** Whole-entry outcome. A single lost leg loses the entry; a voided leg never does. */
function entryStatus(matches: HistoryMatch[]): HistoryStatus | null {
  if (matches.some((match) => match.outcome === "lost")) return "lost";
  if (matches.some((match) => match.outcome === "open" || match.outcome === "unevaluable")) return null;
  const decisive = matches.filter((match) => match.outcome === "won").length;
  return decisive === 0 ? "voided" : "won";
}

function buildRecommendation(result: ManualPredictionResult): HistoryRecommendation | null {
  if (!result.recommendedSelection) return null;
  const marketKey = result.recommendedMarket ?? null;
  return {
    marketKey,
    marketLabel: result.marketLabel ?? (marketKey ? marketCategories[marketKey].label : ""),
    selection: result.recommendedSelection,
    estimatedProbability: result.estimatedProbability ?? null,
    odds: result.availableOdds ?? null,
    generatedAt: result.generatedAt,
  };
}

/** The pick the member saved. When they recorded no choice, the engine's recommendation is it. */
function buildFinalSelection(
  result: ManualPredictionResult,
  recorded: SavedSelectionRecord | null,
  marketLabel: string,
): HistoryFinalSelection {
  if (recorded) {
    return {
      marketLabel,
      selection: recorded.selection,
      odds: typeof recorded.odds === "number" ? recorded.odds : null,
      probability: typeof recorded.probability === "number" ? recorded.probability : null,
      source: recorded.source,
    };
  }
  return {
    marketLabel: result.marketLabel ?? marketLabel,
    selection: result.recommendedSelection ?? "",
    odds: result.availableOdds ?? null,
    probability: result.estimatedProbability ?? null,
    source: "unknown",
  };
}

/** The preserved analysis snapshot, or null when the record carries none. */
function buildAnalysis(result: ManualPredictionResult): HistoryAnalysis | null {
  const keyInsights = Array.isArray(result.keyInsights) ? result.keyInsights : [];
  const weakeningFactors = Array.isArray(result.weakeningFactors) ? result.weakeningFactors : [];
  if (!result.homeFormSummary && !result.awayFormSummary && !keyInsights.length && !weakeningFactors.length) {
    return null;
  }
  return {
    status: result.analysisStatus ?? null,
    confidence: result.confidence ?? null,
    dataQuality: result.dataQuality ?? null,
    estimatedProbability: result.estimatedProbability ?? null,
    availableOdds: result.availableOdds ?? null,
    homeForm: result.homeFormSummary ?? "",
    awayForm: result.awayFormSummary ?? "",
    keyInsights,
    weakeningFactors,
  };
}

/* -------------------------------------------------------------------- summary */

function summarise(entries: HistoryEntry[]): HistorySummary {
  const won = entries.filter((entry) => entry.status === "won").length;
  const lost = entries.filter((entry) => entry.status === "lost").length;
  const voided = entries.filter((entry) => entry.status === "voided").length;
  const matches = entries.flatMap((entry) => entry.matches);

  return {
    settledEntries: won + lost,
    won,
    lost,
    voided,
    winRate: won + lost > 0 ? round1((won / (won + lost)) * 100) : 0,
    matchesSettled: matches.filter((match) => match.outcome === "won" || match.outcome === "lost").length,
    matchesWon: matches.filter((match) => match.outcome === "won").length,
  };
}

function countStatuses(entries: HistoryEntry[]): HistoryStatusCounts {
  return {
    all: entries.length,
    won: entries.filter((entry) => entry.status === "won").length,
    lost: entries.filter((entry) => entry.status === "lost").length,
    voided: entries.filter((entry) => entry.status === "voided").length,
  };
}

/* --------------------------------------------------------------------- search */

function matchesQuery(entry: HistoryEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack(entry).includes(needle);
}

function haystack(entry: HistoryEntry): string {
  return [
    entry.reference,
    ...entry.matches.flatMap((match) => [
      match.home.name,
      match.away.name,
      match.competition,
      match.marketLabel,
      match.selection,
    ]),
  ]
    .join(" ")
    .toLowerCase();
}

/* ---------------------------------------------------------------------- shared */

function inRange(ms: number, request: HistoryRequest): boolean {
  if (!ms) return request.fromMs === null && request.toMs === null;
  if (request.fromMs !== null && ms < request.fromMs) return false;
  if (request.toMs !== null && ms > request.toMs) return false;
  return true;
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function unconfigured(notice: string): HistoryPayload {
  return {
    configured: false,
    entries: [],
    summary: { settledEntries: 0, won: 0, lost: 0, voided: 0, winRate: 0, matchesSettled: 0, matchesWon: 0 },
    counts: { all: 0, won: 0, lost: 0, voided: 0 },
    generatedAt: new Date().toISOString(),
    notice,
  };
}
