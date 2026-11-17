import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebase-admin";
import { consume, RateLimitError } from "@/lib/football/rate-limit";
import { buildOpenGames } from "@/lib/open-games/entries";
import type { OpenGamesPayload } from "@/lib/open-games/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Open Games list.
 *
 * Every entry is assembled and graded on the server: the client sends only the search text and
 * never derives a result itself. The same route serves the live refresh, so a member's saved
 * prediction and its live score always come from one place.
 */

export async function GET(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "Sign in to view your open games." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await verifySessionCookie(session);
    if (!decoded) {
      return NextResponse.json({ error: "Sign in to view your open games." }, { status: 401 });
    }
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }

  try {
    consume(`open-games:${uid}`, 120);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const payload: OpenGamesPayload = await buildOpenGames({
    uid,
    query: request.nextUrl.searchParams.get("q") ?? "",
  });

  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
