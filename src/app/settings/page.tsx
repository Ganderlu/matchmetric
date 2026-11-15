"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookMarked,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  Copy,
  Database,
  Goal,
  Home,
  KeyRound,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  UserRound,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { useAuth } from "@/components/auth-provider";
import { firebaseAuth } from "@/lib/firebase";
import { marketCategories, marketCategoryOrder } from "@/lib/football/markets";
import { clearSavedFixtures, getSavedFixtureIds } from "@/lib/saved-picks";
import {
  clearCachedSettings,
  defaultUserSettings,
  loadUserSettings,
  saveUserSettings,
  type DensityPreference,
  type OddsFormat,
  type TimeFormat,
  type UserSettings,
} from "@/lib/user-settings";

type SectionKey = "profile" | "preferences" | "notifications" | "security" | "data";
type Message = { tone: "success" | "error"; text: string } | null;
type DataAction = "fixtures" | "analyses" | "preferences" | null;

const SECTIONS: { key: SectionKey; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "profile", label: "Profile", hint: "Name and identity", icon: UserRound },
  { key: "preferences", label: "Preferences", hint: "Display, odds and markets", icon: SlidersHorizontal },
  { key: "notifications", label: "Notifications", hint: "Alerts and reminders", icon: Bell },
  { key: "security", label: "Security", hint: "Password and session", icon: ShieldCheck },
  { key: "data", label: "Data & privacy", hint: "Your stored data", icon: Database },
];

const ODDS_OPTIONS: { value: OddsFormat; label: string; hint: string }[] = [
  { value: "decimal", label: "Decimal", hint: "1.75" },
  { value: "american", label: "American", hint: "-134 / +250" },
  { value: "fractional", label: "Fractional", hint: "3/4" },
];

const TIME_OPTIONS: { value: TimeFormat; label: string; hint: string }[] = [
  { value: "24h", label: "24-hour", hint: "20:45" },
  { value: "12h", label: "12-hour", hint: "8:45 PM" },
];

const DENSITY_OPTIONS: { value: DensityPreference; label: string; hint: string }[] = [
  { value: "comfortable", label: "Comfortable", hint: "More spacing" },
  { value: "compact", label: "Compact", hint: "More per screen" },
];

const NOTIFICATION_ROWS: { key: keyof Pick<UserSettings, "notifySavedPicks" | "notifyMatchReminders" | "notifyWeeklyDigest" | "notifyProductUpdates">; label: string; description: string }[] = [
  { key: "notifyMatchReminders", label: "Kick-off reminders", description: "An alert before fixtures you have saved get underway." },
  { key: "notifySavedPicks", label: "Saved pick summaries", description: "A recap when an analysis you saved reaches full time." },
  { key: "notifyWeeklyDigest", label: "Weekly performance digest", description: "A weekly summary of your analysis activity and outcomes." },
  { key: "notifyProductUpdates", label: "Product and analysis updates", description: "Occasional notes about new markets and platform changes." },
];

const DATA_ACTIONS: Record<Exclude<DataAction, null>, { title: string; body: string; warning: string; confirm: string }> = {
  fixtures: {
    title: "Clear saved fixtures?",
    body: "Every fixture you have saved from the dashboard will be removed from your account.",
    warning: "This cannot be undone.",
    confirm: "Clear fixtures",
  },
  analyses: {
    title: "Clear saved analyses?",
    body: "Every manual analysis stored in your account will be permanently deleted.",
    warning: "This cannot be undone.",
    confirm: "Clear analyses",
  },
  preferences: {
    title: "Reset preferences?",
    body: "Odds format, time format, density, default markets and notification choices return to their defaults.",
    warning: "Your saved fixtures and analyses are not affected.",
    confirm: "Reset preferences",
  },
};

function initials(name: string) {
  const value = name.trim();
  if (!value) return "MM";
  return value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function Notice({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div className={`notice ${message.tone === "error" ? "error-notice" : "success-notice"}`} role="status">
      {message.tone === "success" ? <Check size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> : null}
      {message.text}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? "on" : ""}`}
      onClick={onChange}
    >
      <span className="switch-knob" />
    </button>
  );
}

function SettingsHeader({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { user, logOut } = useAuth();
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu-button" onClick={onMenu} aria-label="Open navigation">
        <Menu size={19} />
      </button>
      <Link href="/" className="brand" aria-label="MatchMetric home">
        <span className="brand-mark"><Goal /></span>
        <span>
          <span className="brand-name">MatchMetric</span>
          <span className="brand-caption">Football intelligence, made clear</span>
        </span>
      </Link>
      <div className="topbar-right">
        <nav className="header-links" aria-label="Main navigation">
          <Link className="header-link" href="/#fixtures">Football</Link>
          <Link className="header-link" href="/#features">Predictions</Link>
          <Link className="header-link" href="/manual-analysis">Manual analysis</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link className="user-chip" href="/account" aria-label="Open your account">
                <span className="avatar">{initials(user.displayName || user.email)}</span>
                <span className="user-name">{user.displayName || "Account"}</span>
              </Link>
              <button className="text-button" onClick={() => void logOut().then(() => router.push("/"))}>Log out</button>
            </>
          ) : (
            <Link className="primary-button" href="/login">Log in <ArrowRight size={13} /></Link>
          )}
        </div>
      </div>
    </header>
  );
}

function SettingsSidebar({ active, onSection, open }: { active: SectionKey; onSection: (key: SectionKey) => void; open: boolean }) {
  const { user, logOut } = useAuth();
  const handleLogOut = () => void logOut().then(() => { window.location.assign("/login"); });
  const explore = [
    { label: "Home", href: "/", icon: Home },
    { label: "Fixtures", href: "/#fixtures", icon: CalendarDays },
    { label: "Automatic Picks", href: "/#features", icon: Zap },
    { label: "Manual Analysis", href: "/manual-analysis", icon: Target },
    { label: "Screenshot Analysis", href: "/#features", icon: Camera },
  ];
  const account = [
    { label: "My Predictions", href: "/account", icon: ListChecks },
    { label: "Saved Picks", href: "/account", icon: BookMarked },
    { label: "Prediction History", href: "/account", icon: Clock3 },
    { label: "Performance Statistics", href: "/account", icon: BarChart3 },
  ];
  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Sidebar navigation">
      <div className="nav-group">
        <p className="nav-label">EXPLORE</p>
        {explore.map(({ label, href, icon: Icon }) => (
          <Link key={label} className="nav-item" href={href}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>
        ))}
      </div>
      <div className="nav-group">
        <p className="nav-label">MY ACCOUNT</p>
        {account.map(({ label, href, icon: Icon }) => (
          <Link key={label} className="nav-item" href={href}><Icon size={16} strokeWidth={1.8} /><span>{label}</span></Link>
        ))}
        <Link className="nav-item active" href="/settings" aria-current="page"><SettingsIcon size={16} strokeWidth={1.8} /><span>Settings</span></Link>
      </div>
      <div className="nav-group">
        <p className="nav-label">SETTINGS</p>
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`nav-item ${active === key ? "active" : ""}`} onClick={() => onSection(key)}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        {user ? (
          <button className="nav-item logout-item" onClick={handleLogOut}>
            <LogOut size={16} strokeWidth={1.8} /><span>Log out</span>
          </button>
        ) : (
          <Link className="nav-item" href="/login">
            <LogOut size={16} strokeWidth={1.8} /><span>Log in</span>
          </Link>
        )}
        <p className="sidebar-disclaimer">Analysis is informational, not a guarantee of match outcomes. Please use responsibly.</p>
      </div>
    </aside>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading, logOut } = useAuth();

  const [section, setSection] = useState<SectionKey>("profile");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [settings, setSettings] = useState<UserSettings>(() => defaultUserSettings);
  const [saved, setSaved] = useState<UserSettings>(() => defaultUserSettings);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<Message>(null);

  const [displayName, setDisplayName] = useState("");
  const [savedDisplayName, setSavedDisplayName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const [copied, setCopied] = useState(false);

  const [sendingReset, setSendingReset] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  const [fixtureCount, setFixtureCount] = useState<number | null>(null);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<DataAction>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState<Message>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setDisplayName(user.displayName ?? "");
    setSavedDisplayName(user.displayName ?? "");
    setLoadingSettings(true);
    void loadUserSettings(user.uid)
      .then((loaded) => { if (active) { setSettings(loaded); setSaved(loaded); } })
      .finally(() => { if (active) setLoadingSettings(false); });
    void getSavedFixtureIds(user.uid)
      .then((ids) => { if (active) setFixtureCount(ids.length); })
      .catch(() => { if (active) setFixtureCount(null); });
    void fetch("/api/predictions/saved", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { predictions?: unknown[] };
        if (active && response.ok) setAnalysisCount(Array.isArray(payload.predictions) ? payload.predictions.length : null);
      })
      .catch(() => { if (active) setAnalysisCount(null); });
    return () => { active = false; };
  }, [user]);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(saved), [settings, saved]);

  const persistSettings = async (next: UserSettings, successText: string) => {
    if (!user) return;
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      await saveUserSettings(user.uid, next);
      setSettings(next);
      setSaved(next);
      setSettingsMessage({ tone: "success", text: successText });
    } catch (error) {
      setSettingsMessage({ tone: "error", text: error instanceof Error ? error.message : "Preferences could not be saved." });
    } finally {
      setSavingSettings(false);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleMarket = (key: UserSettings["defaultMarkets"][number]) => {
    setSettings((current) => ({
      ...current,
      defaultMarkets: current.defaultMarkets.includes(key)
        ? current.defaultMarkets.filter((item) => item !== key)
        : [...current.defaultMarkets, key],
    }));
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!firebaseAuth?.currentUser) {
      setProfileMessage({ tone: "error", text: "Your session is no longer active. Please sign in again." });
      return;
    }
    if (name.length < 2) {
      setProfileMessage({ tone: "error", text: "Enter a display name of at least two characters." });
      return;
    }
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      await updateProfile(firebaseAuth.currentUser, { displayName: name });
      setDisplayName(name);
      setSavedDisplayName(name);
      setProfileMessage({ tone: "success", text: "Your display name was updated." });
    } catch {
      setProfileMessage({ tone: "error", text: "Your display name could not be updated. Please try again." });
    } finally {
      setSavingProfile(false);
    }
  };

  const copyReference = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const sendResetLink = async () => {
    if (!firebaseAuth || !user?.email) {
      setPasswordMessage({ tone: "error", text: "No email address is available for this account." });
      return;
    }
    setSendingReset(true);
    setPasswordMessage(null);
    try {
      await sendPasswordResetEmail(firebaseAuth, user.email);
      setPasswordMessage({ tone: "success", text: `A password reset link was sent to ${user.email}.` });
    } catch {
      setPasswordMessage({ tone: "error", text: "The reset email could not be sent. Please try again shortly." });
    } finally {
      setSendingReset(false);
    }
  };

  const confirmDataAction = async () => {
    if (!user || !pendingAction) return;
    setActionBusy(true);
    setDataMessage(null);
    try {
      if (pendingAction === "fixtures") {
        const removed = await clearSavedFixtures(user.uid);
        setFixtureCount(0);
        setDataMessage({ tone: "success", text: `${removed} saved fixture${removed === 1 ? "" : "s"} removed from your account.` });
      } else if (pendingAction === "analyses") {
        const response = await fetch("/api/predictions/saved", { method: "DELETE" });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Saved analyses could not be cleared.");
        setAnalysisCount(0);
        setDataMessage({ tone: "success", text: "All saved analyses were removed from your account." });
      } else {
        clearCachedSettings();
        await persistSettings(defaultUserSettings, "Preferences were reset to their defaults.");
        setDataMessage({ tone: "success", text: "Preferences were reset to their defaults." });
      }
      setPendingAction(null);
    } catch (error) {
      setDataMessage({ tone: "error", text: error instanceof Error ? error.message : "The action could not be completed." });
    } finally {
      setActionBusy(false);
    }
  };

  const activeSection = SECTIONS.find((entry) => entry.key === section) ?? SECTIONS[0];
  const confirmCopy = pendingAction ? DATA_ACTIONS[pendingAction] : null;

  if (authLoading || !user) {
    return (
      <main className="settings-page settings-page-loading">
        <span className="spinner" /> Loading your settings...
      </main>
    );
  }

  return (
    <>
      <SettingsHeader onMenu={() => setMobileNavOpen((open) => !open)} />
      {mobileNavOpen && <button aria-label="Close navigation" className="mobile-sidebar-overlay" onClick={() => setMobileNavOpen(false)} />}
      <div className="app-layout">
        <SettingsSidebar
          active={section}
          open={mobileNavOpen}
          onSection={(key) => { setSection(key); setMobileNavOpen(false); }}
        />
        <main className="settings-page">
          <div className="settings-heading">
            <div>
              <div className="eyebrow">Account</div>
              <h1>Settings</h1>
              <p className="heading-subtitle">Manage your profile, analysis preferences and stored data.</p>
            </div>
            <Link className="outline-button settings-back" href="/account">
              <ArrowLeft size={13} /> My workspace
            </Link>
          </div>

          <div className="settings-workspace">
            <nav className="settings-nav" aria-label="Settings sections">
              {SECTIONS.map(({ key, label, hint, icon: Icon }) => (
                <button
                  key={key}
                  className={`settings-nav-item ${section === key ? "active" : ""}`}
                  onClick={() => setSection(key)}
                  aria-current={section === key ? "true" : undefined}
                >
                  <span className="settings-nav-icon"><Icon size={16} /></span>
                  <span className="settings-nav-copy"><strong>{label}</strong><small>{hint}</small></span>
                </button>
              ))}
            </nav>

            <div className="settings-content" role="tabpanel" aria-label={activeSection.label}>
              {loadingSettings ? (
                <div className="settings-panel">
                  <div className="skeleton" style={{ height: 22, width: "34%" }} />
                  <div className="skeleton" style={{ height: 60, marginTop: 14 }} />
                  <div className="skeleton" style={{ height: 60, marginTop: 10 }} />
                </div>
              ) : (
                <>
                  {section === "profile" && (
                    <section className="settings-panel">
                      <header className="settings-panel-head">
                        <h2><UserRound size={15} /> Profile</h2>
                        <p>Your identity across MatchMetric and the analyses you save.</p>
                      </header>

                      <div className="profile-banner">
                        <span className="profile-avatar">{initials(displayName || user.email)}</span>
                        <div className="profile-identity">
                          <strong>{displayName || "MatchMetric member"}</strong>
                          <span>{user.email}</span>
                        </div>
                        <span className="verified-chip"><BadgeCheck size={13} /> Verified session</span>
                      </div>

                      <form className="settings-form" onSubmit={saveProfile}>
                        <div className="form-field">
                          <label htmlFor="display-name">Display name</label>
                          <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Add a display name" autoComplete="name" />
                          <span className="field-help">Shown on your saved analyses and in the header.</span>
                        </div>
                        <div className="form-field">
                          <label htmlFor="profile-email">Email address</label>
                          <input id="profile-email" value={user.email} readOnly disabled />
                          <span className="field-help">Your email is used for sign-in and cannot be changed here.</span>
                        </div>
                        <div className="form-field">
                          <label htmlFor="profile-ref">Account reference</label>
                          <div className="settings-copy-field">
                            <input id="profile-ref" value={user.uid} readOnly />
                            <button type="button" className="outline-button" onClick={() => void copyReference()}>
                              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                            </button>
                          </div>
                          <span className="field-help">Share this reference if you contact support about your account.</span>
                        </div>
                        <Notice message={profileMessage} />
                        <div className="settings-actions">
                          <button className="primary-button" type="submit" disabled={savingProfile || displayName.trim() === savedDisplayName || displayName.trim().length < 2}>
                            {savingProfile ? <><span className="spinner" /> Saving</> : <><Save size={13} /> Save changes</>}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}

                  {section === "preferences" && (
                    <section className="settings-panel">
                      <header className="settings-panel-head">
                        <h2><SlidersHorizontal size={15} /> Preferences</h2>
                        <p>How odds, times and your default markets appear in the analysis workspace.</p>
                      </header>

                      <div className="settings-form">
                        <div className="settings-field-group">
                          <div className="settings-field-label"><strong>Odds format</strong><span>How bookmaker prices are displayed.</span></div>
                          <div className="segmented">
                            {ODDS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`segment ${settings.oddsFormat === option.value ? "active" : ""}`}
                                onClick={() => updateSetting("oddsFormat", option.value)}
                              >
                                <strong>{option.label}</strong><small>{option.hint}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="settings-field-group">
                          <div className="settings-field-label"><strong>Time format</strong><span>Applied to kick-off and save timestamps.</span></div>
                          <div className="segmented">
                            {TIME_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`segment ${settings.timeFormat === option.value ? "active" : ""}`}
                                onClick={() => updateSetting("timeFormat", option.value)}
                              >
                                <strong>{option.label}</strong><small>{option.hint}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="settings-field-group">
                          <div className="settings-field-label"><strong>Layout density</strong><span>How much information fits on each screen.</span></div>
                          <div className="segmented">
                            {DENSITY_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={`segment ${settings.density === option.value ? "active" : ""}`}
                                onClick={() => updateSetting("density", option.value)}
                              >
                                <strong>{option.label}</strong><small>{option.hint}</small>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="settings-field-group">
                          <div className="settings-field-label"><strong>Default markets</strong><span>Pre-select the markets you analyze most. Leave empty to compare every market.</span></div>
                          <div className="chip-row">
                            {marketCategoryOrder.map((key) => {
                              const selected = settings.defaultMarkets.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`chip-toggle ${selected ? "selected" : ""}`}
                                  onClick={() => toggleMarket(key)}
                                  aria-pressed={selected}
                                >
                                  {selected ? <Check size={12} /> : null}
                                  {marketCategories[key].label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <Notice message={settingsMessage} />
                      <div className="settings-actions">
                        <button className="outline-button" type="button" disabled={!dirty || savingSettings} onClick={() => setSettings(saved)}>Discard</button>
                        <button className="primary-button" type="button" disabled={!dirty || savingSettings} onClick={() => void persistSettings(settings, "Preferences saved.")}>
                          {savingSettings ? <><span className="spinner" /> Saving</> : <><Save size={13} /> Save preferences</>}
                        </button>
                      </div>
                    </section>
                  )}

                  {section === "notifications" && (
                    <section className="settings-panel">
                      <header className="settings-panel-head">
                        <h2><Bell size={15} /> Notifications</h2>
                        <p>Choose which updates you would like to receive about your activity.</p>
                      </header>

                      <div className="switch-list">
                        {NOTIFICATION_ROWS.map(({ key, label, description }) => (
                          <div className="switch-row" key={key}>
                            <div className="switch-copy"><strong>{label}</strong><span>{description}</span></div>
                            <Toggle checked={Boolean(settings[key])} label={label} onChange={() => updateSetting(key, !settings[key])} />
                          </div>
                        ))}
                      </div>

                      <div className="settings-inline-note">
                        <Mail size={13} /> Alerts are sent to {user.email}. Delivery preferences are saved to your account.
                      </div>

                      <Notice message={settingsMessage} />
                      <div className="settings-actions">
                        <button className="outline-button" type="button" disabled={!dirty || savingSettings} onClick={() => setSettings(saved)}>Discard</button>
                        <button className="primary-button" type="button" disabled={!dirty || savingSettings} onClick={() => void persistSettings(settings, "Notification preferences saved.")}>
                          {savingSettings ? <><span className="spinner" /> Saving</> : <><Save size={13} /> Save preferences</>}
                        </button>
                      </div>
                    </section>
                  )}

                  {section === "security" && (
                    <section className="settings-panel">
                      <header className="settings-panel-head">
                        <h2><ShieldCheck size={15} /> Security</h2>
                        <p>Keep your account secure and manage how you are signed in.</p>
                      </header>

                      <div className="security-card">
                        <span className="security-icon"><KeyRound size={16} /></span>
                        <div className="security-copy">
                          <strong>Password</strong>
                          <span>We will email a secure reset link to {user.email}.</span>
                        </div>
                        <button className="outline-button" type="button" onClick={() => void sendResetLink()} disabled={sendingReset}>
                          {sendingReset ? <><span className="spinner" /> Sending</> : <><Mail size={13} /> Send reset link</>}
                        </button>
                      </div>
                      <Notice message={passwordMessage} />

                      <div className="security-card">
                        <span className="security-icon"><ShieldCheck size={16} /></span>
                        <div className="security-copy">
                          <strong>Active session</strong>
                          <span>You are signed in with a server-verified session cookie that expires automatically.</span>
                        </div>
                        <span className="verified-chip"><BadgeCheck size={13} /> Verified</span>
                      </div>

                      <div className="security-card">
                        <span className="security-icon danger"><LogOut size={16} /></span>
                        <div className="security-copy">
                          <strong>Sign out</strong>
                          <span>End this session on this device. You can sign back in at any time.</span>
                        </div>
                        <button className="outline-button" type="button" onClick={() => void logOut().then(() => { window.location.assign("/"); })}>
                          <LogOut size={13} /> Log out
                        </button>
                      </div>
                    </section>
                  )}

                  {section === "data" && (
                    <section className="settings-panel">
                      <header className="settings-panel-head">
                        <h2><Database size={15} /> Data & privacy</h2>
                        <p>Review and clear the information MatchMetric stores for your account.</p>
                      </header>

                      <Notice message={dataMessage} />

                      <div className="data-list">
                        <div className="data-row">
                          <div className="data-copy">
                            <strong>Saved fixtures</strong>
                            <span>{fixtureCount === null ? "Unavailable" : `${fixtureCount} fixture${fixtureCount === 1 ? "" : "s"} saved from your dashboard.`}</span>
                          </div>
                          <button className="outline-button" type="button" disabled={!fixtureCount} onClick={() => { setDataMessage(null); setPendingAction("fixtures"); }}>
                            <Trash2 size={13} /> Clear
                          </button>
                        </div>
                        <div className="data-row">
                          <div className="data-copy">
                            <strong>Saved analyses</strong>
                            <span>{analysisCount === null ? "Unavailable" : `${analysisCount} manual analys${analysisCount === 1 ? "is" : "es"} stored privately.`}</span>
                          </div>
                          <button className="outline-button" type="button" disabled={!analysisCount} onClick={() => { setDataMessage(null); setPendingAction("analyses"); }}>
                            <Trash2 size={13} /> Clear
                          </button>
                        </div>
                        <div className="data-row">
                          <div className="data-copy">
                            <strong>Preferences</strong>
                            <span>Odds format, time format, density, default markets and notifications.</span>
                          </div>
                          <button className="outline-button" type="button" onClick={() => { setDataMessage(null); setPendingAction("preferences"); }}>
                            <RefreshCw size={13} /> Reset
                          </button>
                        </div>
                      </div>

                      <p className="settings-footnote">
                        Your data is stored under your own account and is never shared. Clearing an item removes it permanently.
                      </p>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        <Link href="/"><Home size={16} />Home</Link>
        <Link href="/#fixtures"><CalendarDays size={16} />Fixtures</Link>
        <Link href="/manual-analysis"><Zap size={16} />Picks</Link>
        <Link className="active" href="/settings"><UserRound size={16} />Settings</Link>
      </nav>

      {confirmCopy && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !actionBusy) setPendingAction(null); }}>
          <section className="modal settings-confirm" role="dialog" aria-modal="true" aria-labelledby="settings-confirm-title">
            <div className="modal-header">
              <div><h2 id="settings-confirm-title">{confirmCopy.title}</h2><p>{confirmCopy.body}</p></div>
              <button className="modal-close" onClick={() => setPendingAction(null)} aria-label="Close dialog"><X size={16} /></button>
            </div>
            <div className="notice error-notice"><AlertTriangle size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{confirmCopy.warning}</div>
            <div className="settings-confirm-actions">
              <button className="outline-button" type="button" onClick={() => setPendingAction(null)} disabled={actionBusy}>Cancel</button>
              <button className="primary-button danger-button" type="button" onClick={() => void confirmDataAction()} disabled={actionBusy}>
                {actionBusy ? <><span className="spinner" /> Working</> : confirmCopy.confirm}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
