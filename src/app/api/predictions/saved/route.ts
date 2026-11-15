import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, verifySessionCookie } from "@/lib/firebase-admin";
import { generateManualPrediction, MANUAL_MODEL_VERSION } from "@/lib/football/manual-engine";
import { getMatchCentre } from "@/lib/football/service";
import type { ManualPredictionResult, SavedManualPrediction } from "@/lib/manual-predictions";
import { consume, RateLimitError } from "@/lib/football/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXTURE_ID = /^(sportmonks|api-football):[A-Za-z0-9_-]+$/;
const MAX_FIXTURES = 5;

async function authenticatedUid(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) return null;
  try {
    const decoded = await verifySessionCookie(session);
    return decoded?.uid ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const uid = await authenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Sign in to view saved predictions." }, { status: 401 });
  }

  try {
    consume(`saved-predictions:${uid}`, 20);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Saved predictions are not configured on the server." }, { status: 503 });
  }

  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("savedPredictions")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const predictions: SavedManualPrediction[] = snapshot.docs.map((entry) => {
      const data = entry.data();
      const createdAt = data.createdAt?.toDate?.();
      return {
        id: entry.id,
        fixtureIds: Array.isArray(data.fixtureIds) ? data.fixtureIds : [],
        results: Array.isArray(data.results) ? data.results : [],
        modelVersion: typeof data.modelVersion === "string" ? data.modelVersion : MANUAL_MODEL_VERSION,
        generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : "",
        createdAt: createdAt instanceof Date ? createdAt.toISOString() : "",
      };
    });
    return NextResponse.json({ predictions }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Saved predictions could not be loaded." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const uid = await authenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Sign in to manage saved predictions." }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Saved predictions are not configured on the server." }, { status: 503 });
  }

  try {
    const snapshot = await db.collection("users").doc(uid).collection("savedPredictions").get();
    const batch = db.batch();
    snapshot.docs.forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
    return NextResponse.json({ removed: snapshot.size }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Saved predictions could not be cleared." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const uid = await authenticatedUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Sign in to save predictions." }, { status: 401 });
  }

  try {
    consume(`save-predictions:${uid}`, 8);
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
    fixtureIds.length < 1 ||
    fixtureIds.length > MAX_FIXTURES ||
    fixtureIds.some((id) => typeof id !== "string" || !FIXTURE_ID.test(id)) ||
    new Set(fixtureIds).size !== fixtureIds.length
  ) {
    return NextResponse.json({ error: "Select between one and five unique real-provider fixtures." }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Saved predictions are not configured on the server." }, { status: 503 });
  }

  try {
    const results: ManualPredictionResult[] = [];
    for (const fixtureId of fixtureIds as string[]) {
      const match = await getMatchCentre(fixtureId);
      const detail = match.detail;
      if (!detail || (match.source !== "provider" && match.source !== "cache")) {
        return NextResponse.json(
          { error: match.notice ?? "Real match information is unavailable for a selected fixture." },
          { status: 503 },
        );
      }
      if (detail.fixture.status !== "scheduled" || Date.parse(detail.fixture.kickoff) <= Date.now()) {
        return NextResponse.json(
          { error: "A selected fixture is no longer scheduled in the future. Run analysis again." },
          { status: 409 },
        );
      }
      results.push(generateManualPrediction(detail));
    }

    if (!results.some((result) => result.analysisStatus === "recommended")) {
      return NextResponse.json(
        { error: "There are no value-qualified recommendations to save yet." },
        { status: 422 },
      );
    }

    const record = db.collection("users").doc(uid).collection("savedPredictions").doc();
    const generatedAt = new Date().toISOString();
    await record.set({
      fixtureIds,
      results,
      modelVersion: MANUAL_MODEL_VERSION,
      generatedAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    const saved: SavedManualPrediction = {
      id: record.id,
      fixtureIds: fixtureIds as string[],
      results,
      modelVersion: MANUAL_MODEL_VERSION,
      generatedAt,
      createdAt: generatedAt,
    };
    return NextResponse.json({ prediction: saved }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The prediction could not be saved. Please try again." }, { status: 500 });
  }
}
