import { NextResponse } from "next/server";
import { clientKey, consume, RateLimitError } from "@/lib/football/rate-limit";
import { parseIsoDate } from "@/lib/football/providers/shared";
import { getFixtureFeed } from "@/lib/football/service";
import type { FixtureQuery, MatchStatus } from "@/lib/football/types";

/**
 * Fixture feed. Every external provider call happens behind this route, so the provider
 * credential never reaches the browser.
 *
 * GET /api/football/fixtures?from=YYYY-MM-DD&to=YYYY-MM-DD&leagues=id,id&status=live&page=1
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WINDOW_DAYS = 8;
const MAX_LEAGUES = 12;
const DEFAULT_PER_PAGE = 40;
const MAX_PER_PAGE = 100;
const REQUESTS_PER_MINUTE = 90;

const STATUSES: MatchStatus[] = [
  "scheduled",
  "live",
  "halftime",
  "finished",
  "postponed",
  "cancelled",
  "unknown",
];

/** Provider-scoped league id, e.g. "sportmonks:8" or "demo:premier-league". */
const LEAGUE_ID = /^[a-z][a-z0-9-]*:[A-Za-z0-9_-]+$/;

export async function GET(request: Request) {
  try {
    consume(clientKey(request, "fixtures"), REQUESTS_PER_MINUTE);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const params = new URL(request.url).searchParams;

  const fromValue = params.get("from") ?? "";
  const toValue = params.get("to") ?? "";
  const from = parseIsoDate(fromValue);
  const to = parseIsoDate(toValue);
  if (!from || !to) {
    return NextResponse.json({ error: "A valid from and to date (YYYY-MM-DD) are required." }, { status: 400 });
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json({ error: "The to date must not be before the from date." }, { status: 400 });
  }
  if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_WINDOW_DAYS) {
    return NextResponse.json({ error: `Request a window of ${MAX_WINDOW_DAYS} days or fewer.` }, { status: 400 });
  }

  const leagueIds = (params.get("leagues") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (leagueIds.length > MAX_LEAGUES || leagueIds.some((id) => !LEAGUE_ID.test(id))) {
    return NextResponse.json({ error: "One or more league filters are not valid." }, { status: 400 });
  }

  const requestedStatuses = (params.get("status") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (requestedStatuses.some((status) => !STATUSES.includes(status as MatchStatus))) {
    return NextResponse.json({ error: "One or more status filters are not recognised." }, { status: 400 });
  }

  const query: FixtureQuery = {
    from: fromValue,
    to: toValue,
    page: positiveInt(params.get("page"), 1, 50),
    perPage: positiveInt(params.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE),
  };
  if (leagueIds.length) query.leagueIds = leagueIds;
  if (requestedStatuses.length) query.statuses = requestedStatuses as MatchStatus[];

  try {
    const feed = await getFixtureFeed(query);
    return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Football fixtures are temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}

function positiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
}
