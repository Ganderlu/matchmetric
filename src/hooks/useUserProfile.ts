"use client";

import { useContext } from "react";
import { UserProfileContext, type UserProfileContextValue } from "@/context/UserProfileContext";

/** Access the loaded profile, its loading/saving state and the save action. */
export function useUserProfile(): UserProfileContextValue {
  const context = useContext(UserProfileContext);
  if (!context) throw new Error("useUserProfile must be used inside UserProfileProvider.");
  return context;
}
