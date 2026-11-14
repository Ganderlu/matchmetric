import { NextRequest, NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "An ID token is required." }, { status: 400 });
    }

    const { cookie } = await createSessionCookie(idToken);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("__session", cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 24 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to establish a session. Check Firebase Admin configuration." },
      { status: 401 },
    );
  }
}

export async function DELETE() {
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
