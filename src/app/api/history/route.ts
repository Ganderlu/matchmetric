import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { consume, RateLimitError } from "@/lib/football/rate-limit";
import { buildHistory } from "@/lib/history/entries";
import type { HistoryPayload } from "@/lib/history/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The History list.
 *
 * Every record here is assembled and graded on the server: the client sends only the date window
 * and the search text, computed in the member's own timezone, and never derives a result itself.
 */

function parseInstant(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to view your history." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await verifySessionCookie(session);
    if (!decoded) {
      return NextResponse.json({ error: "Sign in to view your history." }, { status: 401 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  try {
    consume(`history:${uid}`, 60);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const params = request.nextUrl.searchParams;
  const payload: HistoryPayload = await buildHistory({
    uid,
    fromMs: parseInstant(params.get("from")),
    toMs: parseInstant(params.get("to")),
    query: params.get("q") ?? "",
  });

  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
