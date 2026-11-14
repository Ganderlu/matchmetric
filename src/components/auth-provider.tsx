"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase";
import type { UserProfile } from "@/lib/types";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncServerSession(user: User | null) {
  if (user) {
    const idToken = await user.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) throw new Error("Could not create a secure server session.");
  } else {
    await fetch("/api/auth/session", { method: "DELETE" });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(firebaseAuth));

  useEffect(() => {
    if (!firebaseAuth) return;
    return onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
      setUser(
        firebaseUser
          ? {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? "",
              displayName: firebaseUser.displayName ?? undefined,
            }
          : null,
      );
      try {
        await syncServerSession(firebaseUser);
      } catch {
        // Client auth stays available; private server pages still require a verified cookie.
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error("Firebase Authentication is not configured yet.");
    const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
    await syncServerSession(result.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!firebaseAuth) throw new Error("Firebase Authentication is not configured yet.");
      const result = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      await updateProfile(result.user, { displayName: name });
      setUser({ uid: result.user.uid, email, displayName: name });
      await syncServerSession(result.user);
    },
    [],
  );

  const logOut = useCallback(async () => {
    if (firebaseAuth) await signOut(firebaseAuth);
    await syncServerSession(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: firebaseConfigured, signIn, register, logOut }),
    [user, loading, signIn, register, logOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
