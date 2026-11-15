import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase-admin";
import type { PredictionOutcome, RecordedPrediction, MarketAccuracy, AccuracySummary, SettledPrediction } from "../prediction-tracking";
import { COLLECTIONS } from "./cache";
import { MANUAL_MODEL_VERSION } from "./manual-engine";
import { marketCategories } from "./markets";
import { getFixtureById } from "./service";

/**
 * Accuracy tracking for the central prediction engine.
 *
 * A recommendation is recorded before kickoff and graded against the final score once the
 * match has finished. Grading is done from the canonical `SettlementTarget`, never from a
 * bookmaker's label, so the ledger is provider-independent. Picks waiting on a result are
 * skipped (never guessed), and a postponed or cancelled match is voided rather than counted.
 */

/** Wait past full time before grading, so a provider has published the final score. */
const SETTLE_DELAY_MS = 3 * 60 * 60_000;
/** Cap provider reads per settlement pass so one request cannot fan out without bound. */
const MAX_SETTLE_PER_RUN = 25;
const MAX_RESULTS = 1000;
const MAX_PENDING_SCAN = 1000;
const RECENT_LIMIT = 5;

/** A decided outcome: `push` returns the stake, `void` means no result was recorded. */
type Grade = "won" | "lost" | "push";

/** Grade a canonical settlement target against the final score. */
export function gradeSettlement(
  target: SettledPrediction["settlement"],
  homeScore: number,
  awayScore: number,
): Grade {
  const total = homeScore + awayScore;
  switch (target.market) {
    case "1x2":
      if (target.side === "home") return homeScore > awayScore ? "won" : "lost";
      if (target.side === "draw") return homeScore === awayScore ? "won" : "lost";
      return awayScore > homeScore ? "won" : "lost";
    case "double-chance":
      if (target.side === "home-draw") return homeScore >= awayScore ? "won" : "lost";
      if (target.side === "away-draw") return awayScore >= homeScore ? "won" : "lost";
      // Home or away fails only on a draw.
      return homeScore !== awayScore ? "won" : "lost";
    case "dnb":
      if (homeScore === awayScore) return "push";
      return (target.side === "home" ? homeScore > awayScore : awayScore > homeScore) ? "won" : "lost";
    case "btts": {
      const bothScored = homeScore > 0 && awayScore > 0;
      return (target.side === "yes") === bothScored ? "won" : "lost";
    }
    case "over-under": {
      if (total === target.line) return "push";
      const over = total > target.line;
      return (target.side === "over") === over ? "won" : "lost";
    }
  }
}

/** Profit for one unit staked at the recorded price. */
function profitFor(odds: number, outcome: Grade): number {
  if (outcome === "won") return Number((odds - 1).toFixed(4));
  if (outcome === "lost") return -1;
  return 0;
}

export interface SettlementRun {
  graded: number;
  voided: number;
  skipped: number;
}

/**
 * Grade every pending prediction whose match has finished.
 *
 * Called from the accuracy route so a signed-in member always reads up-to-date numbers
 * without needing a background worker.
 */
export async function settleDuePredictions(): Promise<SettlementRun> {
  const run: SettlementRun = { graded: 0, voided: 0, skipped: 0 };
  const db = getAdminDb();
  if (!db) return run;

  let pending;
  try {
    pending = await db
      .collection(COLLECTIONS.predictions)
      .where("status", "==", "pending")
      .limit(MAX_SETTLE_PER_RUN)
      .get();
  } catch {
    return run;
  }

  const now = Date.now();
  const batch = db.batch();
  let writes = 0;

  for (const doc of pending.docs) {
    const data = doc.data() as RecordedPrediction & { status?: string };
    const kickoff = Date.parse(data.kickoff);
    if (!Number.isFinite(kickoff) || kickoff + SETTLE_DELAY_MS > now || !data.settlement) {
      run.skipped += 1;
      continue;
    }

    const { fixture } = await getFixtureById(doc.id);
    if (!fixture || fixture.status === "scheduled" || fixture.status === "live" || fixture.status === "halftime" || fixture.status === "unknown") {
      run.skipped += 1;
      continue;
    }

    const results = db.collection(COLLECTIONS.predictionResults).doc(doc.id);

    if (fixture.status === "cancelled" || fixture.status === "postponed") {
      batch.set(results, {
        ...recordedFrom(data),
        outcome: "void" satisfies PredictionOutcome,
        homeScore: null,
        awayScore: null,
        profit: 0,
        settledAt: FieldValue.serverTimestamp(),
      });
      batch.update(doc.ref, { status: "settled", outcome: "void", updatedAt: FieldValue.serverTimestamp() });
      run.voided += 1;
      writes += 2;
      continue;
    }

    const homeScore = fixture.score?.home;
    const awayScore = fixture.score?.away;
    if (typeof homeScore !== "number" || typeof awayScore !== "number") {
      run.skipped += 1;
      continue;
    }

    const outcome = gradeSettlement(data.settlement, homeScore, awayScore);
    batch.set(results, {
      ...recordedFrom(data),
      outcome,
      homeScore,
      awayScore,
      profit: profitFor(data.odds, outcome),
      settledAt: FieldValue.serverTimestamp(),
    });
    batch.update(doc.ref, { status: "settled", outcome, updatedAt: FieldValue.serverTimestamp() });
    run.graded += 1;
    writes += 2;
  }

  if (writes) {
    try {
      await batch.commit();
    } catch {
      return { graded: 0, voided: 0, skipped: run.skipped };
    }
  }
  return run;
}

/** Re-read a stored prediction into the typed ledger shape, dropping cache bookkeeping. */
function recordedFrom(data: RecordedPrediction): RecordedPrediction {
  return {
    fixtureId: data.fixtureId,
    leagueName: data.leagueName,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    kickoff: data.kickoff,
    modelVersion: data.modelVersion,
    market: data.market,
    marketLabel: data.marketLabel,
    selection: data.selection,
    settlement: data.settlement,
    odds: data.odds,
    estimatedProbability: data.estimatedProbability,
    confidence: data.confidence,
    dataQuality: data.dataQuality,
    generatedAt: data.generatedAt,
  };
}

/** Aggregate the graded ledger into the accuracy a member sees. */
export async function getAccuracySummary(): Promise<AccuracySummary> {
  const generatedAt = new Date().toISOString();
  const base: AccuracySummary = {
    configured: false,
    settled: 0,
    won: 0,
    lost: 0,
    push: 0,
    voided: 0,
    pending: 0,
    hitRate: 0,
    roi: 0,
    averageOdds: 0,
    modelVersion: MANUAL_MODEL_VERSION,
    byMarket: [],
    recent: [],
    lastSettledAt: null,
    generatedAt,
  };

  const db = getAdminDb();
  if (!db) {
    return { ...base, notice: "Accuracy tracking is not configured on the server." };
  }

  let results: SettledPrediction[] = [];
  try {
    const snapshot = await db
      .collection(COLLECTIONS.predictionResults)
      .orderBy("settledAt", "desc")
      .limit(MAX_RESULTS)
      .get();
    results = snapshot.docs
      .map((doc) => toSettled(doc.id, doc.data()))
      .filter((entry): entry is SettledPrediction => entry !== null);
  } catch {
    return { ...base, configured: true, notice: "Graded predictions could not be read." };
  }

  let pending = 0;
  try {
    const pendingSnapshot = await db
      .collection(COLLECTIONS.predictions)
      .where("status", "==", "pending")
      .limit(MAX_PENDING_SCAN)
      .get();
    pending = pendingSnapshot.size;
  } catch {
    pending = 0;
  }

  const won = results.filter((entry) => entry.outcome === "won").length;
  const lost = results.filter((entry) => entry.outcome === "lost").length;
  const push = results.filter((entry) => entry.outcome === "push").length;
  const voided = results.filter((entry) => entry.outcome === "void").length;
  const decisive = won + lost;
  const graded = results.filter((entry) => entry.outcome === "won" || entry.outcome === "lost");
  const profit = graded.reduce((sum, entry) => sum + entry.profit, 0);

  return {
    configured: true,
    settled: won + lost + push,
    won,
    lost,
    push,
    voided,
    pending,
    hitRate: decisive ? round((won / decisive) * 100) : 0,
    roi: decisive ? round((profit / decisive) * 100) : 0,
    averageOdds: graded.length ? Number((graded.reduce((sum, entry) => sum + entry.odds, 0) / graded.length).toFixed(2)) : 0,
    modelVersion: MANUAL_MODEL_VERSION,
    byMarket: summariseByMarket(results),
    recent: results.filter((entry) => entry.outcome !== "void").slice(0, RECENT_LIMIT),
    lastSettledAt: results[0]?.settledAt ?? null,
    generatedAt,
  };
}

function summariseByMarket(results: SettledPrediction[]): MarketAccuracy[] {
  const grouped = new Map<string, SettledPrediction[]>();
  for (const entry of results) {
    if (entry.outcome === "void") continue;
    const list = grouped.get(entry.market) ?? [];
    list.push(entry);
    grouped.set(entry.market, list);
  }

  return [...grouped.entries()]
    .map(([market, entries]) => {
      const marketWon = entries.filter((entry) => entry.outcome === "won").length;
      const marketLost = entries.filter((entry) => entry.outcome === "lost").length;
      const marketPush = entries.filter((entry) => entry.outcome === "push").length;
      const marketDecisive = marketWon + marketLost;
      const marketProfit = entries.reduce((sum, entry) => sum + entry.profit, 0);
      return {
        market: market as MarketAccuracy["market"],
        marketLabel: marketCategories[market as MarketAccuracy["market"]]?.label ?? market,
        settled: marketDecisive,
        won: marketWon,
        lost: marketLost,
        push: marketPush,
        hitRate: marketDecisive ? round((marketWon / marketDecisive) * 100) : 0,
        roi: marketDecisive ? round((marketProfit / marketDecisive) * 100) : 0,
      } satisfies MarketAccuracy;
    })
    .sort((left, right) => right.settled - left.settled);
}

function toSettled(id: string, data: Record<string, unknown>): SettledPrediction | null {
  if (!data || typeof data.settlement !== "object" || data.settlement === null) return null;
  const outcome = data.outcome;
  if (outcome !== "won" && outcome !== "lost" && outcome !== "push" && outcome !== "void") return null;

  const settlement = data.settlement as SettledPrediction["settlement"];
  const market = data.market as SettledPrediction["market"];

  return {
    fixtureId: text(data.fixtureId, id),
    leagueName: text(data.leagueName, ""),
    homeTeam: text(data.homeTeam, ""),
    awayTeam: text(data.awayTeam, ""),
    kickoff: text(data.kickoff, ""),
    modelVersion: text(data.modelVersion, ""),
    market,
    marketLabel: text(data.marketLabel, marketCategories[market]?.label ?? ""),
    selection: text(data.selection, ""),
    settlement,
    odds: numberOr(data.odds, 0),
    estimatedProbability: numberOr(data.estimatedProbability, 0),
    confidence: confidenceOr(data.confidence),
    dataQuality: qualityOr(data.dataQuality),
    generatedAt: text(data.generatedAt, ""),
    outcome,
    homeScore: typeof data.homeScore === "number" ? data.homeScore : null,
    awayScore: typeof data.awayScore === "number" ? data.awayScore : null,
    profit: numberOr(data.profit, 0),
    settledAt: toIso(data.settledAt),
  };
}

function confidenceOr(value: unknown): SettledPrediction["confidence"] {
  return value === "High" || value === "Medium" || value === "Low" ? value : null;
}

function qualityOr(value: unknown): SettledPrediction["dataQuality"] {
  return value === "Good" || value === "Limited" || value === "Insufficient" ? value : "Limited";
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toIso(value: unknown): string {
  const stamp = value as { toDate?: () => Date } | undefined;
  const date = stamp?.toDate?.();
  return date instanceof Date ? date.toISOString() : "";
}

function round(value: number): number {
  return Number(value.toFixed(1));
}
