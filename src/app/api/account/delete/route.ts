import { NextRequest, NextResponse } from "next/server";
import { deleteAccountData, verifyIdToken, verifySessionCookie } from "@/lib/firebase-admin";

/**
 * Permanently deletes the signed-in member's account.
 *
 * The flow is deliberately guarded: a valid `__session` cookie identifies the account, the
 * body must carry the literal confirmation phrase, and a freshly-issued ID token must prove
 * the member reauthenticated within the last few minutes. Only then is the account removed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRMATION_PHRASE = "DELETE";
const REAUTH_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const session = request.cookies.get("__session")?.value;
  if (!session) {
    return NextResponse.json({ error: "You must be signed in to delete your account." }, { status: 401 });
  }

  let sessionUser;
  try {
    sessionUser = await verifySessionCookie(session);
  } catch {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  if (!sessionUser) {
    return NextResponse.json(
      { error: "Account deletion is unavailable because Firebase Admin is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { confirmation?: string; idToken?: string };

  if (body.confirmation !== CONFIRMATION_PHRASE) {
    return NextResponse.json({ error: `Type ${CONFIRMATION_PHRASE} to confirm deletion.` }, { status: 400 });
  }

  if (!body.idToken) {
    return NextResponse.json({ error: "Please re-enter your password to continue." }, { status: 401 });
  }

  let fresh;
  try {
    fresh = await verifyIdToken(body.idToken);
  } catch {
    return NextResponse.json({ error: "Your reauthentication could not be verified. Try again." }, { status: 401 });
  }

  if (!fresh || fresh.uid !== sessionUser.uid) {
    return NextResponse.json({ error: "That confirmation does not match this account." }, { status: 403 });
  }

  if (Date.now() - (fresh.auth_time ?? 0) * 1000 > REAUTH_WINDOW_MS) {
    return NextResponse.json({ error: "Please confirm your password again before deleting." }, { status: 401 });
  }

  try {
    await deleteAccountData(sessionUser.uid);
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json({ error: "Your account could not be deleted. Please try again." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
