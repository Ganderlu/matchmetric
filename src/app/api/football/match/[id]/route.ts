import { NextResponse } from "next/server";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";
import { getMatchCentre } from "@/lib/football/service";

/**
 * Match centre. The fixture id is the provider-scoped key from the fixture feed, e.g.
 * "sportmonks:19134541".
 *
 * GET /api/football/match/{id}
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXTURE_ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9_-]+$/;
const REQUESTS_PER_MINUTE = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    consume(clientKey(request, "match"), REQUESTS_PER_MINUTE);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const { id } = await params;
  if (!id || !FIXTURE_ID.test(id)) {
    return NextResponse.json({ error: "That fixture identifier is not valid." }, { status: 400 });
  }

  try {
    const result = await getMatchCentre(id);
    if (!result.detail) {
      return NextResponse.json(
        { error: result.notice ?? "No match detail is available for this fixture." },
        { status: result.source === "unconfigured" ? 503 : 404 },
      );
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Match information is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
