import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { getAccuracySummary, settleDuePredictions } from "@/lib/football/accuracy";
import { consume, RateLimitError } from "@/lib/football/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accuracy tracking for the central prediction engine.
 *
 * Each read first grades any pending prediction whose match has finished, then returns the
 * rolled-up ledger. Grading needs only one provider read per due fixture, so it is capped
 * inside the accuracy module rather than scheduled as a separate worker.
 */
export async function GET(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to view model accuracy." }, { status: 401 });
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
    consume(`accuracy:${decoded.uid}`, 30);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  await settleDuePredictions();
  const summary = await getAccuracySummary();

  return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
}
