"use client";

import {
  Bell,
  Heart,
  Info,
  LifeBuoy,
  LogOut,
  Palette,
  SlidersHorizontal,
  Trash2,
  Trophy,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { AboutMatchMetric } from "@/components/profile/AboutMatchMetric";
import { AccountSecurity } from "@/components/profile/AccountSecurity";
import { AppearanceSettings } from "@/components/profile/AppearanceSettings";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { FootballPreferences } from "@/components/profile/FootballPreferences";
import { HelpAndSupport } from "@/components/profile/HelpAndSupport";
import { LogoutDialog } from "@/components/profile/LogoutDialog";
import { MembershipCard } from "@/components/profile/MembershipCard";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { PersonalInformation } from "@/components/profile/PersonalInformation";
import { PredictionPreferences } from "@/components/profile/PredictionPreferences";
import { PrivacySettings } from "@/components/profile/PrivacySettings";
import { Notice } from "@/components/profile/controls";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileIdentityCard } from "@/components/profile/ProfileIdentityCard";
import { ProfileSection } from "@/components/profile/ProfileSection";
import { ExpandedSlip } from "@/components/slip/ExpandedSlip";
import { FloatingSlipButton } from "@/components/slip/FloatingSlipButton";
import { UserProfileProvider } from "@/context/UserProfileContext";
import { useUserProfile } from "@/hooks/useUserProfile";

type SectionKey =
  | "account"
  | "football"
  | "prediction"
  | "notifications"
  | "membership"
  | "appearance"
  | "help"
  | "about";

function ProfileScreen() {
  const { profile, loading, error } = useUserProfile();
  const [openSection, setOpenSection] = useState<SectionKey | null>("account");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const revealSection = (key: SectionKey) => {
    setOpenSection(key);
    window.setTimeout(() => {
      document
        .getElementById(`profile-section-${key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const sectionProps = (key: SectionKey) => ({
    open: openSection === key,
    onOpenChange: (open: boolean) => setOpenSection(open ? key : null),
  });

  return (
    <div className="mm-app-layout">
      <div className="mm-main-wrap">
        <MobileHeader />

        <main className="mm-main">
          <div className="profile-page">
            <ProfileHeader onNotifications={() => revealSection("notifications")} />

            {loading ? (
              <div className="profile-section">
                <div className="skeleton" style={{ height: 104, borderRadius: 18 }} />
              </div>
            ) : profile ? (
              <>
                <ProfileIdentityCard profile={profile} onEdit={() => revealSection("account")} />
                <Notice message={error ? { tone: "error", text: error } : null} />

                <div className="profile-section-anchor" id="profile-section-account">
                  <ProfileSection
                    icon={UserRound}
                    title="My account"
                    description="Your details, account security and privacy."
                    {...sectionProps("account")}
                  >
                    <PersonalInformation />
                    <AccountSecurity onRequestDelete={() => setDeleteOpen(true)} />
                    <PrivacySettings onRequestDelete={() => setDeleteOpen(true)} />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-football">
                  <ProfileSection
                    icon={Heart}
                    title="My football preferences"
                    description="Favourite teams and leagues, plus your home dashboard defaults."
                    {...sectionProps("football")}
                  >
                    <FootballPreferences />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-prediction">
                  <ProfileSection
                    icon={SlidersHorizontal}
                    title="Prediction preferences"
                    description="Default view, markets and Auto Picks defaults. Saved to your account."
                    {...sectionProps("prediction")}
                  >
                    <PredictionPreferences />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-notifications">
                  <ProfileSection
                    icon={Bell}
                    title="Notifications"
                    description="Choose which match, prediction and account updates you want."
                    {...sectionProps("notifications")}
                  >
                    <NotificationSettings />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-membership">
                  <ProfileSection
                    icon={Trophy}
                    title="Membership"
                    description="Your current plan and what it includes."
                    {...sectionProps("membership")}
                  >
                    <MembershipCard />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-appearance">
                  <ProfileSection
                    icon={Palette}
                    title="Appearance"
                    description="Theme and how bookmaker odds are written."
                    {...sectionProps("appearance")}
                  >
                    <AppearanceSettings />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-help">
                  <ProfileSection
                    icon={LifeBuoy}
                    title="Help & support"
                    description="How to reach us and answers to common questions."
                    {...sectionProps("help")}
                  >
                    <HelpAndSupport />
                  </ProfileSection>
                </div>

                <div className="profile-section-anchor" id="profile-section-about">
                  <ProfileSection
                    icon={Info}
                    title="About MatchMetric"
                    description="What the product does, its version and its policies."
                    {...sectionProps("about")}
                  >
                    <AboutMatchMetric />
                  </ProfileSection>
                </div>

                <div className="profile-grid-2">
                  <button type="button" className="outline-button" onClick={() => setLogoutOpen(true)}>
                    <LogOut size={13} /> Log out
                  </button>
                  <button
                    type="button"
                    className="primary-button danger-button"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={13} /> Delete account
                  </button>
                </div>

                <p className="profile-footnote">
                  Preferences are stored privately on your account. Where a setting controls
                  something that is still being rolled out, the section says so rather than
                  pretending otherwise.
                </p>
              </>
            ) : (
              <p className="profile-empty">Sign in to manage your profile.</p>
            )}
          </div>
        </main>
      </div>

      <FloatingSlipButton />
      <ExpandedSlip />
      <BottomNavigation />

      {logoutOpen ? <LogoutDialog onClose={() => setLogoutOpen(false)} /> : null}
      {deleteOpen ? <DeleteAccountDialog onClose={() => setDeleteOpen(false)} /> : null}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <UserProfileProvider>
      <ProfileScreen />
    </UserProfileProvider>
  );
}
