import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import { settleDuePredictions } from "@/lib/football/accuracy";
import { readCachedFixtures, type CachedFixture } from "@/lib/football/cache";
import {
  buildAnalysis,
  buildFinalSelection,
  buildRecommendation,
  gradeLeg,
  readGradedFixtures,
  readSavedEntries,
  resolveSelection,
  type GradedFixture,
  type SavedEntry,
} from "@/lib/football/ledger";
import type { MatchStatus } from "@/lib/football/types";
import type { SelectionSource } from "@/types/slip";
import type {
  OpenGamesCounts,
  OpenGamesEntry,
  OpenGamesEntrySource,
  OpenGamesMatch,
  OpenGamesPayload,
  OpenGamesStatus,
  OpenGamesSummary,
} from "./types";

/**
 * Open Games.
 *
 * Every entry a member saved from the Game Slip is assembled here from what was actually stored:
 * the entry itself (`users/{uid}/savedPredictions`, carrying the engine's `results` plus the
 * member's own `selections`) and the engine's graded ledger (`prediction_results`). The live
 * picture — status, minute, running score — is read from MatchMetric's own cached match feed and
 * is presented beside the saved prediction, never folded back into it.
 *
 * Nothing is estimated and nothing is recalculated after the fact: the odds, the probabilities,
 * the engine's original recommendation and the member's final selection are reported exactly as
 * they were recorded at save time. An entry that is still in play never loses those values when
 * the score moves, and a match whose result is not yet known is reported as pending rather than
 * guessed.
 */

const SOURCE_LABEL: Record<SelectionSource, string> = {
  manual: "Manual selection",
  automatic: "Automatic pick",
  screenshot: "Screenshot import",
};

export interface OpenGamesRequest {
  uid: string;
  /** Free-text search across the reference, teams, competition, market and selection. */
  query: string;
}

export async function buildOpenGames(request: OpenGamesRequest): Promise<OpenGamesPayload> {
  const db = getAdminDb();
  if (!db) return unconfigured("Open Games is not configured on the server.");

  // Fresh grades first: a member always reads up-to-date results without a background worker.
  try {
    await settleDuePredictions();
  } catch {
    // A settlement failure must not blank the page; the stored ledger is still read below.
  }

  const entries = await readSavedEntries(request.uid);
  const fixtureIds = [...new Set(entries.flatMap((entry) => entry.results.map((result) => result.fixtureId)))];
  const [ledger, cached] = await Promise.all([
    readGradedFixtures(fixtureIds),
    readCachedFixtures(fixtureIds),
  ]);

  const now = Date.now();
  const built = entries
    .map((entry) => buildEntry(entry, ledger, cached, now))
    .filter((entry): entry is OpenGamesEntry => entry !== null)
    .filter((entry) => matchesQuery(entry, request.query))
    .sort((left, right) => right.dateMs - left.dateMs);

  return {
    configured: true,
    entries: built,
    summary: summarise(built),
    counts: countStatuses(built),
    generatedAt: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------- entry */

function buildEntry(
  entry: SavedEntry,
  ledger: Map<string, GradedFixture>,
  cached: Map<string, CachedFixture>,
  now: number,
): OpenGamesEntry | null {
  const matches: OpenGamesMatch[] = [];

  for (const result of entry.results) {
    const recorded = entry.selections.find((selection) => selection.fixtureId === result.fixtureId) ?? null;
    const resolved = resolveSelection(result, recorded);

    // No pick at all: the engine withheld a recommendation and the member did not choose one.
    if (!recorded && (!result.recommendedSelection || !resolved.settlement)) continue;

    const graded = ledger.get(result.fixtureId) ?? null;
    const feed = cached.get(result.fixtureId) ?? null;
    const kickoffMs = Date.parse(result.kickoff);
    const matchStatus: MatchStatus =
      feed?.status ?? (Number.isFinite(kickoffMs) && kickoffMs > now ? "scheduled" : "unknown");

    const settledScore =
      graded && graded.homeScore !== null && graded.awayScore !== null
        ? { home: graded.homeScore, away: graded.awayScore }
        : null;
    const inPlay = matchStatus === "live" || matchStatus === "halftime";
    const feedScore =
      feed?.score && typeof feed.score.home === "number" && typeof feed.score.away === "number"
        ? { home: feed.score.home, away: feed.score.away }
        : null;
    matches.push({
      fixtureId: result.fixtureId,
      competition: result.leagueName || graded?.leagueName || "Unknown competition",
      kickoff: result.kickoff || graded?.kickoff || "",
      home: result.homeTeam,
      away: result.awayTeam,
      marketKey: resolved.marketKey,
      marketLabel: resolved.marketLabel,
      selection: resolved.selection,
      outcome: gradeLeg(resolved.settlement, graded),
      recorded: recorded !== null,
      overridden: recorded !== null && recorded.selection !== (result.recommendedSelection ?? ""),
      recommendation: buildRecommendation(result),
      finalSelection: buildFinalSelection(result, recorded, resolved.marketLabel),
      engineOutcome: graded && graded.outcome !== "void" ? graded.outcome : null,
      analysis: buildAnalysis(result),
      matchStatus,
      statusLabel: feed?.statusLabel ?? "",
      minute: feed && inPlay && typeof feed.minute === "number" ? feed.minute : null,
      liveScore: inPlay ? feed?.score ?? null : null,
      finalScore: settledScore ?? (matchStatus === "finished" ? feedScore : null),
      liveUpdatedAt: feed?.cachedAt || null,
    });
  }

  if (!matches.length) return null;

  const settledAt =
    matches
      .map((match) => ledger.get(match.fixtureId)?.settledAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

  const sources = new Set<SelectionSource>(
    matches
      .map((match) => match.finalSelection.source)
      .filter((source): source is SelectionSource => source !== "unknown"),
  );
  const source: OpenGamesEntrySource =
    sources.size === 0 ? "unknown" : sources.size === 1 ? [...sources][0] : "mixed";

  const pending = matches
    .map((match) => Date.parse(match.kickoff))
    .filter((ms) => Number.isFinite(ms) && ms > now);

  return {
    id: entry.id,
    reference: entry.id,
    savedAt: entry.savedAt,
    settledAt,
    dateMs: Date.parse(entry.savedAt) || 0,
    pendingKickoffMs: pending.length ? Math.min(...pending) : 0,
    matchCount: matches.length,
    source,
    sourceLabel:
      source === "mixed" ? "Mixed selection" : source === "unknown" ? "MatchMetric pick" : SOURCE_LABEL[source],
    modelVersion: entry.results[0]?.modelVersion ?? "",
    status: entryStatus(matches),
    matches,
    wonMatches: matches.filter((match) => match.outcome === "won").length,
    lostMatches: matches.filter((match) => match.outcome === "lost").length,
    voidedMatches: matches.filter((match) => match.outcome === "void" || match.outcome === "push").length,
    openMatches: matches.filter((match) => match.outcome === "open" || match.outcome === "unevaluable").length,
    liveMatches: matches.filter((match) => match.matchStatus === "live" || match.matchStatus === "halftime").length,
  } satisfies OpenGamesEntry;
}

/**
 * Whole-entry state.
 *
 * A single lost selection loses the entry. While anything is still unresolved the entry is in
 * play if a match is in play and open otherwise. Once every selection has resolved, an entry with
 * a win is won and an entry of nothing but pushes and voids is voided — a void is never a loss.
 */
function entryStatus(matches: OpenGamesMatch[]): OpenGamesStatus {
  if (matches.some((match) => match.outcome === "lost")) return "lost";

  if (matches.some((match) => match.outcome === "open" || match.outcome === "unevaluable")) {
    const inPlay = matches.some((match) => match.matchStatus === "live" || match.matchStatus === "halftime");
    return inPlay ? "live" : "open";
  }

  return matches.some((match) => match.outcome === "won") ? "won" : "voided";
}

/* -------------------------------------------------------------------- summary */

function summarise(entries: OpenGamesEntry[]): OpenGamesSummary {
  const matches = entries.flatMap((entry) => entry.matches);
  const won = entries.filter((entry) => entry.status === "won").length;
  const lost = entries.filter((entry) => entry.status === "lost").length;

  return {
    totalEntries: entries.length,
    completedEntries: won + lost,
    openEntries: entries.filter((entry) => entry.status === "open").length,
    liveEntries: entries.filter((entry) => entry.status === "live").length,
    won,
    lost,
    voided: entries.filter((entry) => entry.status === "voided").length,
    winRate: won + lost > 0 ? round1((won / (won + lost)) * 100) : 0,
    totalMatches: matches.length,
    upcomingMatches: matches.filter((match) => match.matchStatus === "scheduled").length,
    liveMatches: matches.filter((match) => match.matchStatus === "live" || match.matchStatus === "halftime").length,
    completedMatches: matches.filter((match) => match.outcome !== "open" && match.outcome !== "unevaluable").length,
  };
}

function countStatuses(entries: OpenGamesEntry[]): OpenGamesCounts {
  return {
    all: entries.length,
    open: entries.filter((entry) => entry.status === "open").length,
    live: entries.filter((entry) => entry.status === "live").length,
    won: entries.filter((entry) => entry.status === "won").length,
    lost: entries.filter((entry) => entry.status === "lost").length,
    voided: entries.filter((entry) => entry.status === "voided").length,
  };
}

/* --------------------------------------------------------------------- search */

function matchesQuery(entry: OpenGamesEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack(entry).includes(needle);
}

function haystack(entry: OpenGamesEntry): string {
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

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function unconfigured(notice: string): OpenGamesPayload {
  return {
    configured: false,
    entries: [],
    summary: {
      totalEntries: 0,
      completedEntries: 0,
      openEntries: 0,
      liveEntries: 0,
      won: 0,
      lost: 0,
      voided: 0,
      winRate: 0,
      totalMatches: 0,
      upcomingMatches: 0,
      liveMatches: 0,
      completedMatches: 0,
    },
    counts: { all: 0, open: 0, live: 0, won: 0, lost: 0, voided: 0 },
    generatedAt: new Date().toISOString(),
    notice,
  };
}
