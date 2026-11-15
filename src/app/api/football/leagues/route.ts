import { NextResponse } from "next/server";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";
import { getTrackedLeagues } from "@/lib/football/service";

/**
 * The competitions MatchMetric tracks, resolved to the active provider's own competition
 * ids so the dashboard filters by id instead of by a display name.
 *
 * GET /api/football/leagues
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUESTS_PER_MINUTE = 60;

export async function GET(request: Request) {
  try {
    consume(clientKey(request, "leagues"), REQUESTS_PER_MINUTE);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  try {
    const result = await getTrackedLeagues();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  } catch (error) {
    console.error("Football leagues route failed:", error);
    return NextResponse.json(
      { error: "League navigation is temporarily unavailable." },
      { status: 502 },
    );
  }
}
