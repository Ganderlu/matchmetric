import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase-admin";
import type { ManualPredictionResult } from "../manual-predictions";
import type { RecordedPrediction } from "../prediction-tracking";
import { COLLECTIONS } from "./cache";
import { generateManualPrediction, MANUAL_MODEL_VERSION } from "./manual-engine";
import { getMatchCentre, type MatchCentreResult } from "./service";
import type { DataSource } from "./types";

/**
 * The central prediction engine.
 *
 * Every prediction surface (manual analysis today, automatic or screenshot analysis later)
 * resolves a fixture through `analyzeFixture` and commits an actionable pick through
 * `recordRecommendation`. That keeps one definition of "how a prediction is made" and one
 * place a pick enters the tracked `predictions` collection, so accuracy tracking grades the
 * same model the UI shows.
 *
 * Nothing is invented here: the model withholds a recommendation when the required
 * provider data is missing, and only a value-qualified pick is ever recorded.
 */

/** Provider-scoped fixture id, e.g. "sportmonks:19427186". */
const FIXTURE_ID = /^(sportmonks|api-football):[A-Za-z0-9_-]+$/;

export interface FixtureAnalysis {
  result: ManualPredictionResult;
  source: DataSource;
}

export type AnalysisOutcome =
  | { ok: true; analysis: FixtureAnalysis }
  | { ok: false; status: number; error: string };

/**
 * Run the model on one fixture.
 *
 * Validation and provider resolution live with the engine rather than in each route, so a
 * caller gets one consistent, correctly-typed answer.
 */
export async function analyzeFixture(fixtureId: string): Promise<AnalysisOutcome> {
  if (!FIXTURE_ID.test(fixtureId)) {
    return {
      ok: false,
      status: 400,
      error: "Analyze one valid, real-provider fixture at a time. Demo fixtures cannot be analyzed.",
    };
  }

  let match: MatchCentreResult;
  try {
    match = await getMatchCentre(fixtureId);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Manual analysis is temporarily unavailable.",
    };
  }

  const detail = match.detail;
  if (!detail || (match.source !== "provider" && match.source !== "cache")) {
    return {
      ok: false,
      status: match.source === "unconfigured" ? 503 : 404,
      error: match.notice ?? "Real match information is unavailable for this fixture.",
    };
  }

  if (detail.fixture.status !== "scheduled" || Date.parse(detail.fixture.kickoff) <= Date.now()) {
    return {
      ok: false,
      status: 422,
      error: "Manual pre-match analysis is available only for future scheduled fixtures.",
    };
  }

  return {
    ok: true,
    analysis: { result: generateManualPrediction(detail), source: match.source },
  };
}

/**
 * Commit a value-qualified recommendation to the central `predictions` collection, keyed by
 * fixture id so re-running analysis is idempotent. Non-actionable results and a server
 * without Firestore credentials are both skipped silently — tracking must never fail the
 * analysis response.
 */
export async function recordRecommendation(analysis: FixtureAnalysis): Promise<void> {
  const { result } = analysis;
  if (
    result.analysisStatus !== "recommended" ||
    !result.recommendedMarket ||
    !result.recommendedSettlement ||
    typeof result.availableOdds !== "number" ||
    typeof result.estimatedProbability !== "number"
  ) {
    return;
  }

  const db = getAdminDb();
  if (!db) return;

  const record: RecordedPrediction = {
    fixtureId: result.fixtureId,
    leagueName: result.leagueName,
    homeTeam: result.homeTeam.name,
    awayTeam: result.awayTeam.name,
    kickoff: result.kickoff,
    modelVersion: result.modelVersion || MANUAL_MODEL_VERSION,
    market: result.recommendedMarket,
    marketLabel: result.marketLabel ?? "",
    selection: result.recommendedSelection ?? "",
    settlement: result.recommendedSettlement,
    odds: result.availableOdds,
    estimatedProbability: result.estimatedProbability,
    confidence: result.confidence,
    dataQuality: result.dataQuality,
    generatedAt: result.generatedAt,
  };

  try {
    await db.collection(COLLECTIONS.predictions).doc(result.fixtureId).set({
      ...record,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Best-effort: a tracking write must never surface as an analysis error.
  }
}
