import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { analyzeFixture, recordRecommendation } from "@/lib/football/prediction-engine";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Manual analysis for one fixture. The route owns authentication and rate limiting; the
 * prediction itself (validation, provider resolution, generation, tracking) is delegated to
 * the central engine so the manual, automatic and screenshot flows share one implementation.
 */
export async function POST(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to run manual analysis." }, { status: 401 });
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
    consume(`manual-analysis:${decoded.uid}:${clientKey(request, "manual-analysis")}`, 10);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  let body: { fixtureIds?: unknown };
  try {
    body = (await request.json()) as { fixtureIds?: unknown };
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const fixtureIds = body.fixtureIds;
  if (
    !Array.isArray(fixtureIds) ||
    fixtureIds.length !== 1 ||
    typeof fixtureIds[0] !== "string"
  ) {
    return NextResponse.json(
      { error: "Analyze one valid, real-provider fixture at a time. Demo fixtures cannot be analyzed." },
      { status: 400 },
    );
  }

  const outcome = await analyzeFixture(fixtureIds[0]);
  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  // A value-qualified pick is filed in the tracked ledger for later accuracy grading.
  await recordRecommendation(outcome.analysis);

  return NextResponse.json(
    { result: outcome.analysis.result, source: outcome.analysis.source },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
