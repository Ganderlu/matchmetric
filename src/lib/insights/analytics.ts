import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/football/cache";
import { settleDuePredictions } from "@/lib/football/accuracy";
import { marketCategories } from "@/lib/football/markets";
import {
  gradeLeg,
  readGradedFixtures,
  readSavedEntries,
  resolveRecordedPick,
  text,
  toGraded,
  type GradedFixture,
  type LegOutcome,
  type SavedEntry,
} from "@/lib/football/ledger";
import type { MarketCategoryKey } from "@/lib/football/types";
import type { SelectionSource } from "@/types/slip";
import {
  MIN_CALIBRATION_SAMPLE,
  MIN_RELIABLE_SAMPLE,
  type BreakdownRow,
  type CalibrationBucket,
  type ComparisonSummary,
  type EngineCompetitionRow,
  type EngineInsights,
  type EngineMarketRow,
  type InsightsFilterOption,
  type InsightsFilters,
  type InsightsGrain,
  type InsightsRangeKey,
  type ModelVersionRow,
  type PerformanceCount,
  type PersonalInsights,
  type PersonalSummary,
  type SourceBreakdown,
  type TrendPoint,
} from "./types";

/**
 * Insights analytics.
 *
 * Two separate datasets are computed here and are never merged:
 *
 * - `My Performance` grades the member's own saved selections. The engine ledger only stores
 *   the engine's own pick, so a member's alternative is graded on read: its canonical
 *   settlement target is resolved from the evaluated markets the engine offered for that
 *   fixture, then graded against the final score the ledger recorded. A selection whose target
 *   cannot be resolved is reported as unevaluable rather than guessed.
 * - `MatchMetric Performance` grades the engine's archived recommendations from
 *   `prediction_results`, which is written only for predictions recorded before kickoff.
 *
 * Every figure comes from recorded history. Nothing is estimated, and a metric with no
 * supporting sample stays at zero with its sample size shown beside it.
 */

const MAX_ENGINE_RESULTS = 1000;
const MAX_PENDING_SCAN = 1000;

const SOURCE_LABEL: Record<SelectionSource, string> = {
  manual: "Manual",
  automatic: "Automatic",
  screenshot: "Screenshot",
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface InsightsRequest {
  uid: string;
  range: InsightsRangeKey;
  grain: InsightsGrain;
  fromMs: number | null;
  toMs: number | null;
  /** Minutes to subtract from UTC to read a timestamp in the member's local time. */
  tzOffsetMinutes: number;
  competition: string | null;
  market: string | null;
  source: SelectionSource | null;
}

export interface InsightsResult {
  personal: PersonalInsights;
  engine: EngineInsights;
  filters: InsightsFilters;
}

/** One recorded selection inside a saved entry, graded where the data allows it. */
interface Leg {
  entryId: string;
  fixtureId: string;
  competition: string;
  kickoff: string;
  kickoffMs: number;
  marketKey: MarketCategoryKey | "other";
  marketLabel: string;
  selection: string;
  source: SelectionSource | "unknown";
  /** True when the member recorded their own choice for this fixture. */
  collected: boolean;
  /** True when that choice differs from the engine's recommendation. */
  overridden: boolean;
  outcome: LegOutcome;
  /** The engine's own graded outcome for this fixture, when it was graded. */
  engineOutcome: "won" | "lost" | "push" | null;
}

/** A recorded prediction still waiting on a result. */
interface PendingPrediction {
  market: MarketCategoryKey;
  leagueName: string;
  kickoff: string;
  modelVersion: string;
}

export async function buildInsights(request: InsightsRequest): Promise<InsightsResult> {
  const db = getAdminDb();
  if (!db) {
    return {
      personal: unconfiguredPersonal(),
      engine: unconfiguredEngine("Insights are not configured on the server."),
      filters: { competitions: [], markets: [] },
    };
  }

  // Fresh grades first: a member always reads up-to-date numbers without a background worker.
  try {
    await settleDuePredictions();
  } catch {
    // A settlement failure must not blank the dashboard; the stored ledger is still read below.
  }

  const entries = await readSavedEntries(request.uid);

  const personalFixtureIds = [...new Set(entries.flatMap((entry) => entry.results.map((result) => result.fixtureId)))];
  const ledgerByIds = await readGradedFixtures(personalFixtureIds);
  const legs = entries.flatMap((entry) => buildLegs(entry, ledgerByIds));

  const ungated = await readGradedLedger();
  const pending = await readPendingPredictions();

  const filters = buildFilters(legs, ungated);

  const inWindow = <T extends { kickoffMs: number }>(rows: T[]) => rows.filter((row) => inRange(row.kickoffMs, request));

  const filteredLegs = inWindow(legs).filter(
    (leg) =>
      (!request.competition || leg.competition === request.competition) &&
      (!request.market || leg.marketKey === request.market) &&
      (!request.source || leg.source === request.source),
  );

  const filteredLedger = inWindow(
    ungated.map((row) => ({ ...row, kickoffMs: Date.parse(row.kickoff) || 0 })),
  ).filter(
    (row) =>
      (!request.competition || row.leagueName === request.competition) &&
      (!request.market || row.market === request.market),
  );

  const filteredPending = pending.filter(
    (row) =>
      (!request.competition || row.leagueName === request.competition) && (!request.market || row.market === request.market),
  );

  return {
    personal: buildPersonal(filteredLegs, legs, request),
    engine: buildEngine(filteredLedger, filteredPending),
    filters,
  };
}

/* ------------------------------------------------------------------ personal */

function buildLegs(entry: SavedEntry, ledgerByIds: Map<string, GradedFixture>): Leg[] {
  const legs: Leg[] = [];

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

    const ledger = ledgerByIds.get(result.fixtureId) ?? null;
    const kickoffMs = Date.parse(result.kickoff) || (ledger ? Date.parse(ledger.kickoff) || 0 : 0);

    legs.push({
      entryId: entry.id,
      fixtureId: result.fixtureId,
      competition: result.leagueName || ledger?.leagueName || "Unknown competition",
      kickoff: result.kickoff || ledger?.kickoff || "",
      kickoffMs,
      marketKey,
      marketLabel,
      selection,
      source: recorded ? recorded.source : "unknown",
      collected: recorded !== null,
      overridden: recorded !== null && recorded.selection !== (result.recommendedSelection ?? ""),
      outcome: gradeLeg(settlement, ledger),
      engineOutcome: ledger && ledger.outcome !== "void" ? ledger.outcome : null,
    });
  }

  return legs;
}

function buildPersonal(filtered: Leg[], all: Leg[], request: InsightsRequest): PersonalInsights {
  const summary = buildSummary(filtered);
  const comparison = buildComparison(filtered);

  return {
    configured: true,
    summary,
    entryLevel: buildEntryLevel(filtered),
    trend: buildTrend(filtered, request.grain, request.tzOffsetMinutes),
    byMarket: groupRows(filtered, (leg) => leg.marketKey, (leg) => leg.marketLabel || "Other"),
    byCompetition: groupRows(filtered, (leg) => leg.competition, (leg) => leg.competition),
    bySource: buildSourceBreakdown(filtered),
    comparison,
    observations: buildObservations(filtered, all, comparison, request),
    notes: personalNotes(),
  };
}

function buildSummary(legs: Leg[]): PersonalSummary {
  const counts = tally(legs);
  return {
    ...counts,
    entries: new Set(legs.map((leg) => leg.entryId)).size,
    selections: legs.length,
    open: legs.filter((leg) => leg.outcome === "open").length,
    unevaluable: legs.filter((leg) => leg.outcome === "unevaluable").length,
  };
}

/**
 * Multi-match entry success, kept apart from individual selection accuracy.
 *
 * An entry has already lost the moment one leg loses; otherwise it stays open until every leg
 * has resolved. A leg that is pushed or voided is neutral, exactly as it is for the win rate.
 */
function buildEntryLevel(legs: Leg[]): PerformanceCount {
  const byEntry = new Map<string, Leg[]>();
  for (const leg of legs) {
    const list = byEntry.get(leg.entryId) ?? [];
    list.push(leg);
    byEntry.set(leg.entryId, list);
  }

  const counts = emptyCount();
  for (const entryLegs of byEntry.values()) {
    const decisive = entryLegs.filter((leg) => leg.outcome === "won" || leg.outcome === "lost");
    if (entryLegs.some((leg) => leg.outcome === "lost")) {
      counts.lost += 1;
    } else if (entryLegs.some((leg) => leg.outcome === "open" || leg.outcome === "unevaluable")) {
      continue;
    } else if (decisive.length === 0) {
      counts.voided += 1;
    } else {
      counts.won += 1;
    }
  }

  counts.settled = counts.won + counts.lost;
  counts.winRate = rate(counts.won, counts.settled);
  return counts;
}

function buildTrend(legs: Leg[], grain: InsightsGrain, tzOffset: number): TrendPoint[] {
  const buckets = new Map<string, TrendPoint>();

  for (const leg of legs) {
    if (!leg.kickoffMs) continue;
    const { key, label } = bucketKey(leg.kickoffMs, grain, tzOffset);
    const point = buckets.get(key) ?? { key, label, won: 0, lost: 0, settled: 0, selections: 0, winRate: 0 };
    point.selections += 1;
    if (leg.outcome === "won") point.won += 1;
    if (leg.outcome === "lost") point.lost += 1;
    point.settled = point.won + point.lost;
    point.winRate = rate(point.won, point.settled);
    buckets.set(key, point);
  }

  return [...buckets.values()].sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
}

function buildSourceBreakdown(legs: Leg[]): SourceBreakdown[] {
  const known = legs.filter((leg): leg is Leg & { source: SelectionSource } => leg.source !== "unknown");
  const grouped = new Map<SelectionSource, Leg[]>();
  for (const leg of known) {
    const list = grouped.get(leg.source) ?? [];
    list.push(leg);
    grouped.set(leg.source, list);
  }

  return [...grouped.entries()]
    .map(([source, rows]) => {
      const counts = tally(rows);
      return {
        source,
        label: SOURCE_LABEL[source],
        recorded: rows.length,
        settled: counts.settled,
        won: counts.won,
        lost: counts.lost,
        winRate: counts.winRate,
      } satisfies SourceBreakdown;
    })
    .sort((left, right) => right.recorded - left.recorded);
}

function buildComparison(legs: Leg[]): ComparisonSummary {
  const comparison: ComparisonSummary = {
    tracked: 0,
    comparable: 0,
    same: 0,
    changed: 0,
    alternativeWon: 0,
    recommendationWon: 0,
    bothWon: 0,
    bothLost: 0,
    unavailable: 0,
  };

  for (const leg of legs) {
    if (!leg.collected) continue;
    comparison.tracked += 1;

    const userDecisive = leg.outcome === "won" || leg.outcome === "lost";
    const engineDecisive = leg.engineOutcome === "won" || leg.engineOutcome === "lost";
    if (!userDecisive || !engineDecisive) {
      comparison.unavailable += 1;
      continue;
    }

    comparison.comparable += 1;
    if (!leg.overridden) {
      comparison.same += 1;
      continue;
    }

    comparison.changed += 1;
    if (leg.outcome === "won" && leg.engineOutcome === "lost") comparison.alternativeWon += 1;
    else if (leg.outcome === "lost" && leg.engineOutcome === "won") comparison.recommendationWon += 1;
    else if (leg.outcome === "won") comparison.bothWon += 1;
    else comparison.bothLost += 1;
  }

  return comparison;
}

function buildObservations(
  filtered: Leg[],
  all: Leg[],
  comparison: ComparisonSummary,
  request: InsightsRequest,
): string[] {
  const observations: string[] = [];
  const reliable = (rows: BreakdownRow[]) => rows.filter((row) => row.settled >= MIN_RELIABLE_SAMPLE);

  const markets = reliable(groupRows(filtered, (leg) => leg.marketKey, (leg) => leg.marketLabel || "Other"));
  if (markets.length >= 2) {
    const strongest = [...markets].sort((left, right) => right.winRate - left.winRate)[0];
    observations.push(
      `${strongest.label} has produced your highest settled win rate so far: ${strongest.winRate.toFixed(1)}% from ${strongest.settled} settled selections.`,
    );
  } else if (markets.length === 1) {
    observations.push(
      `${markets[0].label} is your most settled market at ${markets[0].winRate.toFixed(1)}% from ${markets[0].settled} settled selections.`,
    );
  }

  const competitions = reliable(groupRows(filtered, (leg) => leg.competition, (leg) => leg.competition));
  if (competitions.length >= 2) {
    const strongest = [...competitions].sort((left, right) => right.winRate - left.winRate)[0];
    observations.push(
      `Your settled selections in ${strongest.label} currently lead at ${strongest.winRate.toFixed(1)}% from ${strongest.settled} settled selections.`,
    );
  }

  const momentum = buildMomentum(filtered, request);
  if (momentum) observations.push(momentum);

  if (comparison.tracked > 0) {
    const share = Math.round((comparison.changed / comparison.tracked) * 100);
    observations.push(
      comparison.changed === 0
        ? `You kept MatchMetric's original recommendation in all ${comparison.tracked} recorded selections.`
        : `You replaced MatchMetric's original recommendation in ${comparison.changed} of ${comparison.tracked} recorded selections (${share}%).`,
    );
  }

  const thinMarkets = groupRows(filtered, (leg) => leg.marketKey, (leg) => leg.marketLabel || "Other").filter(
    (row) => row.settled > 0 && row.settled < MIN_RELIABLE_SAMPLE,
  );
  if (thinMarkets.length) {
    observations.push(
      `${thinMarkets.length} ${thinMarkets.length === 1 ? "market has" : "markets have"} fewer than ${MIN_RELIABLE_SAMPLE} settled selections, which is too small for a reliable conclusion.`,
    );
  }

  if (!observations.length) {
    observations.push(
      "Your history is still small. MatchMetric will add observations here as more of your saved predictions settle.",
    );
  }

  return observations.slice(0, 5);
}

/** Compare the later half of the window with the earlier half, only on adequate samples. */
function buildMomentum(legs: Leg[], request: InsightsRequest): string | null {
  const dated = legs.filter((leg) => leg.kickoffMs > 0);
  if (!dated.length) return null;

  let boundary: number;
  const windowFrom = request.fromMs;
  const windowTo = request.toMs;
  if (windowFrom !== null && windowTo !== null && windowTo > windowFrom) {
    boundary = windowFrom + (windowTo - windowFrom) / 2;
  } else {
    const latest = Math.max(...dated.map((leg) => leg.kickoffMs));
    const thirtyDays = 30 * 86_400_000;
    const recentLegs = dated.filter((leg) => leg.kickoffMs > latest - thirtyDays);
    const previousLegs = dated.filter((leg) => leg.kickoffMs <= latest - thirtyDays && leg.kickoffMs > latest - 2 * thirtyDays);
    const recent = tally(recentLegs);
    const previous = tally(previousLegs);
    if (recent.settled < MIN_RELIABLE_SAMPLE || previous.settled < MIN_RELIABLE_SAMPLE) {
      return "There is not yet enough settled history in both the last 30 days and the 30 days before it to describe a trend reliably.";
    }
    return momentumSentence(recent.winRate, previous.winRate, recent.settled, previous.settled);
  }

  const earlier = dated.filter((leg) => leg.kickoffMs < boundary);
  const later = dated.filter((leg) => leg.kickoffMs >= boundary);
  const earlierCounts = tally(earlier);
  const laterCounts = tally(later);
  if (earlierCounts.settled < MIN_RELIABLE_SAMPLE || laterCounts.settled < MIN_RELIABLE_SAMPLE) return null;
  return momentumSentence(laterCounts.winRate, earlierCounts.winRate, laterCounts.settled, earlierCounts.settled);
}

function momentumSentence(laterRate: number, earlierRate: number, laterSample: number, earlierSample: number): string {
  const delta = laterRate - earlierRate;
  if (Math.abs(delta) < 2) {
    return `Your win rate is holding steady: ${laterRate.toFixed(1)}% from the later part of this period against ${earlierRate.toFixed(1)}% earlier (${laterSample} and ${earlierSample} settled).`;
  }
  return delta > 0
    ? `Your win rate has improved to ${laterRate.toFixed(1)}% in the later part of this period, up from ${earlierRate.toFixed(1)}% earlier (${laterSample} and ${earlierSample} settled).`
    : `Your win rate has moved to ${laterRate.toFixed(1)}% in the later part of this period, down from ${earlierRate.toFixed(1)}% earlier (${laterSample} and ${earlierSample} settled).`;
}

function personalNotes(): string[] {
  return [
    "Voided selections and pushes are excluded from the win rate. Matches still awaiting a result are counted as open and never graded early.",
    "Individual selection accuracy is reported separately from multi-match entry success: an entry only wins when every settled leg wins.",
    "Where you did not record your own outcome for a fixture, the pick counted here is MatchMetric's recommendation for that fixture.",
  ];
}

/* -------------------------------------------------------------------- engine */

function buildEngine(ledger: (GradedFixture & { kickoffMs: number })[], pending: PendingPrediction[]): EngineInsights {
  const settled = ledger.filter((row) => row.outcome === "won" || row.outcome === "lost");
  const won = ledger.filter((row) => row.outcome === "won").length;
  const lost = ledger.filter((row) => row.outcome === "lost").length;
  const push = ledger.filter((row) => row.outcome === "push").length;
  const voided = ledger.filter((row) => row.outcome === "void").length;
  const gradedDates = ledger.map((row) => row.settledAt).filter(Boolean).sort();

  const byMarket = engineMarketRows(ledger, pending);

  return {
    configured: true,
    settled: won + lost,
    won,
    lost,
    push,
    voided,
    pending: pending.length,
    hitRate: rate(won, won + lost),
    brier: meanBrier(settled),
    logLoss: meanLogLoss(settled),
    periodFrom: gradedDates[0] ?? null,
    periodTo: gradedDates[gradedDates.length - 1] ?? null,
    byMarket,
    byCompetition: engineCompetitionRows(ledger, pending),
    calibration: calibrationBuckets(settled),
    models: modelRows(ledger, pending),
    coverage: {
      competitions: new Set(ledger.map((row) => row.leagueName).filter(Boolean)).size,
      marketsEvaluated: byMarket.filter((row) => row.settled > 0).length,
      marketsLimited: byMarket.filter((row) => row.settled > 0 && row.settled < MIN_RELIABLE_SAMPLE).length,
      excluded: voided + pending.length,
    },
    notes: engineNotes(),
  };
}

function engineMarketRows(ledger: GradedFixture[], pending: PendingPrediction[]): EngineMarketRow[] {
  const grouped = new Map<string, GradedFixture[]>();
  for (const row of ledger) {
    const list = grouped.get(row.market) ?? [];
    list.push(row);
    grouped.set(row.market, list);
  }

  const pendingByMarket = new Map<string, number>();
  for (const row of pending) pendingByMarket.set(row.market, (pendingByMarket.get(row.market) ?? 0) + 1);

  const keys = new Set<string>([...grouped.keys(), ...pendingByMarket.keys()]);

  return [...keys]
    .map((key) => {
      const rows = grouped.get(key) ?? [];
      const decisive = rows.filter((row) => row.outcome === "won" || row.outcome === "lost");
      const marketWon = rows.filter((row) => row.outcome === "won").length;
      const marketLost = rows.filter((row) => row.outcome === "lost").length;
      return {
        key,
        label: marketCategories[key as MarketCategoryKey]?.label ?? key,
        generated: rows.length + (pendingByMarket.get(key) ?? 0),
        settled: decisive.length,
        won: marketWon,
        lost: marketLost,
        hitRate: rate(marketWon, marketWon + marketLost),
        brier: meanBrier(decisive),
        logLoss: meanLogLoss(decisive),
        reliable: decisive.length >= MIN_RELIABLE_SAMPLE,
      } satisfies EngineMarketRow;
    })
    .sort((left, right) => right.generated - left.generated);
}

function engineCompetitionRows(ledger: GradedFixture[], pending: PendingPrediction[]): EngineCompetitionRow[] {
  const grouped = new Map<string, GradedFixture[]>();
  for (const row of ledger) {
    const key = row.leagueName || "Unknown competition";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const pendingByLeague = new Map<string, number>();
  for (const row of pending) {
    const key = row.leagueName || "Unknown competition";
    pendingByLeague.set(key, (pendingByLeague.get(key) ?? 0) + 1);
  }

  const keys = new Set<string>([...grouped.keys(), ...pendingByLeague.keys()]);

  return [...keys]
    .map((key) => {
      const rows = grouped.get(key) ?? [];
      const decisive = rows.filter((row) => row.outcome === "won" || row.outcome === "lost");
      const competitionWon = rows.filter((row) => row.outcome === "won").length;
      const competitionLost = rows.filter((row) => row.outcome === "lost").length;
      const coverage: EngineCompetitionRow["coverage"] =
        decisive.length >= 2 * MIN_RELIABLE_SAMPLE ? "good" : decisive.length >= MIN_RELIABLE_SAMPLE ? "limited" : "insufficient";
      return {
        key,
        label: key,
        generated: rows.length + (pendingByLeague.get(key) ?? 0),
        settled: decisive.length,
        won: competitionWon,
        lost: competitionLost,
        hitRate: rate(competitionWon, competitionWon + competitionLost),
        coverage,
      } satisfies EngineCompetitionRow;
    })
    .sort((left, right) => right.settled - left.settled);
}

function calibrationBuckets(settled: GradedFixture[]): CalibrationBucket[] {
  const bands: { key: string; label: string; min: number; max: number }[] = [
    { key: "lt50", label: "Under 50%", min: 0, max: 49.999 },
    { key: "50", label: "50–59%", min: 50, max: 59.999 },
    { key: "60", label: "60–69%", min: 60, max: 69.999 },
    { key: "70", label: "70–79%", min: 70, max: 79.999 },
    { key: "80", label: "80–89%", min: 80, max: 89.999 },
    { key: "90", label: "90–99%", min: 90, max: 100.001 },
  ];

  return bands
    .map((band) => {
      const rows = settled.filter(
        (row) => row.estimatedProbability >= band.min && row.estimatedProbability < band.max,
      );
      const won = rows.filter((row) => row.outcome === "won").length;
      const average = rows.length
        ? rows.reduce((sum, row) => sum + row.estimatedProbability, 0) / rows.length
        : 0;
      return {
        key: band.key,
        label: band.label,
        predictions: rows.length,
        averageProbability: round1(average),
        observedRate: rate(won, rows.length),
        reliable: rows.length >= MIN_CALIBRATION_SAMPLE,
      } satisfies CalibrationBucket;
    })
    .filter((bucket) => bucket.predictions > 0);
}

function modelRows(ledger: GradedFixture[], pending: PendingPrediction[]): ModelVersionRow[] {
  const grouped = new Map<string, GradedFixture[]>();
  for (const row of ledger) {
    const key = row.modelVersion || "unspecified";
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const pendingByModel = new Map<string, number>();
  for (const row of pending) {
    const key = row.modelVersion || "unspecified";
    pendingByModel.set(key, (pendingByModel.get(key) ?? 0) + 1);
  }

  const keys = new Set<string>([...grouped.keys(), ...pendingByModel.keys()]);

  return [...keys]
    .map((version) => {
      const rows = grouped.get(version) ?? [];
      const decisive = rows.filter((row) => row.outcome === "won" || row.outcome === "lost");
      const dates = rows.map((row) => row.settledAt).filter(Boolean).sort();
      const modelWon = rows.filter((row) => row.outcome === "won").length;
      return {
        version,
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
        generated: rows.length + (pendingByModel.get(version) ?? 0),
        settled: decisive.length,
        won: modelWon,
        hitRate: rate(modelWon, decisive.length),
        brier: meanBrier(decisive),
        logLoss: meanLogLoss(decisive),
      } satisfies ModelVersionRow;
    })
    .sort((left, right) => right.settled - left.settled);
}

function engineNotes(): string[] {
  return [
    "Every graded prediction was recorded before kickoff and graded against the final score. Predictions made after a result is known are never included.",
    "Brier score and log loss use the probability the engine stated at prediction time. For both, lower is better.",
    `Calibration buckets with fewer than ${MIN_CALIBRATION_SAMPLE} decisive predictions are marked insufficient rather than read as a pattern.`,
    "A high hit rate from a small sample is not evidence of model quality, and data volume alone does not prove accuracy.",
  ];
}

/* -------------------------------------------------------------------- shared */

function buildFilters(legs: Leg[], ledger: GradedFixture[]): InsightsFilters {
  const competitions = new Map<string, string>();
  for (const leg of legs) if (leg.competition) competitions.set(leg.competition, leg.competition);
  for (const row of ledger) if (row.leagueName) competitions.set(row.leagueName, row.leagueName);

  const markets = new Map<string, string>();
  for (const leg of legs) markets.set(leg.marketKey, marketCategories[leg.marketKey as MarketCategoryKey]?.label ?? leg.marketLabel);
  for (const row of ledger) markets.set(row.market, marketCategories[row.market]?.label ?? row.market);

  return {
    competitions: [...competitions.entries()]
      .map(([key, label]) => ({ key, label }) satisfies InsightsFilterOption)
      .sort((left, right) => left.label.localeCompare(right.label)),
    markets: [...markets.entries()]
      .map(([key, label]) => ({ key, label }) satisfies InsightsFilterOption)
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

function groupRows(legs: Leg[], keyOf: (leg: Leg) => string, labelOf: (leg: Leg) => string): BreakdownRow[] {
  const grouped = new Map<string, { label: string; legs: Leg[] }>();
  for (const leg of legs) {
    const key = keyOf(leg);
    const bucket = grouped.get(key) ?? { label: labelOf(leg), legs: [] };
    bucket.legs.push(leg);
    grouped.set(key, bucket);
  }

  return [...grouped.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      ...tally(bucket.legs),
      reliable: bucket.legs.filter((leg) => leg.outcome === "won" || leg.outcome === "lost").length >= MIN_RELIABLE_SAMPLE,
    }))
    .sort((left, right) => right.settled - left.settled || right.label.localeCompare(left.label));
}

function tally(legs: Leg[]): PerformanceCount {
  const counts = emptyCount();
  for (const leg of legs) {
    if (leg.outcome === "won") counts.won += 1;
    else if (leg.outcome === "lost") counts.lost += 1;
    else if (leg.outcome === "push") counts.push += 1;
    else if (leg.outcome === "void") counts.voided += 1;
  }
  counts.settled = counts.won + counts.lost;
  counts.winRate = rate(counts.won, counts.settled);
  return counts;
}

function emptyCount(): PerformanceCount {
  return { settled: 0, won: 0, lost: 0, push: 0, voided: 0, winRate: 0 };
}

function inRange(ms: number, request: InsightsRequest): boolean {
  if (!ms) return request.fromMs === null && request.toMs === null;
  if (request.fromMs !== null && ms < request.fromMs) return false;
  if (request.toMs !== null && ms > request.toMs) return false;
  return true;
}

function bucketKey(ms: number, grain: InsightsGrain, tzOffset: number): { key: string; label: string } {
  const date = new Date(ms - tzOffset * 60_000);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");

  if (grain === "hour") return { key: `${year}-${pad(month)}-${pad(day)}T${pad(date.getUTCHours())}`, label: `${pad(date.getUTCHours())}:00` };
  if (grain === "day") return { key: `${year}-${pad(month)}-${pad(day)}`, label: `${day}/${month}` };
  if (grain === "week") {
    const dayMs = Date.UTC(year, month - 1, day);
    const mondayOffset = (new Date(dayMs).getUTCDay() + 6) % 7;
    const monday = new Date(dayMs - mondayOffset * 86_400_000);
    return { key: `w${monday.toISOString().slice(0, 10)}`, label: `${monday.getUTCDate()}/${monday.getUTCMonth() + 1}` };
  }
  return { key: `${year}-${pad(month)}`, label: `${MONTH_SHORT[month - 1]} ${String(year).slice(2)}` };
}

function rate(part: number, total: number): number {
  return total > 0 ? round1((part / total) * 100) : 0;
}

function meanBrier(rows: GradedFixture[]): number | null {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + brier(row), 0);
  return round4(total / rows.length);
}

function meanLogLoss(rows: GradedFixture[]): number | null {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + logLoss(row), 0);
  return round4(total / rows.length);
}

/** Brier score for a single pick: the squared distance between stated probability and outcome. */
function brier(row: GradedFixture): number {
  const probability = clampProbability(row.estimatedProbability / 100);
  const actual = row.outcome === "won" ? 1 : 0;
  return (probability - actual) ** 2;
}

/** Log loss for a single pick, with the probability clamped away from exactly 0 or 1. */
function logLoss(row: GradedFixture): number {
  const probability = clampProbability(row.estimatedProbability / 100);
  const actual = row.outcome === "won" ? 1 : 0;
  return -(actual * Math.log(probability) + (1 - actual) * Math.log(1 - probability));
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(Math.max(value, 1e-15), 1 - 1e-15);
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

/* ------------------------------------------------------------------ firestore */

async function readGradedLedger(): Promise<GradedFixture[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snapshot = await db
      .collection(COLLECTIONS.predictionResults)
      .orderBy("settledAt", "desc")
      .limit(MAX_ENGINE_RESULTS)
      .get();
    return snapshot.docs
      .map((doc) => toGraded(doc.id, doc.data() as Record<string, unknown>))
      .filter((row): row is GradedFixture => row !== null);
  } catch {
    return [];
  }
}

async function readPendingPredictions(): Promise<PendingPrediction[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snapshot = await db
      .collection(COLLECTIONS.predictions)
      .where("status", "==", "pending")
      .limit(MAX_PENDING_SCAN)
      .get();
    return snapshot.docs.flatMap((doc) => {
      const data = doc.data() as Record<string, unknown>;
      if (typeof data.market !== "string") return [];
      return [
        {
          market: data.market as MarketCategoryKey,
          leagueName: text(data.leagueName),
          kickoff: text(data.kickoff),
          modelVersion: text(data.modelVersion),
        } satisfies PendingPrediction,
      ];
    });
  } catch {
    return [];
  }
}

function unconfiguredPersonal(): PersonalInsights {
  return {
    configured: false,
    summary: { ...emptyCount(), entries: 0, selections: 0, open: 0, unevaluable: 0 },
    entryLevel: emptyCount(),
    trend: [],
    byMarket: [],
    byCompetition: [],
    bySource: [],
    comparison: {
      tracked: 0,
      comparable: 0,
      same: 0,
      changed: 0,
      alternativeWon: 0,
      recommendationWon: 0,
      bothWon: 0,
      bothLost: 0,
      unavailable: 0,
    },
    observations: [],
    notes: [],
  };
}

function unconfiguredEngine(notice: string): EngineInsights {
  return {
    configured: false,
    settled: 0,
    won: 0,
    lost: 0,
    push: 0,
    voided: 0,
    pending: 0,
    hitRate: 0,
    brier: null,
    logLoss: null,
    periodFrom: null,
    periodTo: null,
    byMarket: [],
    byCompetition: [],
    calibration: [],
    models: [],
    coverage: { competitions: 0, marketsEvaluated: 0, marketsLimited: 0, excluded: 0 },
    notes: [],
    notice,
  };
}
