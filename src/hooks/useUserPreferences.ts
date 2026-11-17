"use client";

import { useCallback, useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import type {
  AppearancePreferences,
  DashboardPreferences,
  NotificationPreferences,
  PredictionPreferences,
} from "@/types/userProfile";

/**
 * Convenience view over the profile's preference groups.
 *
 * Every setter merges the patch into the current group and persists it, so a component
 * only has to describe what changed. No setter ever touches the prediction engine.
 */
export function useUserPreferences() {
  const { profile, save, saving } = useUserProfile();

  const setDashboard = useCallback(
    (patch: Partial<DashboardPreferences>) => {
      if (!profile) return;
      void save({ dashboard: { ...profile.dashboard, ...patch } });
    },
    [profile, save],
  );

  const setPrediction = useCallback(
    (patch: Partial<PredictionPreferences>) => {
      if (!profile) return;
      void save({ predictionPreferences: { ...profile.predictionPreferences, ...patch } });
    },
    [profile, save],
  );

  const setNotifications = useCallback(
    (patch: Partial<NotificationPreferences>) => {
      if (!profile) return;
      void save({ notificationPreferences: { ...profile.notificationPreferences, ...patch } });
    },
    [profile, save],
  );

  const setAppearance = useCallback(
    (patch: Partial<AppearancePreferences>) => {
      if (!profile) return;
      void save({ appearancePreferences: { ...profile.appearancePreferences, ...patch } });
    },
    [profile, save],
  );

  const setFavouriteTeams = useCallback(
    (favouriteTeams: string[]) => {
      void save({ favouriteTeams });
    },
    [save],
  );

  const setFavouriteCompetitions = useCallback(
    (favouriteCompetitions: string[]) => {
      void save({ favouriteCompetitions });
    },
    [save],
  );

  return useMemo(
    () => ({
      saving,
      dashboard: profile?.dashboard,
      prediction: profile?.predictionPreferences,
      notifications: profile?.notificationPreferences,
      appearance: profile?.appearancePreferences,
      favouriteTeams: profile?.favouriteTeams ?? [],
      favouriteCompetitions: profile?.favouriteCompetitions ?? [],
      setDashboard,
      setPrediction,
      setNotifications,
      setAppearance,
      setFavouriteTeams,
      setFavouriteCompetitions,
    }),
    [
      saving,
      profile,
      setDashboard,
      setPrediction,
      setNotifications,
      setAppearance,
      setFavouriteTeams,
      setFavouriteCompetitions,
    ],
  );
}
