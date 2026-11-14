import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseFirestore } from "@/lib/firebase";
import type { FixtureView } from "@/lib/football/views";

/**
 * Saved picks store the presentation view of a fixture. It is the shape the dashboard
 * already holds and it carries the `source`, so a saved mock fixture stays labelled.
 */
export async function saveFixture(uid: string, fixture: FixtureView) {
  if (!firebaseFirestore) throw new Error("Cloud Firestore is not configured.");
  await setDoc(
    doc(firebaseFirestore, "users", uid, "savedPicks", fixture.id),
    {
      fixtureId: fixture.id,
      fixture,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function removeSavedFixture(uid: string, fixtureId: string) {
  if (!firebaseFirestore) throw new Error("Cloud Firestore is not configured.");
  await deleteDoc(doc(firebaseFirestore, "users", uid, "savedPicks", fixtureId));
}

export async function getSavedFixtureIds(uid: string) {
  if (!firebaseFirestore) throw new Error("Cloud Firestore is not configured.");
  const snapshot = await getDocs(collection(firebaseFirestore, "users", uid, "savedPicks"));
  return snapshot.docs.map((savedPick) => savedPick.id);
}
