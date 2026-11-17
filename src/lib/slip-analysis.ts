import { marketCategories } from "@/lib/football/markets";
import type { DataSource } from "@/lib/football/types";
import type { EvaluatedMarket, ManualPredictionResult } from "@/lib/manual-predictions";
import type { FixtureView } from "@/lib/football/views";
import {
  MAX_ALTERNATIVES,
  type AutoPick,
  type AutoPickFilters,
  type AutoPicksResponse,
  type ExtractedSelection,
  type SlipEntry,
  type SlipPrediction,
  type SlipSelection,
} from "@/types/slip";

/**
 * Browser-side bridge between the slip UI and the central prediction engine.
 *
 * The UI never computes a probability or an odds value: it posts a fixture to
 * `/api/predictions/manual` (or `/api/predictions/auto`) and maps the engine's evaluated
 * markets onto the slip's presentation shape. When the engine withholds a recommendation the
 * mapping carries the reason through instead of substituting anything.
 *
 * Only fixtures backed by a real provider can be analysed; the engine rejects the rest, and
 * `isAnalysableFixture` lets the UI say so before a request is even made.
 */

const ANALYSABLE_FIXTURE_ID = /^(sportmonks|api-football):[A-Za-z0-9_-]+$/;

export function isAnalysableFixture(fixtureId: string): boolean {
  return ANALYSABLE_FIXTURE_ID.test(fixtureId);
}

export interface FixtureAnalysisPayload {
  result: ManualPredictionResult;
  source: DataSource;
}

export async function requestFixtureAnalysis(fixtureId: string): Promise<FixtureAnalysisPayload> {
  const response = await fetch("/api/predictions/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixtureIds: [fixtureId] }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { result?: ManualPredictionResult; source?: DataSource; error?: string }
    | null;

  if (!response.ok || !payload?.result) {
    throw new Error(payload?.error ?? "The analysis service did not return a result.");
  }
  return { result: payload.result, source: payload.source ?? "provider" };
}

export interface SavedSelectionInput extends SlipSelection {
  fixtureId: string;
  source: SlipEntry["source"];
  odds?: number;
  probability?: number;
}

export async function saveSlipPredictions(
  fixtureIds: string[],
  selections: SavedSelectionInput[],
): Promise<{ id: string }> {
  const response = await fetch("/api/predictions/saved", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixtureIds, selections }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { prediction?: { id?: string }; error?: string }
    | null;

  if (!response.ok || !payload?.prediction?.id) {
    throw new Error(payload?.error ?? "The prediction could not be saved to Open Games.");
  }
  return { id: payload.prediction.id };
}

export async function requestAutoPicks(
  fixtureIds: string[],
  filters: AutoPickFilters,
): Promise<AutoPicksResponse> {
  const response = await fetch("/api/predictions/auto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixtureIds, ...filters }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (AutoPicksResponse & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Automatic picks could not be generated.");
  }
  return { picks: payload.picks ?? [], evaluated: payload.evaluated ?? 0, notice: payload.notice };
}

/** Map one engine-evaluated market onto the slip's display shape. */
export function toSlipPrediction(market: EvaluatedMarket): SlipPrediction {
  return {
    category: market.category,
    market: market.market,
    marketLabel: marketCategories[market.category]?.label ?? market.market,
    selection: market.selection,
    probability: market.estimatedProbability,
    impliedProbability: market.impliedProbability,
    odds: market.odds,
    expectedValue: market.expectedValue,
    settlement: market.settlement,
  };
}

/**
 * Turn an engine result into the slip fields.
 *
 * The engine returns its evaluated markets sorted by expected value, so the recommendation is
 * matched by identity against the reported recommendation rather than assumed to be the first
 * entry. Highest Probability and Best Value are then derived as two separate rankings of the
 * remaining markets — they are deliberately not merged, because the highest-probability
 * selection is not necessarily the best-value one.
 */
export function analysisToEntryPatch(
  result: ManualPredictionResult,
  source: DataSource,
): Partial<SlipEntry> {
  const evaluated = result.bestAvailableMarkets;
  const ranked = evaluated.map((market) => toSlipPrediction(market));

  const recommendationIndex = evaluated.findIndex(
    (market) =>
      market.category === result.recommendedMarket &&
      market.selection === result.recommendedSelection &&
      market.odds === result.availableOdds,
  );
  const recommendation =
    result.analysisStatus === "recommended"
      ? ranked[recommendationIndex >= 0 ? recommendationIndex : 0]
      : undefined;

  const others = ranked.filter((_, index) => index !== (recommendationIndex >= 0 ? recommendationIndex : -1));

  return {
    status: "analysed",
    analysisStatus: result.analysisStatus,
    analysisSource: source,
    dataQuality: result.dataQuality,
    confidence: result.confidence ?? undefined,
    modelVersion: result.modelVersion,
    generatedAt: result.generatedAt,
    matchMetricRecommendation: recommendation,
    highestProbability: [...others]
      .sort((left, right) => right.probability - left.probability)
      .slice(0, MAX_ALTERNATIVES),
    bestValue: [...others]
      .sort((left, right) => (right.expectedValue ?? -Infinity) - (left.expectedValue ?? -Infinity))
      .slice(0, MAX_ALTERNATIVES),
    analysisNote: analysisNote(result),
  };
}

function analysisNote(result: ManualPredictionResult): string | undefined {
  if (result.analysisStatus === "recommended") return undefined;
  if (result.analysisStatus === "insufficient") {
    return (
      result.weakeningFactors[0] ??
      "MatchMetric withheld a recommendation because the required recent form is missing."
    );
  }
  return (
    result.keyInsights[result.keyInsights.length - 1] ??
    "No offered selection has positive estimated expected value at the provider's listed price."
  );
}

/** The selection the user has settled on, falling back to the engine's recommendation. */
export function effectiveSelection(entry: SlipEntry): SlipSelection | undefined {
  if (entry.userSelectedPrediction) return entry.userSelectedPrediction;
  if (entry.matchMetricRecommendation) {
    return {
      market: entry.matchMetricRecommendation.marketLabel,
      selection: entry.matchMetricRecommendation.selection,
    };
  }
  return undefined;
}

/** The price behind the entry's current selection, when it is a priced engine market. */
export function effectivePrediction(entry: SlipEntry): SlipPrediction | undefined {
  const selected = entry.userSelectedPrediction;
  if (!selected) return entry.matchMetricRecommendation;
  const pool = [
    ...(entry.matchMetricRecommendation ? [entry.matchMetricRecommendation] : []),
    ...entry.highestProbability,
    ...entry.bestValue,
  ];
  return pool.find(
    (prediction) =>
      prediction.selection === selected.selection && prediction.marketLabel === selected.market,
  );
}

/** Turn an automatic pick into a slip entry, keeping its pre-analysed status. */
export function autoPickToEntry(pick: AutoPick): SlipEntry {
  return {
    fixtureId: pick.fixtureId,
    homeTeam: pick.homeTeam,
    awayTeam: pick.awayTeam,
    competition: pick.competition,
    leagueFlag: pick.leagueFlag,
    kickoff: pick.kickoff,
    source: "automatic",
    status: "analysed",
    provider: "sportmonks",
    analysable: true,
    addedAt: new Date().toISOString(),
    matchMetricRecommendation: pick,
    highestProbability: [],
    bestValue: [],
    analysisStatus: "recommended",
    analysisSource: pick.source,
    dataQuality: pick.dataQuality,
    confidence: pick.confidence,
    modelVersion: pick.modelVersion,
    generatedAt: pick.generatedAt,
  };
}

export function entryFromFixture(
  fixture: FixtureView,
  source: SlipEntry["source"],
): Omit<SlipEntry, "addedAt"> {
  return {
    fixtureId: fixture.id,
    homeTeam: fixture.home.name,
    awayTeam: fixture.away.name,
    competition: fixture.league.name,
    leagueFlag: fixture.league.flag,
    kickoff: fixture.kickoff,
    source,
    status: "pending",
    provider: fixture.provider,
    analysable: isAnalysableFixture(fixture.id),
    highestProbability: [],
    bestValue: [],
  };
}

/** Spread of a slip, used by the share summary. */
export function slipOddsTotal(entries: SlipEntry[]): number | undefined {
  const prices = entries
    .map((entry) => effectivePrediction(entry)?.odds)
    .filter((odds): odds is number => typeof odds === "number");
  if (!prices.length) return undefined;
  return prices.reduce((total, price) => total * price, 1);
}

export function composeSlipSummary(entries: SlipEntry[]): string {
  const lines = entries.map((entry) => {
    const prediction = effectivePrediction(entry);
    const selection = prediction
      ? `${prediction.marketLabel} — ${prediction.selection} (${prediction.probability.toFixed(1)}%${prediction.odds ? ` @ ${prediction.odds.toFixed(2)}` : ""})`
      : "Awaiting analysis";
    return `• ${entry.homeTeam} vs ${entry.awayTeam} — ${entry.competition}\n  ${selection}`;
  });
  const total = slipOddsTotal(entries);
  return [
    "MatchMetric Slip",
    new Date().toLocaleDateString(),
    "",
    ...lines,
    "",
    total ? `Combined price: ${total.toFixed(2)}` : "Combined price: unavailable for unanalysed selections",
    "Analysis shown is MatchMetric's data-led estimate, not a guarantee of any outcome.",
  ].join("\n");
}

/** Demonstration selections used until the screenshot OCR service is connected. */
export function buildDemonstrationExtraction(fixtures: FixtureView[], fileName: string, previewUrl: string) {
  const selections: ExtractedSelection[] = fixtures.slice(0, 3).map((fixture, index) => ({
    id: `${fixture.id}-demo-${index}`,
    homeTeam: fixture.home.name,
    awayTeam: fixture.away.name,
    competition: fixture.league.name,
    kickoff: fixture.kickoff,
    market: index === 2 ? "Both teams to score" : "Match winner",
    selection: index === 0 ? `${fixture.home.name} or draw` : index === 1 ? fixture.away.name : "Yes",
    confidence: index === 2 ? "low" : "medium",
    fixtureId: fixture.id,
    note:
      index === 2
        ? "Low-confidence read: confirm the market and outcome before adding it."
        : "Demonstration extraction. OCR and image recognition are not connected yet.",
  }));

  return { fileName, previewUrl, selections, demonstration: true };
}
