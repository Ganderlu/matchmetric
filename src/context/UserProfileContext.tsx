"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { firebaseAuth } from "@/lib/firebase";
import {
  clearCachedProfile,
  loadUserProfile,
  saveUserProfile,
} from "@/services/profileService";
import { defaultUserProfile, type UserProfile } from "@/types/userProfile";

export interface UserProfileContextValue {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Merge a patch into the profile and persist it. Resolves to the stored profile. */
  save: (patch: Partial<UserProfile>) => Promise<UserProfile | null>;
  reload: () => Promise<void>;
}

export const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The profile values only Firebase Authentication can be trusted for. */
  const buildBase = useCallback((): UserProfile | null => {
    if (!user) return null;
    const authUser = firebaseAuth?.currentUser;
    return defaultUserProfile(
      user.uid,
      user.email,
      authUser?.displayName ?? user.displayName ?? "",
      authUser?.photoURL ?? undefined,
    );
  }, [user]);

  useEffect(() => {
    const base = buildBase();
    if (!base) {
      clearCachedProfile();
      setProfile(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void loadUserProfile(base)
      .then((loaded) => {
        if (!active) return;
        setProfile(loaded);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setProfile(base);
        setError("Your profile could not be loaded. Showing your account defaults.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [buildBase]);

  const save = useCallback(
    async (patch: Partial<UserProfile>) => {
      const base = buildBase();
      if (!base) return null;
      const current = profile ?? base;
      const next: UserProfile = { ...current, ...patch, uid: base.uid, email: base.email };

      setSaving(true);
      setError(null);
      setProfile(next);
      try {
        const stored = await saveUserProfile(next);
        setProfile(stored);
        return stored;
      } catch (saveError) {
        setProfile(current);
        setError(saveError instanceof Error ? saveError.message : "Your changes could not be saved.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildBase, profile],
  );

  const reload = useCallback(async () => {
    const base = buildBase();
    if (!base) return;
    setLoading(true);
    try {
      setProfile(await loadUserProfile(base));
    } finally {
      setLoading(false);
    }
  }, [buildBase]);

  const value = useMemo(
    () => ({ profile, loading, saving, error, save, reload }),
    [profile, loading, saving, error, save, reload],
  );

  return <UserProfileContext.Provider value={value}>{children}</UserProfileContext.Provider>;
}
