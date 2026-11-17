import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function getAdminApp(): App | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  );
}

function getAdminAuth() {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}

/**
 * Server-only Firestore handle. The Admin SDK bypasses security rules, which is what lets
 * the football cache stay closed to clients while the API routes keep reading and writing it.
 */
export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export async function createSessionCookie(idToken: string) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Firebase Admin is not configured.");

  const decoded = await auth.verifyIdToken(idToken);
  return auth.createSessionCookie(idToken, {
    expiresIn: 5 * 24 * 60 * 60 * 1000,
  }).then((cookie) => ({ cookie, uid: decoded.uid }));
}

export async function verifySessionCookie(cookie: string) {
  const auth = getAdminAuth();
  if (!auth) return null;
  return auth.verifySessionCookie(cookie, true);
}

export async function verifyIdToken(idToken: string) {
  const auth = getAdminAuth();
  if (!auth) return null;
  return auth.verifyIdToken(idToken);
}

/**
 * Permanently remove a member: their private `users/{uid}` tree in Firestore and their
 * Firebase Authentication record. Storage cleanup is best-effort because a private
 * profile picture is the only object the app ever writes for a member.
 */
export async function deleteAccountData(uid: string): Promise<void> {
  const db = getAdminDb();
  if (db) {
    await db.recursiveDelete(db.doc(`users/${uid}`));
  }

  const auth = getAdminAuth();
  if (!auth) return;
  try {
    await auth.deleteUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
  }
}

