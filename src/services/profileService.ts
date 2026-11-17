"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseFirestore } from "@/lib/firebase";
import { normaliseUserProfile, type UserProfile } from "@/types/userProfile";

/**
 * Reads and writes the member's profile document at `users/{uid}`.
 *
 * The Firestore rules keep that document owner-only, so the browser talks to it
 * directly. A per-member local cache mirrors the last known good profile so the page
 * still renders while offline or before Firestore answers, and is cleared on sign-out.
 */

const LOCAL_PREFIX = "matchmetric:profile:";

function cacheKey(uid: string) {
  return `${LOCAL_PREFIX}${uid}`;
}

function readCached(uid: string): unknown | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeCached(uid: string, profile: UserProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey(uid), JSON.stringify(profile));
  } catch {
    // A blocked or full storage quota must never break the profile page.
  }
}

export function clearCachedProfile(uid?: string) {
  if (typeof window === "undefined") return;
  try {
    if (uid) {
      window.localStorage.removeItem(cacheKey(uid));
      return;
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(LOCAL_PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures while clearing.
  }
}

/**
 * Load the member's profile. `base` holds the values only Firebase Authentication can be
 * trusted for (uid, email, the Auth display name and photo). Anything the stored document
 * is missing or has corrupted falls back to `base`, never to invented data.
 */
export async function loadUserProfile(base: UserProfile): Promise<UserProfile> {
  if (!firebaseFirestore) {
    return normaliseUserProfile(readCached(base.uid), base);
  }

  try {
    const snapshot = await getDoc(doc(firebaseFirestore, "users", base.uid));
    const profile = normaliseUserProfile(snapshot.exists() ? snapshot.data() : readCached(base.uid), base);
    writeCached(base.uid, profile);
    return profile;
  } catch {
    return normaliseUserProfile(readCached(base.uid), base);
  }
}

/** Persist the whole profile, returning the normalised copy that was stored. */
export async function saveUserProfile(profile: UserProfile): Promise<UserProfile> {
  const next = normaliseUserProfile(profile, profile);
  writeCached(profile.uid, next);

  if (!firebaseFirestore) {
    throw new Error("Cloud Firestore is not configured, so your profile was kept on this device only.");
  }

  await setDoc(
    doc(firebaseFirestore, "users", profile.uid),
    { ...next, updatedAt: serverTimestamp() },
    { merge: true },
  );

  return next;
}
