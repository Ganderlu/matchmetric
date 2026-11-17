import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { consume, RateLimitError } from "@/lib/football/rate-limit";
import { buildInsights } from "@/lib/insights/analytics";
import type { InsightsGrain, InsightsPayload, InsightsRangeKey } from "@/lib/insights/types";
import type { SelectionSource } from "@/types/slip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Insights dashboard.
 *
 * All aggregation happens here rather than in the UI. The window boundaries arrive as absolute
 * instants computed in the member's own timezone, so "Today" means their today, while the
 * bucketing below is told their UTC offset to label the trend in local time.
 */

const RANGES: InsightsRangeKey[] = ["today", "7d", "30d", "3m", "6m", "all", "custom"];
const SOURCES: SelectionSource[] = ["manual", "automatic", "screenshot"];

const RANGE_LABEL: Record<InsightsRangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  all: "All time",
  custom: "Custom range",
};

const GRAIN_BY_RANGE: Record<InsightsRangeKey, InsightsGrain> = {
  today: "hour",
  "7d": "day",
  "30d": "day",
  "3m": "week",
  "6m": "month",
  all: "month",
  custom: "day",
};

function parseInstant(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to view your insights." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await verifySessionCookie(session);
    if (!decoded) {
      return NextResponse.json({ error: "Sign in to view your insights." }, { status: 401 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  try {
    consume(`insights:${uid}`, 60);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const params = request.nextUrl.searchParams;
  const rangeParam = params.get("range");
  const key: InsightsRangeKey = RANGES.includes(rangeParam as InsightsRangeKey)
    ? (rangeParam as InsightsRangeKey)
    : "all";

  const fromMs = key === "all" ? null : parseInstant(params.get("from"));
  const toMs = key === "all" ? null : parseInstant(params.get("to"));

  const tzParam = Number(params.get("tz"));
  const tzOffsetMinutes = Number.isFinite(tzParam) ? Math.max(-840, Math.min(840, tzParam)) : 0;

  const sourceParam = params.get("source");

  const payload: InsightsPayload = {
    ...(await buildInsights({
      uid,
      range: key,
      grain: GRAIN_BY_RANGE[key],
      fromMs,
      toMs,
      tzOffsetMinutes,
      competition: params.get("competition") || null,
      market: params.get("market") || null,
      source: SOURCES.includes(sourceParam as SelectionSource) ? (sourceParam as SelectionSource) : null,
    })),
    range: { key, label: RANGE_LABEL[key], grain: GRAIN_BY_RANGE[key] },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
