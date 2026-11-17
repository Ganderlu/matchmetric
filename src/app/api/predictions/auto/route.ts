import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { analyzeFixture } from "@/lib/football/prediction-engine";
import { marketCategories } from "@/lib/football/markets";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";
import type { EvaluatedMarket, ManualPredictionResult, PredictionConfidence } from "@/lib/manual-predictions";
import type { AutoPick, AutoPickMode, AutoPicksResponse } from "@/types/slip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Automatic picks.
 *
 * This route does not invent selections: it runs the same central engine the manual and
 * screenshot flows use (`analyzeFixture`) across a candidate set and returns only markets the
 * engine already priced with a positive expected value. Every returned pick therefore arrives
 * with its analysis attached, which is why automatic slip cards never show an Analyse control.
 *
 * The engine owns probabilities, odds and confidence. This route only ranks, filters and
 * explains what it filtered out.
 */

const MAX_CANDIDATES = 12;
const MAX_PICKS = 5;

interface AutoRequestBody {
  fixtureIds?: unknown;
  mode?: unknown;
  matchResultOnly?: unknown;
  onePerLeague?: unknown;
  limit?: unknown;
  leagues?: unknown;
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to generate automatic picks." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await verifySessionCookie(session);
  } catch {
    decoded = null;
  }
  if (!decoded) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  try {
    consume(`auto-picks:${decoded.uid}:${clientKey(request, "auto-picks")}`, 4);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  let body: AutoRequestBody;
  try {
    body = (await request.json()) as AutoRequestBody;
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const fixtureIds = Array.isArray(body.fixtureIds)
    ? body.fixtureIds.filter((id): id is string => typeof id === "string")
    : [];
  if (!fixtureIds.length || fixtureIds.length > MAX_CANDIDATES) {
    return NextResponse.json(
      { error: `Choose between one and ${MAX_CANDIDATES} candidate fixtures to generate picks.` },
      { status: 400 },
    );
  }

  const mode: AutoPickMode = body.mode === "probability" ? "probability" : "value";
  const matchResultOnly = body.matchResultOnly === true;
  const onePerLeague = body.onePerLeague === true;
  const limit = Math.min(MAX_PICKS, Math.max(1, typeof body.limit === "number" ? Math.floor(body.limit) : MAX_PICKS));
  const leagues = Array.isArray(body.leagues)
    ? body.leagues.filter((id): id is string => typeof id === "string")
    : [];

  const candidates: AutoPick[] = [];
  const unavailable: string[] = [];
  let evaluated = 0;

  for (const fixtureId of Array.from(new Set(fixtureIds))) {
    const outcome = await analyzeFixture(fixtureId);
    if (!outcome.ok) {
      unavailable.push(outcome.error);
      continue;
    }
    evaluated += 1;

    const { result } = outcome.analysis;
    if (result.analysisStatus !== "recommended") continue;
    if (leagues.length) {
      // ManualPredictionResult carries the competition name, not its id, so match on name.
      if (!leagues.includes(result.leagueName)) continue;
    }

    const priced = result.bestAvailableMarkets.filter(
      (market) => market.expectedValue > 0 && (!matchResultOnly || market.category === "match-winner"),
    );
    if (!priced.length) continue;

    const chosen = mode === "probability"
      ? priced.reduce((best, market) => (market.estimatedProbability > best.estimatedProbability ? market : best))
      : priced.reduce((best, market) => (market.expectedValue > best.expectedValue ? market : best));

    const confidence: PredictionConfidence = result.confidence ?? "Low";
    candidates.push(toAutoPick(chosen, result, confidence, outcome.analysis.source));
  }

  const deduped = onePerLeague ? onePerLeagueBest(candidates, mode) : candidates;
  const ranked = deduped.sort((left, right) =>
    mode === "probability" ? right.probability - left.probability : (right.expectedValue ?? 0) - (left.expectedValue ?? 0),
  );
  const picks = ranked.slice(0, limit);

  const notice = picks.length
    ? unavailable.length
      ? `${unavailable[0]} Other fixtures were still evaluated.`
      : undefined
    : unavailable[0] ??
      `No candidate had a priced selection with positive estimated expected value${matchResultOnly ? " in a match-result market" : ""}. MatchMetric does not generate picks without one.`;

  const payload: AutoPicksResponse = { picks, evaluated, notice };
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

function toAutoPick(
  market: EvaluatedMarket,
  result: ManualPredictionResult,
  confidence: PredictionConfidence,
  source: AutoPick["source"],
): AutoPick {
  return {
    fixtureId: result.fixtureId,
    homeTeam: result.homeTeam.name,
    awayTeam: result.awayTeam.name,
    competition: result.leagueName,
    kickoff: result.kickoff,
    dataQuality: result.dataQuality,
    confidence,
    source,
    modelVersion: result.modelVersion,
    generatedAt: result.generatedAt,
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

function onePerLeagueBest(picks: AutoPick[], mode: AutoPickMode): AutoPick[] {
  const best = new Map<string, AutoPick>();
  for (const pick of picks) {
    const current = best.get(pick.competition);
    const better =
      !current ||
      (mode === "probability"
        ? pick.probability > current.probability
        : (pick.expectedValue ?? 0) > (current.expectedValue ?? 0));
    if (better) best.set(pick.competition, pick);
  }
  return Array.from(best.values());
}
