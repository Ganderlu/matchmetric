import "server-only";

import { getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/football/cache";
import { gradeSettlement } from "@/lib/football/accuracy";
import { marketCategories } from "@/lib/football/markets";
import type { MarketCategoryKey } from "@/lib/football/types";
import type {
  ManualPredictionResult,
  SavedSelectionRecord,
  SettlementTarget,
} from "@/lib/manual-predictions";

/**
 * Shared access to the graded prediction ledger.
 *
 * A member's own saved selections are graded from two stored sources: the entry they saved
 * (`users/{uid}/savedPredictions`) and the engine's settled ledger (`prediction_results`, written
 * by `settleDuePredictions`). The resolution and grading rules below live in one place so a pick
 * is scored identically wherever it is read — the engine's own outcome is never substituted for
 * the member's, and a selection whose settlement target cannot be resolved is reported as
 * unevaluable rather than guessed.
 */

export const MAX_SAVED_ENTRIES = 200;
export const LEDGER_READ_CHUNK = 100;

/** A single selection's graded state, before it is folded into a summary. */
export type LegOutcome = "won" | "lost" | "push" | "void" | "open" | "unevaluable";

/** A row from the graded engine ledger. */
export interface GradedFixture {
  fixtureId: string;
  leagueName: string;
  kickoff: string;
  outcome: "won" | "lost" | "push" | "void";
  homeScore: number | null;
  awayScore: number | null;
  settledAt: string;
  market: MarketCategoryKey;
  marketLabel: string;
  selection: string;
  odds: number;
  estimatedProbability: number;
  modelVersion: string;
}

/** A saved prediction entry with its engine results and the member's own recorded picks. */
export interface SavedEntry {
  id: string;
  /** Instant the entry was saved, as an ISO string, or "" when the record carries no date. */
  savedAt: string;
  results: ManualPredictionResult[];
  selections: SavedSelectionRecord[];
}

/** Reverse lookup so a saved selection's market label maps back onto a canonical category. */
const MARKET_KEY_BY_LABEL = new Map<string, MarketCategoryKey>(
  Object.values(marketCategories).map((category) => [category.label.toLowerCase(), category.key]),
);

/**
 * Resolve a recorded selection back to a canonical settlement target.
 *
 * The saved `market` is a display label, so it is matched against the category labels of the
 * markets the engine evaluated for that fixture. A selection that is not among them can only be
 * graded when it is the engine's own recommendation.
 */
export function resolveRecordedPick(
  result: ManualPredictionResult,
  recorded: SavedSelectionRecord,
): { settlement: SettlementTarget; category: MarketCategoryKey } | null {
  const label = recorded.market.trim().toLowerCase();
  const offered = result.bestAvailableMarkets.find(
    (market) =>
      market.selection === recorded.selection &&
      ((marketCategories[market.category]?.label ?? market.market).toLowerCase() === label ||
        market.market.toLowerCase() === label),
  );
  if (offered) return { settlement: offered.settlement, category: offered.category };

  if (result.recommendedSettlement && recorded.selection === result.recommendedSelection && result.recommendedMarket) {
    return { settlement: result.recommendedSettlement, category: result.recommendedMarket };
  }

  const category = MARKET_KEY_BY_LABEL.get(label);
  const matching = category
    ? result.bestAvailableMarkets.find(
        (market) => market.category === category && market.selection === recorded.selection,
      )
    : undefined;
  return matching ? { settlement: matching.settlement, category: matching.category } : null;
}

/** Grade one selection from the ledger's final score, never from the engine's own outcome. */
export function gradeLeg(settlement: SettlementTarget | null, ledger: GradedFixture | null): LegOutcome {
  if (settlement === null) return "unevaluable";
  if (!ledger) return "open";
  if (ledger.outcome === "void") return "void";
  if (ledger.homeScore === null || ledger.awayScore === null) return "open";
  return gradeSettlement(settlement, ledger.homeScore, ledger.awayScore);
}

export async function readSavedEntries(uid: string): Promise<SavedEntry[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("savedPredictions")
      .orderBy("createdAt", "desc")
      .limit(MAX_SAVED_ENTRIES)
      .get();

    return snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const results = Array.isArray(data.results) ? (data.results as ManualPredictionResult[]) : [];
      return {
        id: doc.id,
        savedAt: iso(data.createdAt) || text(data.generatedAt) || results[0]?.generatedAt || "",
        results,
        selections: Array.isArray(data.selections) ? (data.selections as SavedSelectionRecord[]) : [],
      } satisfies SavedEntry;
    });
  } catch {
    return [];
  }
}

/** Read the graded ledger for a known set of fixtures, keyed by fixture id. */
export async function readGradedFixtures(ids: string[]): Promise<Map<string, GradedFixture>> {
  const map = new Map<string, GradedFixture>();
  const db = getAdminDb();
  if (!db || !ids.length) return map;

  const unique = [...new Set(ids)];
  try {
    for (let index = 0; index < unique.length; index += LEDGER_READ_CHUNK) {
      const refs = unique
        .slice(index, index + LEDGER_READ_CHUNK)
        .map((id) => db.collection(COLLECTIONS.predictionResults).doc(id));
      const docs = await db.getAll(...refs);
      for (const doc of docs) {
        if (!doc.exists) continue;
        const graded = toGraded(doc.id, doc.data() as Record<string, unknown>);
        if (graded) map.set(graded.fixtureId, graded);
      }
    }
  } catch {
    return map;
  }
  return map;
}

export function toGraded(id: string, data: Record<string, unknown>): GradedFixture | null {
  const outcome = data.outcome;
  if (outcome !== "won" && outcome !== "lost" && outcome !== "push" && outcome !== "void") return null;
  if (typeof data.market !== "string" || !data.market) return null;

  return {
    fixtureId: text(data.fixtureId) || id,
    leagueName: text(data.leagueName),
    kickoff: text(data.kickoff),
    outcome,
    homeScore: typeof data.homeScore === "number" ? data.homeScore : null,
    awayScore: typeof data.awayScore === "number" ? data.awayScore : null,
    settledAt: iso(data.settledAt),
    market: data.market as MarketCategoryKey,
    marketLabel: text(data.marketLabel),
    selection: text(data.selection),
    odds: typeof data.odds === "number" ? data.odds : 0,
    estimatedProbability: typeof data.estimatedProbability === "number" ? data.estimatedProbability : 0,
    modelVersion: text(data.modelVersion),
  };
}

export function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function iso(value: unknown): string {
  const stamp = value as { toDate?: () => Date } | undefined;
  const date = stamp?.toDate?.();
  return date instanceof Date ? date.toISOString() : "";
}
