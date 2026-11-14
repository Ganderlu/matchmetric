import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { generateManualPrediction } from "@/lib/football/manual-engine";
import { getMatchCentre } from "@/lib/football/service";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXTURE_ID = /^(sportmonks|api-football):[A-Za-z0-9_-]+$/;

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
    typeof fixtureIds[0] !== "string" ||
    !FIXTURE_ID.test(fixtureIds[0])
  ) {
    return NextResponse.json(
      { error: "Analyze one valid, real-provider fixture at a time. Demo fixtures cannot be analyzed." },
      { status: 400 },
    );
  }

  try {
    const result = await getMatchCentre(fixtureIds[0]);
    const detail = result.detail;
    if (!detail || (result.source !== "provider" && result.source !== "cache")) {
      return NextResponse.json(
        { error: result.notice ?? "Real match information is unavailable for this fixture." },
        { status: result.source === "unconfigured" ? 503 : 404 },
      );
    }

    if (detail.fixture.status !== "scheduled" || Date.parse(detail.fixture.kickoff) <= Date.now()) {
      return NextResponse.json(
        { error: "Manual pre-match analysis is available only for future scheduled fixtures." },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { result: generateManualPrediction(detail), source: result.source },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual analysis is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
