"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  Check,
  Clock3,
  FileImage,
  Goal,
  Home,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useAuth } from "@/components/auth-provider";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { FloatingSlip } from "@/components/mobile/FloatingSlip";
import { HotPicks } from "@/components/mobile/HotPicks";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { SportLeagueFilters } from "@/components/mobile/SportLeagueFilters";
import { TodaysFixtures } from "@/components/mobile/TodaysFixtures";
import { TopLeagues } from "@/components/mobile/TopLeagues";
import { fetchFixtureFeed, fetchLeagues, fetchMatchCentre } from "@/lib/football-client";
import { marketCategories, marketCategoryOrder } from "@/lib/football/markets";
import type { DataSource, MatchEventType, TeamStatisticField } from "@/lib/football/types";
import type {
  FixtureView,
  LeagueView,
  MatchCentreView,
  MatchDetailView,
} from "@/lib/football/views";
import { submitPredictionRequest } from "@/lib/prediction-service";
import { getSavedFixtureIds, removeSavedFixture, saveFixture } from "@/lib/saved-picks";
import type { MarketKey, PredictionRequest } from "@/lib/types";

type ModalKind = "automatic" | "manual" | "screenshot" | "match" | "auth" | "how" | null;
type PickMode = "target" | "premier" | "straight" | "league" | "custom";
type StatusFilter = "all" | "live" | "upcoming" | "finished";

const PER_PAGE = 60;

const SOURCE_LABEL: Record<DataSource, string> = {
  provider: "Live provider data",
  cache: "Last provider update",
  demo: "Mock data",
  unconfigured: "Provider not connected",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All matches" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Upcoming" },
  { value: "finished", label: "Completed" },
];

const STAT_FIELDS: { key: TeamStatisticField; label: string }[] = [
  { key: "possession", label: "Possession" },
  { key: "shots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on target" },
  { key: "corners", label: "Corners" },
  { key: "fouls", label: "Fouls" },
  { key: "offsides", label: "Offsides" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
];

const AVAILABILITY_LABELS: { key: keyof MatchDetailView["available"]; label: string }[] = [
  { key: "form", label: "Form" },
  { key: "headToHead", label: "Head-to-head" },
  { key: "statistics", label: "Statistics" },
  { key: "expectedGoals", label: "Expected goals" },
  { key: "lineups", label: "Lineups" },
  { key: "events", label: "Events" },
  { key: "sidelined", label: "Injuries" },
  { key: "odds", label: "Odds" },
];

const EVENT_LABELS: Record<MatchEventType, string> = {
  goal: "Goal",
  "own-goal": "Own goal",
  penalty: "Penalty",
  "yellow-card": "Yellow card",
  "red-card": "Red card",
  substitution: "Substitution",
  var: "VAR",
  other: "Event",
};

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const shortDayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const fullKickoffFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "your local time";
  }
}

/** Local (viewer timezone) calendar day of an instant, as YYYY-MM-DD. */
function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function shiftDayKey(key: string, days: number): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function matchesStatus(fixture: FixtureView, filter: StatusFilter): boolean {
  if (filter === "live") return fixture.status === "live" || fixture.status === "halftime";
  if (filter === "finished") return fixture.status === "finished";
  if (filter === "upcoming") {
    return fixture.status === "scheduled" || fixture.status === "postponed" || fixture.status === "unknown";
  }
  return true;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function AppHeader({
  onMenu,
  onSearch,
  onHow,
}: {
  onMenu: () => void;
  onSearch: (value: string) => void;
  onHow: () => void;
}) {
  const { user, logOut } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  const handleLogOut = async () => {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logOut();
      window.location.assign("/login");
    } catch {
      setLogoutError("Could not sign out. Please try again.");
      setLoggingOut(false);
    }
  };

  return (
    <header className="topbar dashboard-topbar">
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
      <label className="global-search">
        <Search size={17} />
        <input
          aria-label="Search teams, leagues or fixtures"
          placeholder="Search teams, leagues or fixtures"
          onChange={(event) => onSearch(event.target.value)}
        />
        <span aria-hidden="true" className="search-shortcut">/</span>
      </label>
      <div className="topbar-right">
        <nav className="header-links" aria-label="Main navigation">
          <a href="#fixtures" className="header-link">Football</a>
          <a href="#features" className="header-link">Predictions</a>
          <button className="header-link" onClick={onHow}>How it works</button>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <button className="icon-button notification-button" aria-label="Notifications">
                <Bell size={16} />
              </button>
              <div className="account-menu-wrap" ref={accountMenuRef}>
                <button
                  className="icon-button account-menu-trigger"
                  type="button"
                  aria-label="Open account settings and sign-out menu"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => { setLogoutError(""); setAccountMenuOpen((open) => !open); }}
                >
                  <Settings size={17} strokeWidth={1.9} />
                </button>
                {accountMenuOpen && (
                  <div className="account-menu" role="menu" aria-label="Account menu">
                    <div className="account-menu-heading">
                      <span className="avatar">{getInitials(user.displayName || user.email)}</span>
                      <span><strong>{user.displayName || "Account"}</strong><small>{user.email}</small></span>
                    </div>
                    <Link className="account-menu-item" href="/settings" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <Settings size={15} /><span>Settings</span><ArrowRight size={13} />
                    </Link>
                    <button className="account-menu-item account-menu-logout" type="button" role="menuitem" onClick={() => void handleLogOut()} disabled={loggingOut}>
                      <LogOut size={15} /><span>{loggingOut ? "Signing out..." : "Log out"}</span>
                      {loggingOut ? <span className="spinner" /> : <ArrowRight size={13} />}
                    </button>
                    {logoutError && <p className="account-menu-error" role="alert">{logoutError}</p>}
                  </div>
                )}
              </div>
              <span className="user-chip">
                <span className="avatar">{getInitials(user.displayName || user.email)}</span>
                <span className="user-name">{user.displayName || "Account"}</span>
              </span>
            </>
          ) : (
            <>
              <Link className="text-button login-link" href="/login">Log in</Link>
              <Link className="primary-button create-account" href="/register">Create account <ArrowRight size={14} /></Link>
              <div className="account-menu-wrap" ref={accountMenuRef}>
                <button
                  className="icon-button account-menu-trigger"
                  type="button"
                  aria-label="Open settings menu"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <Settings size={17} strokeWidth={1.9} />
                </button>
                {accountMenuOpen && (
                  <div className="account-menu" role="menu" aria-label="Settings menu">
                    <Link className="account-menu-item" href="/settings" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <Settings size={15} /><span>Settings</span><ArrowRight size={13} />
                    </Link>
                    <Link className="account-menu-item" href="/login" role="menuitem" onClick={() => setAccountMenuOpen(false)}>
                      <LogOut size={15} /><span>Log in</span><ArrowRight size={13} />
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  active,
  onNavigate,
  open,
  leagues,
}: {
  active: string;
  onNavigate: (item: string) => void;
  open: boolean;
  leagues: LeagueView[];
}) {
  const { user, logOut } = useAuth();
  const handleLogOut = () => void logOut().then(() => { window.location.assign("/login"); });
  const explore = [
    { label: "Home", icon: Home },
    { label: "Fixtures", icon: CalendarDays },
    { label: "Automatic Picks", icon: Zap },
    { label: "Manual Analysis", icon: Target },
    { label: "Screenshot Analysis", icon: Camera },
  ];
  const account = [
    { label: "My Predictions", icon: ListChecks },
    { label: "Saved Picks", icon: ShieldCheck },
    { label: "Prediction History", icon: Clock3 },
    { label: "Performance Statistics", icon: BarChart3 },
    { label: "Settings", icon: UserRound },
  ];

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Sidebar navigation">
      <div className="nav-group">
        <p className="nav-label">EXPLORE</p>
        {explore.map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => onNavigate(label)}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="nav-group">
        <p className="nav-label">MY ACCOUNT</p>
        {account.map(({ label, icon: Icon }) => (
          <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => onNavigate(label)}>
            <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="nav-group">
        <p className="nav-label">LEAGUES</p>
        {leagues.map((league) => (
          <button
            key={league.id}
            className={`nav-item ${active === `league:${league.id}` ? "active" : ""}`}
            disabled={!league.available}
            title={
              league.available
                ? undefined
                : "Not included in the connected data plan, so it has no fixtures to show."
            }
            onClick={() => onNavigate(`league:${league.id}`)}
          >
            <span className="league-flag">{league.flag}</span>
            <span>{league.name}</span>
            {!league.available && <span className="league-lock">Plan</span>}
          </button>
        ))}
        {!leagues.length && <p className="sidebar-disclaimer">Competitions load from the football data provider.</p>}
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

function TeamBadge({ team }: { team: FixtureView["home"] }) {
  if (team.logoUrl) {
    // Provider crests are served from CDNs that change per provider, so a plain <img>
    // keeps a new league working without a next.config allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="team-logo" src={team.logoUrl} alt="" loading="lazy" />;
  }
  return <span className="team-badge" aria-hidden="true">{getInitials(team.name)}</span>;
}

function statusChip(fixture: FixtureView) {
  if (fixture.status === "live" || fixture.status === "halftime") {
    return (
      <span className="live-badge">
        <span className="live-dot" />{fixture.minute ? `${fixture.minute}'` : fixture.statusLabel}
      </span>
    );
  }
  if (fixture.status === "finished" && fixture.score) {
    return <span className="score-chip">{fixture.score.home ?? "-"} - {fixture.score.away ?? "-"}</span>;
  }
  return <span className="status-badge">{fixture.statusLabel}</span>;
}

function FixtureCard({
  fixture,
  onMatchCentre,
  onSave,
  isSaved,
}: {
  fixture: FixtureView;
  onMatchCentre: (fixture: FixtureView) => void;
  onSave: (fixture: FixtureView) => void;
  isSaved: boolean;
}) {
  const form = fixture.sample?.homeForm && fixture.sample?.awayForm
    ? { home: fixture.sample.homeForm, away: fixture.sample.awayForm }
    : null;
  return (
    <article className="fixture-card">
      <div className="fixture-topline">
        <div className="league-name"><span className="league-dot" />{fixture.league.flag} {fixture.league.name}</div>
        <span className="kickoff">
          <Clock3 size={12} />{timeFormatter.format(new Date(fixture.kickoff))}
        </span>
      </div>
      <div className="fixture-body">
        <div className="team-block">
          <TeamBadge team={fixture.home} />
          <span className="team-name">{fixture.home.name}</span>
        </div>
        <span className="versus">{fixture.score && fixture.status === "finished" ? "FT" : "VS"}</span>
        <div className="team-block away">
          <TeamBadge team={fixture.away} />
          <span className="team-name">{fixture.away.name}</span>
        </div>
        <div className="pick-block">
          {fixture.sample ? (
            <>
              <span className="pick-label">Featured market preview</span>
              <span className="pick-value"><span className="market-pill">{fixture.sample.marketLabel}</span><span>{fixture.sample.pick}</span></span>
            </>
          ) : (
            <>
              <span className="pick-label">Kick-off (your time)</span>
              <span className="pick-value"><span className="market-pill">{shortDayFormatter.format(new Date(fixture.kickoff))}</span><span>{timeFormatter.format(new Date(fixture.kickoff))}</span></span>
            </>
          )}
        </div>
      </div>
      {form && (
        <div className="form-line" aria-label={`Recent form: ${fixture.home.name} ${form.home.join(", ")}; ${fixture.away.name} ${form.away.join(", ")}`}>
          <span className="form-caption">FORM</span>
          {form.home.slice(0, 3).map((result, index) => <span key={`home-${index}`} className={`form-dot ${result === "D" ? "draw" : result === "L" ? "loss" : ""}`}>{result}</span>)}
          <span className="form-caption" style={{ margin: "0 5px" }}>·</span>
          {form.away.slice(0, 3).map((result, index) => <span key={`away-${index}`} className={`form-dot ${result === "D" ? "draw" : result === "L" ? "loss" : ""}`}>{result}</span>)}
        </div>
      )}
      <div className="fixture-actions">
        {fixture.source !== "provider" && fixture.source !== "cache" && <span className="demo-label">Mock</span>}
        {statusChip(fixture)}
        <button className="outline-button" onClick={() => onSave(fixture)} aria-label={isSaved ? "Unsave fixture" : "Save fixture"}>
          {isSaved ? <Check size={12} /> : <ShieldCheck size={12} />}{isSaved ? "Saved" : "Save"}
        </button>
        <button className="outline-button" onClick={() => onMatchCentre(fixture)}>Match centre <ArrowRight size={12} /></button>
      </div>
    </article>
  );
}

function FixtureSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="fixture-stack" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton skeleton-card" key={index}>
          <div className="skeleton-row">
            <div className="skeleton-line" style={{ width: "28%" }} />
            <div className="skeleton-line" style={{ width: "72%" }} />
            <div className="skeleton-line" style={{ width: "46%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={16} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AuthPrompt({ onClose }: { onClose: () => void }) {
  const { configured } = useAuth();
  return (
    <div className="form-stack">
      <div className="notice"><LockKeyhole size={14} style={{ verticalAlign: "-3px", marginRight: 5 }} />Sign in to generate analysis, save picks and access your personal history. Public fixtures and match details remain available.</div>
      {!configured && <div className="notice error-notice">Firebase Authentication is not connected yet. Add the Firebase environment values to enable account access.</div>}
      <div className="form-footer">
        <Link className="outline-button" href="/login" onClick={onClose}>Log in</Link>
        <Link className="primary-button" href="/register" onClick={onClose}>Create account <ArrowRight size={13} /></Link>
      </div>
      <p className="auth-footnote">Fixture information is provided as-is. No prediction is guaranteed.</p>
    </div>
  );
}

function MatchCentre({
  fixture,
  onRequest,
}: {
  fixture: FixtureView;
  onRequest: () => void;
}) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: MatchCentreView | null }>({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ loading: true, error: "", data: null });
    void fetchMatchCentre(fixture.id, controller.signal)
      .then((data) => { if (active) setState({ loading: false, error: "", data }); })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setState({ loading: false, error: errorText(error), data: null });
      });
    return () => { active = false; controller.abort(); };
  }, [fixture.id]);

  const detail = state.data?.detail ?? null;
  const notice = state.data?.notice;

  if (state.loading) {
    return (
      <div className="mc-stack" aria-busy="true">
        <div className="skeleton" style={{ height: 138 }} />
        <div className="skeleton" style={{ height: 92 }} />
        <div className="skeleton" style={{ height: 92 }} />
      </div>
    );
  }

  if (state.error) {
    return <div className="notice error-notice">{state.error}</div>;
  }

  if (!detail) {
    return (
      <div className="form-stack">
        {notice && <div className="notice">{notice}</div>}
        <div className="empty-state">
          <strong>No match detail available</strong>
          The provider has not returned overview, form, statistics, lineup, event or odds data for this fixture.
        </div>
      </div>
    );
  }

  const teamName = (teamId?: string): string | undefined => {
    if (!teamId) return undefined;
    if (teamId === detail.fixture.home.id) return detail.fixture.home.name;
    if (teamId === detail.fixture.away.id) return detail.fixture.away.name;
    return undefined;
  };

  const oddsGroups = marketCategoryOrder
    .map((key) => ({ key, markets: detail.odds.filter((market) => market.category === key) }))
    .filter((group) => group.markets.length > 0);

  const fullTime = detail.fixture.status === "finished" && detail.fixture.score;

  return (
    <div className="mc-stack">
      {notice && <div className="notice">{notice}</div>}
      {detail.source !== "provider" && detail.source !== "cache" && <div className="notice"><span className="demo-label">Mock data</span> This match is a demonstration fixture. No statistic, odd or prediction below is real.</div>}

      <div className="mc-overview">
        <div className="mc-teams">
          <div className="mc-team">
            <TeamBadge team={detail.fixture.home} />
            <span className="team-name">{detail.fixture.home.name}</span>
          </div>
          <span className="mc-score">
            {fullTime ? `${detail.fixture.score?.home ?? "-"} - ${detail.fixture.score?.away ?? "-"}` : "VS"}
          </span>
          <div className="mc-team away">
            <TeamBadge team={detail.fixture.away} />
            <span className="team-name">{detail.fixture.away.name}</span>
          </div>
        </div>
        <div className="mc-meta">
          <span>{detail.fixture.league.flag} {detail.fixture.league.name}</span>
          <span>·</span>
          <span>{fullKickoffFormatter.format(new Date(detail.fixture.kickoff))}</span>
          <span>·</span>
          {statusChip(detail.fixture)}
          {detail.fixture.venue && <><span>·</span><span>{detail.fixture.venue}</span></>}
        </div>
      </div>

      <div className="mc-section">
        <h3><Activity size={13} /> Available for this match <span>{SOURCE_LABEL[detail.source]}</span></h3>
        <div className="availability-strip">
          {AVAILABILITY_LABELS.map(({ key, label }) => (
            <span key={key} className={`availability-chip ${detail.available[key] ? "on" : ""}`}>{label}</span>
          ))}
        </div>
      </div>

      {(detail.available.form || detail.available.headToHead) && (
        <div className="mc-section">
          <h3><TrendingUp size={13} /> Recent form and head-to-head</h3>
          <div className="mc-columns">
            {detail.available.form && (
              <div>
                <p className="mc-column-title">Recent form</p>
                <div className="form-line" style={{ margin: 0 }}>
                  {detail.homeForm.slice(0, 5).map((entry, index) => <span key={`hf-${index}`} className={`form-dot ${entry.result === "D" ? "draw" : entry.result === "L" ? "loss" : ""}`}>{entry.result}</span>)}
                </div>
                <div className="form-history">
                  {detail.homeForm.slice(0, 4).map((entry) => (
                    <div className="form-history-row" key={entry.fixtureId}>
                      <span className={`form-dot ${entry.result === "D" ? "draw" : entry.result === "L" ? "loss" : ""}`}>{entry.result}</span>
                      <strong>{entry.opponent}</strong>
                      <span>{entry.score}</span>
                      <span>{shortDayFormatter.format(new Date(entry.kickoff))}</span>
                    </div>
                  ))}
                </div>
                <div className="form-line" style={{ margin: "12px 0 0" }}>
                  {detail.awayForm.slice(0, 5).map((entry, index) => <span key={`af-${index}`} className={`form-dot ${entry.result === "D" ? "draw" : entry.result === "L" ? "loss" : ""}`}>{entry.result}</span>)}
                </div>
              </div>
            )}
            {detail.available.headToHead && detail.headToHead && (
              <div>
                <p className="mc-column-title">Head-to-head</p>
                <div className="h2h-summary">
                  <div className="h2h-cell"><strong>{detail.headToHead.homeWins}</strong><span>{detail.fixture.home.short ?? "Home"} wins</span></div>
                  <div className="h2h-cell"><strong>{detail.headToHead.draws}</strong><span>Draws</span></div>
                  <div className="h2h-cell"><strong>{detail.headToHead.awayWins}</strong><span>{detail.fixture.away.short ?? "Away"} wins</span></div>
                </div>
                <div className="form-history">
                  {detail.headToHead.recent.map((entry) => (
                    <div className="form-history-row" key={entry.fixtureId}>
                      <strong>{entry.homeTeam} {entry.score} {entry.awayTeam}</strong>
                      <span>{shortDayFormatter.format(new Date(entry.kickoff))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {detail.available.statistics && detail.statistics && (
        <div className="mc-section">
          <h3><BarChart3 size={13} /> Team statistics <span>{detail.fixture.home.short ?? detail.fixture.home.name} · {detail.fixture.away.short ?? detail.fixture.away.name}</span></h3>
          {STAT_FIELDS.map(({ key, label }) => {
            const home = detail.statistics?.home[key];
            const away = detail.statistics?.away[key];
            if (home === undefined && away === undefined) return null;
            const homeValue = home ?? 0;
            const awayValue = away ?? 0;
            const total = homeValue + awayValue;
            return (
              <div className="stat-row" key={key}>
                <span className="stat-value">{home ?? "-"}</span>
                <div>
                  <div className="stat-label">{label}</div>
                  <div className="stat-bars">
                    <span className="stat-bar"><span style={{ width: total ? `${(homeValue / total) * 100}%` : "0%" }} /></span>
                    <span className="stat-bar away"><span style={{ width: total ? `${(awayValue / total) * 100}%` : "0%" }} /></span>
                  </div>
                </div>
                <span className="stat-value">{away ?? "-"}</span>
              </div>
            );
          })}
          {detail.available.expectedGoals && (
            <div className="stat-row">
              <span className="stat-value">{detail.statistics.home.expectedGoals ?? "-"}</span>
              <div>
                <div className="stat-label">Expected goals (xG)</div>
              </div>
              <span className="stat-value">{detail.statistics.away.expectedGoals ?? "-"}</span>
            </div>
          )}
        </div>
      )}

      {detail.available.lineups && detail.lineups && (
        <div className="mc-section">
          <h3><Shirt size={13} /> Lineups <span>{detail.lineups.confirmed ? "Confirmed" : "Not confirmed"}</span></h3>
          <div className="mc-columns">
            {([detail.lineups.home, detail.lineups.away] as const).map((lineup, index) => (
              lineup ? (
                <div key={lineup.teamId ?? index}>
                  <p className="mc-column-title">{teamName(lineup.teamId) ?? "Team"}{lineup.formation ? ` · ${lineup.formation}` : ""}</p>
                  {lineup.coach && <p className="mc-section-note">Coach: {lineup.coach}</p>}
                  {lineup.players.map((player) => (
                    <div className="player-row" key={player.playerId}>
                      <span className="player-number">{player.number ?? ""}</span>
                      <span>{player.name}</span>
                      <span className="player-role">{player.starter ? player.position ?? "Starting" : "Substitute"}</span>
                    </div>
                  ))}
                </div>
              ) : null
            ))}
          </div>
        </div>
      )}

      {detail.available.events && detail.events.length > 0 && (
        <div className="mc-section">
          <h3><Clock3 size={13} /> Match events</h3>
          {detail.events.map((event) => (
            <div className="event-row" key={event.id}>
              <span className="event-minute">{event.minute}&apos;</span>
              <div>
                <div className="event-detail">{EVENT_LABELS[event.type]}{event.playerName ? ` · ${event.playerName}` : ""}</div>
                <div className="event-sub">{[teamName(event.teamId), event.detail].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail.available.sidelined && detail.sidelined.length > 0 && (
        <div className="mc-section">
          <h3><AlertTriangle size={13} /> Injuries and suspensions</h3>
          {detail.sidelined.map((player) => (
            <div className="sidelined-row" key={`${player.teamId}-${player.playerName}`}>
              <div>
                <div className="sidelined-name">{player.playerName}</div>
                <div className="sidelined-team">{[teamName(player.teamId), player.reason].filter(Boolean).join(" · ")}</div>
              </div>
              <span className={`kind-chip kind-${player.kind}`}>{player.kind === "injury" ? "Injury" : player.kind === "suspension" ? "Suspended" : "Unavailable"}</span>
            </div>
          ))}
        </div>
      )}

      {oddsGroups.length > 0 && (
        <div className="mc-section">
          <h3><Trophy size={13} /> Bookmaker odds <span>{detail.odds[0]?.bookmaker ?? "Provider"}</span></h3>
          <div className="odds-grid">
            {oddsGroups.map((group) => (
              <div className="odds-market" key={group.key}>
                <div className="odds-market-head">
                  <strong>{marketCategories[group.key].label}</strong>
                  {group.markets[0]?.line && <span>Line {group.markets[0].line}</span>}
                </div>
                <div className="odds-selections">
                  {group.markets.flatMap((market) => market.selections).map((selection, index) => (
                    <span className="odds-selection" key={`${group.key}-${selection.label}-${index}`}>
                      {selection.label} <b>{selection.price.toFixed(2)}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!detail.available.form && !detail.available.statistics && !detail.available.lineups && !detail.events.length && !detail.sidelined.length && !oddsGroups.length && (
        <div className="mc-section">
          <h3><Users size={13} /> Match data</h3>
          <p className="mc-section-note">
            The provider does not return form, head-to-head, statistics, lineup, event, injury or odds data for this
            fixture yet. Nothing is invented to fill the gap.
          </p>
        </div>
      )}

      <div className="form-footer">
        <span className="auth-footnote">Fixture data is shown as the provider supplies it.</span>
        <button className="primary-button" onClick={onRequest}>Request full analysis <ArrowRight size={13} /></button>
      </div>
    </div>
  );
}

function AutoPickForm({
  fixtures,
  leagues,
  onSubmit,
}: {
  fixtures: FixtureView[];
  leagues: LeagueView[];
  onSubmit: (request: PredictionRequest) => Promise<void>;
}) {
  const [mode, setMode] = useState<PickMode>("target");
  const [targetOdds, setTargetOdds] = useState("5");
  const [count, setCount] = useState("5");
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([]);
  const [markets, setMarkets] = useState<MarketKey[]>(["match-winner", "double-chance"]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const toggleValue = <T extends string>(value: T, values: T[], update: (items: T[]) => void) => {
    update(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true); setMessage("");
    try {
      await onSubmit({
        fixtureIds: fixtures.filter((fixture) => {
          if (mode === "premier") return fixture.league.name === "Premier League";
          if (mode === "league") return selectedLeagues.includes(fixture.league.name);
          return true;
        }).slice(0, mode === "premier" ? 10 : Number(count)).map((fixture) => fixture.id),
        markets,
        mode: "automatic",
        options: { pickMode: mode, targetOdds: Number(targetOdds), matchCount: Number(count) },
      });
      setMessage("Request prepared. The prediction engine will connect here when enabled.");
    } catch (error) {
      setMessage(errorText(error));
    } finally { setSubmitting(false); }
  };

  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-field">
        <label>How should we build your shortlist?</label>
        <div className="choice-row">
          {[
            ["target", "Target odds"],
            ["premier", "10 strongest · Premier League"],
            ["straight", "Straight wins"],
            ["league", "One pick per league"],
            ["custom", "Custom match count"],
          ].map(([value, label]) => (
            <label key={value} className={`choice-option ${mode === value ? "selected" : ""}`}>
              <input type="radio" name="pick-mode" checked={mode === value} onChange={() => setMode(value as PickMode)} />{label}
            </label>
          ))}
        </div>
      </div>
      {mode === "target" && <div className="form-field"><label htmlFor="target-odds">Target combined odds</label><select id="target-odds" value={targetOdds} onChange={(event) => setTargetOdds(event.target.value)}>{["5", "10", "20", "100"].map((odds) => <option key={odds} value={odds}>{odds} odds</option>)}</select></div>}
      {mode === "custom" && <div className="form-field"><label htmlFor="match-count">Number of matches</label><select id="match-count" value={count} onChange={(event) => setCount(event.target.value)}>{["2", "3", "5", "8", "10"].map((n) => <option key={n} value={n}>{n} matches</option>)}</select></div>}
      {mode === "league" && <div className="form-field"><label>Select leagues</label><div className="choice-row">{leagues.map((league) => <label key={league.id} className={`choice-option ${selectedLeagues.includes(league.name) ? "selected" : ""}`}><input type="checkbox" checked={selectedLeagues.includes(league.name)} onChange={() => toggleValue(league.name, selectedLeagues, setSelectedLeagues)} />{league.name}</label>)}</div></div>}
      <div className="form-field">
        <label>Preferred markets</label>
        <div className="choice-row">{marketCategoryOrder.map((key) => <label key={key} className={`choice-option ${markets.includes(key) ? "selected" : ""}`}><input type="checkbox" checked={markets.includes(key)} onChange={() => toggleValue(key, markets, setMarkets)} />{marketCategories[key].label}</label>)}</div>
      </div>
      <p className="field-help">Selection preferences shape the request only; outcomes and odds are not guaranteed.</p>
      {message && <div className="notice success-notice">{message}</div>}
      <div className="form-footer"><span className="auth-footnote">Account required to generate picks</span><button className="primary-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" /> Preparing</> : <>Continue <ArrowRight size={13} /></>}</button></div>
    </form>
  );
}

function ManualAnalysisForm({
  fixtures,
  onSubmit,
  onPublicPreview,
}: {
  fixtures: FixtureView[];
  onSubmit: (request: PredictionRequest) => Promise<void>;
  onPublicPreview: (fixture: FixtureView) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [markets, setMarkets] = useState<MarketKey[]>([...marketCategoryOrder]);
  const [requestStrongest, setRequestStrongest] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toggleFixture = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const toggleMarket = (market: MarketKey) => setMarkets((current) => current.includes(market) ? current.filter((item) => item !== market) : [...current, market]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected.length || !markets.length) return;
    setSubmitting(true);
    try {
      await onSubmit({ fixtureIds: selected, markets, mode: "manual", options: { strongestMarket: requestStrongest } });
    } finally { setSubmitting(false); }
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <div className="form-field"><label>Select fixtures to compare</label>
        <div className="selected-fixtures">
          {fixtures.map((fixture) => (
            <label className={`select-fixture ${selected.includes(fixture.id) ? "selected" : ""}`} key={fixture.id}>
              <input type="checkbox" checked={selected.includes(fixture.id)} onChange={() => toggleFixture(fixture.id)} />
              <span>{fixture.home.name} vs {fixture.away.name}</span>
              <span className="selection-detail">{fixture.league.name}</span>
              <button className="text-link" type="button" onClick={(event) => { event.preventDefault(); onPublicPreview(fixture); }}>Details</button>
            </label>
          ))}
          {!fixtures.length && <p className="field-help">Load a date with fixtures to compare them here.</p>}
        </div>
      </div>
      <div className="form-field"><label>Markets to compare</label><div className="choice-row">{marketCategoryOrder.map((key) => <label key={key} className={`choice-option ${markets.includes(key) ? "selected" : ""}`}><input type="checkbox" checked={markets.includes(key)} onChange={() => toggleMarket(key)} />{marketCategories[key].label}</label>)}</div></div>
      <label className="choice-option selected"><input type="checkbox" checked={requestStrongest} onChange={() => setRequestStrongest((value) => !value)} />Highlight the strongest market per match</label>
      {!selected.length && <p className="field-help">Choose one or more fixtures. Match details are available without an account.</p>}
      <div className="form-footer"><span className="auth-footnote">Analysis requests require an account</span><button className="primary-button" type="submit" disabled={!selected.length || !markets.length || submitting}>{submitting ? <><span className="spinner" /> Comparing</> : <>Request analysis <ArrowRight size={13} /></>}</button></div>
    </form>
  );
}

function ScreenshotForm({ onSubmit }: { onSubmit: (request: PredictionRequest) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const assignFile = (candidate?: File) => {
    if (!candidate) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(candidate.type)) {
      setMessage("Please choose a JPG, PNG or WEBP image."); setFile(null); return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      setMessage("This image is larger than 10 MB. Choose a smaller screenshot."); setFile(null); return;
    }
    setMessage(""); setFile(candidate);
  };
  const onChange = (event: ChangeEvent<HTMLInputElement>) => assignFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); setDragging(false); assignFile(event.dataTransfer.files[0]); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setSubmitting(true);
    try { await onSubmit({ fixtureIds: [], markets: [...marketCategoryOrder], mode: "screenshot", options: { fileName: file.name, size: file.size } }); }
    finally { setSubmitting(false); }
  };
  return (
    <form className="form-stack" onSubmit={submit}>
      <label className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
        <input ref={inputRef} className="file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={onChange} />
        {file ? <><FileImage size={27} /><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace</span></> : <><Upload size={26} /><strong>Drop your screenshot here or browse files</strong><span>JPG, PNG or WEBP · Maximum 10 MB</span></>}
      </label>
      <div className="notice">The analysis workflow is designed to identify fixtures and markets, review each selection, flag weaker picks and suggest alternatives. Image processing is not connected yet.</div>
      {message && <div className="notice error-notice">{message}</div>}
      <div className="form-footer"><span className="auth-footnote">Uploads are private to your account</span><button className="primary-button" type="submit" disabled={!file || submitting}>{submitting ? <><span className="spinner" /> Preparing</> : <>Review screenshot <ArrowRight size={13} /></>}</button></div>
    </form>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [active, setActive] = useState("Home");
  const [modal, setModal] = useState<ModalKind>(null);
  const [search] = useState("");
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fixtureSearch, setFixtureSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [requestStatus, setRequestStatus] = useState("");

  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);

  const [leagues, setLeagues] = useState<LeagueView[]>([]);
  const [fixtures, setFixtures] = useState<FixtureView[]>([]);
  const [feedSource, setFeedSource] = useState<DataSource | null>(null);
  const [feedNotice, setFeedNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const [selectedFixture, setSelectedFixture] = useState<FixtureView | null>(null);

  // The date is resolved after mount so the first client render matches the server render.
  useEffect(() => {
    const key = localDateKey(new Date());
    setTodayKey(key);
    setDayKey(key);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchLeagues(controller.signal)
      .then((result) => setLeagues(result.leagues))
      .catch(() => setLeagues([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dayKey) return;
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setFeedError("");
    if (page === 1) setFixtures([]);

    void fetchFixtureFeed({
      // A local calendar day can span two UTC dates, so the window is padded by a day.
      from: shiftDayKey(dayKey, -1),
      to: shiftDayKey(dayKey, 1),
      leagueIds: leagueId ? [leagueId] : undefined,
      page,
      perPage: PER_PAGE,
      signal: controller.signal,
    })
      .then((result) => {
        if (!active) return;
        setFeedSource(result.source);
        setFeedNotice(result.notice ?? "");
        setHasMore(result.hasMore);
        setFixtures((current) => (page === 1 ? result.fixtures : [...current, ...result.fixtures]));
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setFeedError(errorText(error));
        setHasMore(false);
        if (page === 1) setFixtures([]);
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; controller.abort(); };
  }, [dayKey, leagueId, page, reloadToken]);

  // Opening on a day with no fixtures (international breaks, quiet midweeks) would show an
  // empty dashboard. Once, after the first unfiltered load, move the default view forward
  // to the next day that actually has fixtures. An explicit league filter is left alone.
  const advanceAttempted = useRef(false);
  useEffect(() => {
    if (advanceAttempted.current || leagueId) return;
    if (!todayKey || !dayKey || loading || feedSource === null) return;
    advanceAttempted.current = true;
    if (fixtures.length > 0 || dayKey !== todayKey) return;

    const controller = new AbortController();
    void fetchFixtureFeed({
      from: todayKey,
      to: shiftDayKey(todayKey, 7),
      page: 1,
      perPage: 100,
      signal: controller.signal,
    })
      .then((result) => {
        const next = result.fixtures.find(
          (fixture) => localDateKey(new Date(fixture.kickoff)) > todayKey,
        );
        if (!next) return;
        setPage(1);
        setDayKey(localDateKey(new Date(next.kickoff)));
      })
      .catch(() => {});

    return () => controller.abort();
  }, [todayKey, dayKey, leagueId, loading, feedSource, fixtures.length]);

  useEffect(() => {
    if (!user) {
      setSaved([]);
      return;
    }
    let current = true;
    void getSavedFixtureIds(user.uid)
      .then((ids) => { if (current) setSaved(ids); })
      .catch(() => { if (current) setRequestStatus("Saved picks could not be loaded. Check your Firestore configuration and rules."); });
    return () => { current = false; };
  }, [user]);

  const visibleFixtures = useMemo(() => {
    const query = `${search} ${fixtureSearch}`.trim().toLowerCase();
    return fixtures.filter((fixture) => {
      if (dayKey && localDateKey(new Date(fixture.kickoff)) !== dayKey) return false;
      if (!matchesStatus(fixture, statusFilter)) return false;
      if (!query) return true;
      return `${fixture.home.name} ${fixture.away.name} ${fixture.league.name} ${fixture.league.country}`
        .toLowerCase()
        .includes(query);
    });
  }, [fixtures, dayKey, statusFilter, search, fixtureSearch]);

  const selectLeague = (next: string | null) => { setPage(1); setLeagueId(next); };

  const closeModal = useCallback(() => { setModal(null); setRequestStatus(""); }, []);
  const handleNavigation = (item: string) => {
    setMobileNavOpen(false);
    setActive(item);
    if (item.startsWith("league:")) {
      const id = item.slice("league:".length);
      selectLeague(id);
      return;
    }
    if (item === "Home" || item === "Fixtures") {
      selectLeague(null);
      setStatusFilter("all");
      return;
    }
    if (item === "LiveScore") {
      setStatusFilter("live");
      return;
    }
    if (item === "Manual Analysis") {
      window.location.assign("/manual-analysis");
      return;
    }
    if (item === "Settings") {
      window.location.assign(user ? "/settings" : "/login?next=%2Fsettings");
      return;
    }
    const gated: Record<string, ModalKind> = {
      "Automatic Picks": "automatic",
      "Manual Analysis": "manual",
      "Screenshot Analysis": "screenshot",
    };
    if (gated[item]) { setModal(gated[item]); return; }
    if (!user) { setModal("auth"); return; }
    window.location.assign("/account");
  };

  const handleSubmit = async (request: PredictionRequest) => {
    if (!user) { setModal("auth"); return; }
    const receipt = await submitPredictionRequest(request);
    setRequestStatus(`${receipt.message} Reference: ${receipt.requestId}`);
  };

  const openMatchCentre = (fixture: FixtureView) => { setSelectedFixture(fixture); setModal("match"); };

  const title = modal === "automatic" ? "Automatic picks"
    : modal === "manual" ? "Manual match analysis"
      : modal === "screenshot" ? "Screenshot analysis"
        : modal === "match" && selectedFixture ? `${selectedFixture.home.name} vs ${selectedFixture.away.name}`
          : modal === "how" ? "How MatchMetric works"
            : "Sign in to continue";

  const dayChips = todayKey
    ? [
      { key: shiftDayKey(todayKey, -1), label: "Yesterday" },
      { key: todayKey, label: "Today" },
      { key: shiftDayKey(todayKey, 1), label: "Tomorrow" },
    ]
    : [];

  const featuredFixture = visibleFixtures.find((f) => f.status !== "finished") ?? visibleFixtures[0] ?? null;

  const leagueOptions = leagues.map((league) => ({
    id: league.id,
    name: league.name,
    available: league.available,
  }));

  return (
    <>
      <div className="app-layout mm-app-layout">
        <Sidebar active={active} onNavigate={handleNavigation} open={mobileNavOpen} leagues={leagues} />
        <div className="mm-main-wrap">
          <MobileHeader />
          {requestStatus && <div className="notice success-notice mm-notice" role="status">{requestStatus}</div>}
          {feedNotice && <div className="notice mm-notice">{feedNotice}</div>}
          {feedError && (
            <div className="notice error-notice mm-notice">
              {feedError}
              <button className="text-button" onClick={() => { setPage(1); setReloadToken((token) => token + 1); }}>Try again</button>
            </div>
          )}
          <main className="mm-main">
            <SportLeagueFilters
              leagues={leagueOptions}
              selectedLeagueId={leagueId}
              onLeagueChange={selectLeague}
              searchOpen={mobileSearchOpen}
              onToggleSearch={() => setMobileSearchOpen((open) => !open)}
              searchQuery={fixtureSearch}
              onSearchChange={setFixtureSearch}
            />
            <HotPicks featured={featuredFixture} onOpenMatch={openMatchCentre} />
            <TopLeagues leagues={leagues} selectedLeagueId={leagueId} onSelectLeague={selectLeague} />
            <TodaysFixtures fixtures={visibleFixtures} onOpenMatch={openMatchCentre} />
            {hasMore && (
              <button className="outline-button load-more" onClick={() => setPage((current) => current + 1)} disabled={loading}>
                {loading ? <><span className="spinner" /> Loading</> : <>Load more fixtures <ArrowRight size={12} /></>}
              </button>
            )}
          </main>
        </div>
      </div>
      <FloatingSlip />
      <BottomNavigation />

      {modal === "automatic" && <ModalShell title={title} description="Choose how you want a shortlist to be assembled." onClose={closeModal} wide><AutoPickForm fixtures={visibleFixtures} leagues={leagues} onSubmit={handleSubmit} />{requestStatus && <div className="notice success-notice" style={{ marginTop: 12 }}>{requestStatus}</div>}</ModalShell>}
      {modal === "manual" && <ModalShell title={title} description="Compare the fixtures loaded for this date." onClose={closeModal} wide><ManualAnalysisForm fixtures={visibleFixtures} onSubmit={handleSubmit} onPublicPreview={openMatchCentre} />{requestStatus && <div className="notice success-notice" style={{ marginTop: 12 }}>{requestStatus}</div>}</ModalShell>}
      {modal === "screenshot" && <ModalShell title={title} description="Add a slip image for a structured review." onClose={closeModal}><ScreenshotForm onSubmit={handleSubmit} />{requestStatus && <div className="notice success-notice" style={{ marginTop: 12 }}>{requestStatus}</div>}</ModalShell>}
      {modal === "match" && selectedFixture && <ModalShell title={title} description={`${selectedFixture.league.name} · ${fullKickoffFormatter.format(new Date(selectedFixture.kickoff))}`} onClose={closeModal} wide><MatchCentre fixture={selectedFixture} onRequest={() => setModal(user ? "manual" : "auth")} /></ModalShell>}
      {modal === "auth" && <ModalShell title={title} description="Personal tools are reserved for signed-in members." onClose={closeModal}><AuthPrompt onClose={closeModal} />{requestStatus && <div className="notice" style={{ marginTop: 12 }}>{requestStatus}</div>}</ModalShell>}
      {modal === "how" && <ModalShell title={title} description="Clear data, thoughtful analysis and responsible use." onClose={closeModal}><div className="form-stack"><div className="notice">MatchMetric brings real fixture information from the connected football data provider into one workspace. Public visitors can browse fixtures and match details without an account.</div><div className="notice">Every fixture, statistic, lineup, event and odd shown comes from the provider. When no provider is connected the app says so and labels its demonstration fixtures as mock data.</div><div className="notice">Automatic and manual analysis, screenshot review and saved picks require an account. Nothing shown is a guarantee of an outcome.</div></div></ModalShell>}
    </>
  );
}
