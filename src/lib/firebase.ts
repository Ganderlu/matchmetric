"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

export const firebaseApp = firebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(config)
  : null;

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firebaseFirestore = firebaseApp ? getFirestore(firebaseApp) : null;

/**
 * Cloud Storage is only created when a bucket is configured, so profile-picture uploads
 * stay switched off (and the UI says so) rather than silently failing on a default bucket.
 */
export const firebaseStorage = firebaseApp && storageBucket ? getStorage(firebaseApp, storageBucket) : null;
export const firebaseStorageConfigured = Boolean(firebaseStorage);
