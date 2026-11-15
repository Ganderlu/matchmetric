"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookMarked,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crosshair,
  Home,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  fetchFixtureFeed,
  fetchLeagues,
  fetchMatchCentre,
} from "@/lib/football-client";
import { marketCategories } from "@/lib/football/markets";
import type { FixtureView, LeagueView, MatchDetailView } from "@/lib/football/views";
import type { ManualPredictionResult } from "@/lib/manual-predictions";

const MAX_SELECTED = 5;
const SELECTION_STORAGE_KEY = "matchmetric:manual-selection";
const ANALYSIS_WINDOW_DAYS = 7;

function localDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function TeamCrest({ team, compact = false }: { team: FixtureView["home"]; compact?: boolean }) {
  if (team.logoUrl) {
    // Provider crests are served from per-provider CDNs.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`manual-crest${compact ? " compact" : ""}`} src={team.logoUrl} alt="" loading="lazy" />;
  }
  return <span className={`manual-crest-fallback${compact ? " compact" : ""}`} aria-hidden="true">{initials(team.name)}</span>;
}

function ManualHeader({ search, onSearch }: { search: string; onSearch: (value: string) => void }) {
  const { user } = useAuth();
  return (
    <header className="topbar manual-topbar">
      <Link href="/" className="brand" aria-label="MatchMetric home">
        <span className="brand-mark"><Target /></span>
        <span><span className="brand-name">MatchMetric</span><span className="brand-caption">Football intelligence, made clear</span></span>
      </Link>
      <label className="global-search manual-global-search">
        <Search size={17} />
        <input aria-label="Search fixtures" placeholder="Search teams, leagues or fixtures..." value={search} onChange={(event) => onSearch(event.target.value)} />
      </label>
      <div className="topbar-right">
        <nav className="header-links" aria-label="Main navigation">
          <Link className="header-link" href="/">Football</Link>
          <a className="header-link" href="#analysis-panel">Predictions</a>
          <a className="header-link" href="#manual-help">How it works</a>
        </nav>
        <div className="header-actions">
          {user ? (
            <Link className="user-chip manual-user-chip" href="/account" aria-label="Open your account">
              <span className="avatar">{initials(user.displayName || user.email)}</span>
              <span className="user-name">{user.displayName || "Account"}</span>
            </Link>
          ) : (
            <>
              <Link className="text-button login-link" href="/login?next=%2Fmanual-analysis">Log in</Link>
              <Link className="primary-button create-account" href="/register?next=%2Fmanual-analysis">Create account <ArrowRight size={13} /></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ManualSidebar({
  leagues,
  leagueId,
  onLeague,
}: {
  leagues: LeagueView[];
  leagueId: string;
  onLeague: (id: string) => void;
}) {
  const { user, logOut } = useAuth();
  const handleLogOut = () => void logOut().then(() => { window.location.assign("/login"); });
  return (
    <aside className="sidebar manual-sidebar" aria-label="Sidebar navigation">
      <div className="nav-group">
        <p className="nav-label">EXPLORE</p>
        <Link className="nav-item" href="/"><Home size={16} /><span>Home</span></Link>
        <Link className="nav-item" href="/#fixtures"><CalendarDays size={16} /><span>Fixtures</span></Link>
        <Link className="nav-item" href="/#features"><Zap size={16} /><span>Automatic Picks</span></Link>
        <Link className="nav-item active" href="/manual-analysis" aria-current="page"><Crosshair size={16} /><span>Manual Analysis</span></Link>
        <Link className="nav-item" href="/#features"><Camera size={16} /><span>Screenshot Analysis</span></Link>
      </div>
      <div className="nav-group">
        <p className="nav-label">MY ACCOUNT</p>
        <Link className="nav-item" href="/account"><ListChecks size={16} /><span>My Predictions</span></Link>
        <Link className="nav-item" href="/account"><BookMarked size={16} /><span>Saved Picks</span></Link>
        <Link className="nav-item" href="/account"><Clock3 size={16} /><span>Prediction History</span></Link>
        <Link className="nav-item" href="/account"><BarChart3 size={16} /><span>Performance Statistics</span></Link>
        <Link className="nav-item" href="/settings"><Settings size={16} /><span>Settings</span></Link>
      </div>
      <div className="nav-group">
        <p className="nav-label">LEAGUES</p>
        <button type="button" className={`nav-item ${leagueId === "" ? "active" : ""}`} onClick={() => onLeague("")}>
          <Trophy size={15} /><span>All available</span>
        </button>
        {leagues.filter((league) => league.available).map((league) => (
          <button
            type="button"
            key={league.id}
            className={`nav-item ${leagueId === league.id ? "active" : ""}`}
            onClick={() => onLeague(league.id)}
          >
            <span className="league-flag">{league.flag}</span><span>{league.name}</span>
          </button>
        ))}
        {!leagues.some((league) => league.available) && (
          <p className="sidebar-disclaimer">Available competitions appear when the provider is connected.</p>
        )}
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

export default function ManualAnalysisPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [leagues, setLeagues] = useState<LeagueView[]>([]);
  const [fixtures, setFixtures] = useState<FixtureView[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [leagueId, setLeagueId] = useState("");
  const [search, setSearch] = useState("");
  const [details, setDetails] = useState<Record<string, MatchDetailView | null>>({});
  const [expandedFixtures, setExpandedFixtures] = useState<string[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState<string[]>([]);
  const [feedError, setFeedError] = useState("");
  const [results, setResults] = useState<Record<string, ManualPredictionResult>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const analysisInFlight = useRef(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, fixtureName: "" });
  const [authModal, setAuthModal] = useState<"analysis" | "save" | null>(null);
  const authCloseButton = useRef<HTMLButtonElement>(null);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => setHydrated(true), []);

  useEffect(() => {
    if (authModal) authCloseButton.current?.focus();
  }, [authModal]);

  const loadFixtures = useCallback(async (signal?: AbortSignal) => {
    setLoadingFixtures(true);
    setFeedError("");
    const start = new Date();
    const from = localDayKey(start);
    const to = localDayKey(addDays(start, ANALYSIS_WINDOW_DAYS));
    try {
      const [leagueResponse, feed] = await Promise.all([
        fetchLeagues(signal),
        fetchFixtureFeed({ from, to, page: 1, perPage: 100, signal }),
      ]);
      setLeagues(leagueResponse.leagues.filter((league) => league.available));
      const realFixtures = feed.fixtures.filter(
        (fixture) =>
          (fixture.source === "provider" || fixture.source === "cache") &&
          fixture.status === "scheduled" &&
          Date.parse(fixture.kickoff) > Date.now(),
      );
      setFixtures(realFixtures);
      const savedIds = sessionStorage.getItem(SELECTION_STORAGE_KEY);
      if (savedIds) {
        try {
          const parsed = JSON.parse(savedIds) as unknown;
          if (Array.isArray(parsed)) {
            const allowed = new Set(realFixtures.map((fixture) => fixture.id));
            setSelectedIds(parsed.filter((id): id is string => typeof id === "string" && allowed.has(id)).slice(0, MAX_SELECTED));
          }
        } catch {
          // Ignore stale or malformed session-only selections.
        }
        sessionStorage.removeItem(SELECTION_STORAGE_KEY);
      }
      if (!realFixtures.length) {
        setFeedError(
          feed.source === "demo" || feed.source === "unconfigured"
            ? "The connected football provider is unavailable. Demonstration fixtures are not eligible for real analysis."
            : "No upcoming fixtures are available from the connected provider in the next seven days.",
        );
      }
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Fixtures could not be loaded.");
    } finally {
      setLoadingFixtures(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadFixtures(controller.signal);
    return () => controller.abort();
  }, [loadFixtures]);

  const filteredFixtures = useMemo(() => {
    const query = search.trim().toLowerCase();
    return fixtures.filter((fixture) => {
      if (leagueId && fixture.league.id !== leagueId) return false;
      if (!query) return true;
      return [fixture.home.name, fixture.away.name, fixture.league.name].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [fixtures, leagueId, search]);

  const selectedFixtures = useMemo(
    () => selectedIds.map((id) => fixtures.find((fixture) => fixture.id === id)).filter((fixture): fixture is FixtureView => Boolean(fixture)),
    [fixtures, selectedIds],
  );

  const toggleFixture = (fixture: FixtureView) => {
    setSelectedIds((current) => {
      if (current.includes(fixture.id)) return current.filter((id) => id !== fixture.id);
      if (current.length >= MAX_SELECTED) return current;
      return [...current, fixture.id];
    });
  };

  const toggleFixtureDetails = async (fixtureId: string) => {
    if (expandedFixtures.includes(fixtureId)) {
      setExpandedFixtures((current) => current.filter((id) => id !== fixtureId));
      return;
    }
    setExpandedFixtures((current) => [...current, fixtureId]);
    if (Object.prototype.hasOwnProperty.call(details, fixtureId)) return;
    setLoadingDetails((current) => [...current, fixtureId]);
    try {
      const response = await fetchMatchCentre(fixtureId);
      setDetails((current) => ({ ...current, [fixtureId]: response.detail }));
    } catch {
      setDetails((current) => ({ ...current, [fixtureId]: null }));
    } finally {
      setLoadingDetails((current) => current.filter((id) => id !== fixtureId));
    }
  };

  const runAnalysis = async (ids: string[]) => {
    if (!ids.length || analysisInFlight.current) return;
    if (!user) {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
      setAuthModal("analysis");
      return;
    }

    analysisInFlight.current = true;
    setAnalysisBusy(true);
    setFailed({});
    setProgress({ done: 0, total: ids.length, fixtureName: "" });
    try {
      for (const [index, id] of ids.entries()) {
        const fixture = fixtures.find((item) => item.id === id);
        setProgress({
          done: index,
          total: ids.length,
          fixtureName: fixture ? `${fixture.home.name} vs ${fixture.away.name}` : "Loading match information",
        });
        try {
          const response = await fetch("/api/predictions/manual", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixtureIds: [id] }),
          });
          const payload = (await response.json()) as { result?: ManualPredictionResult; error?: string };
          if (response.status === 401) {
            sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
            setAuthModal("analysis");
            break;
          }
          if (!response.ok || !payload.result) throw new Error(payload.error ?? "Analysis failed for this fixture.");
          setResults((current) => ({ ...current, [id]: payload.result! }));
          setFailed((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        } catch (error) {
          setFailed((current) => ({
            ...current,
            [id]: error instanceof Error ? error.message : "Analysis failed. Please retry.",
          }));
        } finally {
          setProgress((current) => ({ ...current, done: Math.min(current.total, index + 1) }));
        }
      }
      setProgress((current) => ({ ...current, fixtureName: "" }));
    } finally {
      analysisInFlight.current = false;
      setAnalysisBusy(false);
    }
  };

  const savePredictions = async () => {
    if (!user) {
      sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
      setAuthModal("save");
      return;
    }
    const ids = selectedIds.filter((id) => Boolean(results[id]));
    if (!ids.length || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/predictions/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureIds: ids }),
      });
      const payload = (await response.json()) as { prediction?: { id: string }; error?: string };
      if (response.status === 401) {
        sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
        setAuthModal("save");
        return;
      }
      if (!response.ok || !payload.prediction) throw new Error(payload.error ?? "Could not save the analysis.");
      setSaveMessage("Analysis saved to your private Saved Picks.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Could not save the analysis.");
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setResults({});
    setFailed({});
    setSaveMessage("");
  };

  const analyzedResults = selectedIds
    .map((id) => results[id])
    .filter((result): result is ManualPredictionResult => Boolean(result));
  const recommendedCount = analyzedResults.filter((result) => result.analysisStatus === "recommended").length;
  const toggleable = (fixture: FixtureView) =>
    fixture.source === "provider" || fixture.source === "cache";

  return (
    <>
      <ManualHeader search={search} onSearch={setSearch} />
      <div className="app-layout manual-app-layout">
        <ManualSidebar leagues={leagues} leagueId={leagueId} onLeague={setLeagueId} />
        <main className="manual-page">
          <div className="manual-page-heading">
            <div>
              <div className="manual-breadcrumb"><Link href="/">Home</Link><ChevronRight size={14} /><span>Manual Analysis</span></div>
              <div className="manual-title-row">
                <Crosshair className="manual-title-icon" size={43} strokeWidth={1.8} />
                <div>
                  <div className="eyebrow">DATA-LED WORKSPACE</div>
                  <h1>Manual Prediction</h1>
                  <p>Select upcoming matches and let MatchMetric evaluate available markets.</p>
                </div>
              </div>
            </div>
            <div className="manual-callout">
              <Zap size={27} />
              <span>Analyze several matches and review the strongest eligible market for each fixture using available provider data.</span>
            </div>
          </div>

          <div className="manual-workspace">
            <section className="manual-panel fixture-selection-panel" aria-labelledby="select-matches-heading">
              <div className="manual-panel-heading">
                <div className="manual-panel-title">
                  <span className="step-badge">1</span>
                  <div><h2 id="select-matches-heading">Select Matches</h2><p>Choose up to {MAX_SELECTED} future fixtures</p></div>
                </div>
                <strong className="selected-counter"><span>{selectedIds.length}</span>/{MAX_SELECTED} selected</strong>
              </div>

              <label className="manual-search">
                <Search size={17} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fixtures..." aria-label="Search fixtures" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
              </label>

              <div className="manual-league-filters" role="group" aria-label="Filter by competition">
                <button type="button" className={!leagueId ? "active" : ""} onClick={() => setLeagueId("")}>All</button>
                {leagues.map((league) => (
                  <button type="button" key={league.id} className={leagueId === league.id ? "active" : ""} onClick={() => setLeagueId(league.id)}>
                    {league.name}
                  </button>
                ))}
              </div>

              <div className="manual-fixture-list" aria-live="polite">
                {loadingFixtures ? (
                  <div className="manual-fixture-skeletons" aria-label="Loading fixtures">
                    {[0, 1, 2, 3].map((item) => <div className="manual-fixture-skeleton skeleton" key={item} />)}
                  </div>
                ) : filteredFixtures.length ? (
                  filteredFixtures.map((fixture) => {
                    const selected = selectedIds.includes(fixture.id);
                    const expanded = expandedFixtures.includes(fixture.id);
                    const detail = details[fixture.id];
                    const detailsBusy = loadingDetails.includes(fixture.id);
                    const disabled = !toggleable(fixture) || (!selected && selectedIds.length >= MAX_SELECTED);
                    return (
                      <article className={`manual-fixture-card${selected ? " selected" : ""}`} key={fixture.id}>
                        <button
                          type="button"
                          className="manual-fixture-select"
                          aria-pressed={selected}
                          aria-label={`${selected ? "Remove" : "Select"} ${fixture.home.name} versus ${fixture.away.name}`}
                          disabled={disabled}
                          onClick={() => toggleFixture(fixture)}
                        >
                          <span className={`manual-checkbox${selected ? " checked" : ""}`}>{selected && <Check size={13} />}</span>
                        </button>
                        <div className="manual-fixture-main">
                          <div className="manual-teams">
                            <TeamCrest team={fixture.home} compact />
                            <span className="manual-team-name">{fixture.home.name}</span>
                            <span className="manual-versus">vs</span>
                            <TeamCrest team={fixture.away} compact />
                            <span className="manual-team-name">{fixture.away.name}</span>
                          </div>
                          <div className="manual-fixture-meta">
                            <span className="manual-league-name"><Trophy size={13} />{fixture.league.name}</span>
                            <span><CalendarDays size={13} />{hydrated ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(fixture.kickoff)) : "Local kickoff"}</span>
                            <span className="manual-status"><span />{fixture.statusLabel || "Scheduled"}</span>
                          </div>
                          {detail?.odds?.length ? (
                            <div className="manual-market-tags">
                              {Array.from(new Set(detail.odds.map((market) => market.category))).slice(0, 4).map((category) => (
                                <span key={category}>{marketCategories[category].short}</span>
                              ))}
                              <small>{detail.odds.length} priced markets</small>
                            </div>
                          ) : null}
                        </div>
                        <button type="button" className={`manual-expand-button${expanded ? " expanded" : ""}`} onClick={() => void toggleFixtureDetails(fixture.id)} aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} fixture details`}>
                          {expanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                        </button>
                        {expanded && (
                          <div className="manual-fixture-detail">
                            {detailsBusy ? <span className="manual-detail-loading"><span className="spinner" /> Loading provider markets...</span>
                              : detail ? (
                                <>
                                  <span>{detail.available.odds ? `${detail.odds.length} provider-priced markets returned` : "No priced markets returned for this fixture."}</span>
                                  <span>{detail.available.form ? `Recent form available: ${detail.homeForm.length} home-team matches, ${detail.awayForm.length} away-team matches` : "Recent scored form is not available on this provider plan."}</span>
                                  {detail.available.sidelined && <span>{detail.sidelined.length} unavailable players listed by the provider</span>}
                                </>
                              ) : <span>Fixture detail is currently unavailable from the provider.</span>}
                          </div>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <div className="manual-empty">
                    <CalendarDays size={23} />
                    <strong>{feedError ? "Fixtures unavailable" : "No fixtures match your filters"}</strong>
                    <span>{feedError || "Try another league or search term."}</span>
                    {feedError && <button type="button" className="outline-button" onClick={() => void loadFixtures()}>Retry fixtures <ArrowRight size={13} /></button>}
                  </div>
                )}
              </div>

              <div className="manual-selection-footer">
                <div className="manual-selection-summary">
                  <Users size={14} />
                  <span>{selectedFixtures.length ? selectedFixtures.map((fixture) => `${fixture.home.name} – ${fixture.away.name}`).join(" · ") : "No matches selected"}</span>
                </div>
                <div className="manual-selection-actions">
                  <button type="button" className="outline-button" onClick={clearSelection} disabled={!selectedIds.length || analysisBusy}><Trash2 size={14} />Clear Selection</button>
                  <button type="button" className="primary-button" onClick={() => void runAnalysis(selectedIds)} disabled={!selectedIds.length || analysisBusy}>
                    {analysisBusy ? <><LoaderCircle className="manual-spin" size={15} />Analyzing</> : <>Get Analysis <ArrowRight size={15} /></>}
                  </button>
                </div>
              </div>
            </section>

            <section className="manual-panel analysis-panel" id="analysis-panel" aria-labelledby="analysis-results-heading">
              <div className="manual-panel-heading">
                <div className="manual-panel-title">
                  <span className="step-badge">2</span>
                  <div><h2 id="analysis-results-heading">Analysis Results</h2><p>Model estimates from provider-backed match data</p></div>
                </div>
                <span className="model-label"><Sparkles size={13} />MatchMetric Model</span>
              </div>

              {analysisBusy && (
                <div className="manual-progress" role="status" aria-live="polite">
                  <div className="manual-progress-icon"><LoaderCircle className="manual-spin" size={23} /></div>
                  <div className="manual-progress-copy">
                    <strong>Analyzing {progress.done + 1} of {progress.total}</strong>
                    <span>{progress.fixtureName || "Loading provider-backed form and market data..."}</span>
                    <div className="progress-track"><span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                  </div>
                </div>
              )}

              {!user && !authLoading && (
                <div className="manual-auth-note"><LockKeyhole size={15} />Sign in is required to run or save personal analysis.</div>
              )}
              {saveMessage && <div className={`notice ${saveMessage.includes("saved") ? "success-notice" : "error-notice"}`} role="status">{saveMessage}</div>}

              {analyzedResults.length > 0 && (
                <div className="manual-analysis-summary">
                  <div className="manual-summary-check"><CheckCircle2 size={26} /></div>
                  <div>
                    <strong>{analyzedResults.length} {analyzedResults.length === 1 ? "Match" : "Matches"} Analyzed</strong>
                    <span>{recommendedCount} value-qualified {recommendedCount === 1 ? "recommendation" : "recommendations"} · no outcome is guaranteed.</span>
                  </div>
                </div>
              )}

              {failed[selectedIds.find((id) => failed[id]) ?? ""] && (
                <div className="notice error-notice manual-retry-notice">
                  <span>{failed[selectedIds.find((id) => failed[id]) ?? ""]}</span>
                  <button type="button" className="text-button" onClick={() => void runAnalysis(selectedIds.filter((id) => failed[id]))} disabled={analysisBusy}>Retry failed</button>
                </div>
              )}

              {analyzedResults.length ? (
                <div className="manual-result-list">
                  {analyzedResults.map((result) => (
                    <PredictionCard key={result.fixtureId} result={result} hydrated={hydrated} />
                  ))}
                </div>
              ) : !analysisBusy && (
                <div className="manual-analysis-empty">
                  <div className="manual-empty-orbit"><Activity size={25} /></div>
                  <strong>Your analysis will appear here</strong>
                  <span>Select one or more upcoming fixtures, then run MatchMetric’s model to review provider-backed form, odds, and estimated value.</span>
                  <div className="manual-empty-steps"><span>01 Select matches</span><ChevronRight size={13} /><span>02 Run model</span><ChevronRight size={13} /><span>03 Review results</span></div>
                </div>
              )}

              <div className="manual-analysis-footer">
                <div className="manual-pro-tip" id="manual-help">
                  <Lightbulb size={20} />
                  <div><strong>Model notes</strong><span>Only one strongest selection is shown per match. Estimates use recent completed scorelines and provider prices; confidence remains capped until historical model calibration is available.</span></div>
                </div>
                <div className="manual-result-actions">
                  <button type="button" className="outline-button" onClick={() => void savePredictions()} disabled={!selectedIds.some((id) => results[id]?.analysisStatus === "recommended") || saving || analysisBusy}>
                    {saving ? <><span className="spinner" />Saving</> : <><BookMarked size={14} />Save Picks</>}
                  </button>
                  <button type="button" className="primary-button" onClick={() => document.getElementById("select-matches-heading")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Add More Matches <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <p className="manual-disclaimer">Probabilities are statistical estimates, not guarantees. Never stake money you cannot afford to lose.</p>
            </section>
          </div>
        </main>
      </div>

      {authModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthModal(null); }}
          onKeyDown={(event) => { if (event.key === "Escape") setAuthModal(null); }}
        >
          <section className="modal manual-auth-modal" role="dialog" aria-modal="true" aria-labelledby="manual-auth-title">
            <div className="modal-header">
              <div><div className="auth-lock"><LockKeyhole size={18} /></div><h2 id="manual-auth-title">{authModal === "analysis" ? "Sign in to analyze matches" : "Sign in to save your picks"}</h2><p>Your selected fixtures will be kept in this browser while you sign in.</p></div>
              <button ref={authCloseButton} type="button" className="modal-close" onClick={() => setAuthModal(null)} aria-label="Close sign in dialog"><X size={16} /></button>
            </div>
            <div className="manual-auth-actions">
              <button type="button" className="primary-button" onClick={() => {
                sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
                router.push("/login?next=%2Fmanual-analysis");
              }}>Log in <ArrowRight size={14} /></button>
              <button type="button" className="outline-button" onClick={() => {
                sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
                router.push("/register?next=%2Fmanual-analysis");
              }}>Create account</button>
            </div>
            <p className="auth-footnote">Personal analysis and saved predictions are private to your account.</p>
          </section>
        </div>
      )}
      <nav className="mobile-bottom-nav manual-mobile-nav" aria-label="Quick navigation">
        <Link href="/"><Home size={16} />Home</Link>
        <Link href="/#fixtures"><CalendarDays size={16} />Fixtures</Link>
        <a href="#analysis-panel"><Target size={16} />Analysis</a>
        <Link href="/account"><BookMarked size={16} />Saved</Link>
      </nav>
    </>
  );
}

function PredictionCard({ result, hydrated }: { result: ManualPredictionResult; hydrated: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const confidenceClass = result.confidence?.toLowerCase() ?? "low";
  return (
    <article className={`manual-result-card ${result.analysisStatus}`}>
      <div className="manual-result-top">
        <div className="manual-result-teams">
          <TeamCrest team={result.homeTeam} />
          <div className="manual-result-team-copy"><strong>{result.homeTeam.name}</strong><span>vs</span><strong>{result.awayTeam.name}</strong></div>
          <TeamCrest team={result.awayTeam} />
        </div>
        <div className="manual-result-pick">
          {result.analysisStatus === "recommended" ? (
            <>
              <span className="our-pick-label"><Trophy size={11} />Value-qualified pick</span>
              <strong>{result.recommendedSelection}</strong>
              <b>{result.estimatedProbability?.toFixed(1)}%</b>
              <small>{result.marketLabel}</small>
            </>
          ) : (
            <>
              <span className={`manual-result-state ${result.analysisStatus}`}>
                {result.analysisStatus === "insufficient" ? "Insufficient data" : "No positive value"}
              </span>
              <strong>No recommendation</strong>
              <small>{result.analysisStatus === "insufficient" ? "More real form data required" : "At current provider prices"}</small>
            </>
          )}
        </div>
        <div className="manual-result-market">
          <span>Best Market</span>
          <strong>{result.marketLabel ?? "—"}</strong>
          {typeof result.availableOdds === "number" && <small>Price {result.availableOdds.toFixed(2)}</small>}
        </div>
        <div className="manual-result-confidence">
          <span>Confidence</span>
          <strong className={`confidence-${confidenceClass}`}>
            <span className="confidence-bars" aria-hidden="true"><i /><i /><i /><i /></span>
            {result.confidence ?? "—"}
          </strong>
          {typeof result.expectedValue === "number" && <small>EV {result.expectedValue >= 0 ? "+" : ""}{(result.expectedValue * 100).toFixed(1)}%</small>}
        </div>
      </div>
      <div className="manual-result-meta">
        <span>{result.leagueName}</span>
        <span>{hydrated ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(result.kickoff)) : "Local kickoff"}</span>
        <span className={`data-quality ${result.dataQuality.toLowerCase()}`}>{result.dataQuality} data</span>
      </div>
      <button className="manual-result-insight-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        <Sparkles size={13} /><span><strong>Key Insights:</strong> {result.keyInsights[0] ?? "No verified insights available."}</span>
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {expanded && (
        <div className="manual-result-details">
          <div className="manual-form-comparison">
            <div><span>{result.homeTeam.name} recent form</span><strong>{result.homeFormSummary}</strong></div>
            <div><span>{result.awayTeam.name} recent form</span><strong>{result.awayFormSummary}</strong></div>
          </div>
          <div className="manual-insight-columns">
            <section><h4><Activity size={13} /> Evidence used</h4>
              {result.keyInsights.length ? <ul>{result.keyInsights.map((insight) => <li key={insight}>{insight}</li>)}</ul> : <p>No verified pre-match insights were returned.</p>}
            </section>
            <section><h4><CircleHelp size={13} /> Limitations</h4>
              {result.weakeningFactors.length ? <ul>{result.weakeningFactors.map((factor) => <li key={factor}>{factor}</li>)}</ul> : <p>No additional limitations were reported.</p>}
            </section>
          </div>
          {result.bestAvailableMarkets.length > 0 && (
            <div className="manual-priced-markets">
              <h4>Other priced selections evaluated</h4>
              <p>These are alternatives from the same match, not independent picks.</p>
              <div>{result.bestAvailableMarkets.slice(0, 4).map((market) => (
                <span key={`${market.category}:${market.selection}:${market.odds}`}>
                  {market.selection} · model {market.estimatedProbability.toFixed(1)}% vs raw implied {market.impliedProbability.toFixed(1)}% · {market.odds.toFixed(2)} · EV {(market.expectedValue * 100).toFixed(1)}%
                </span>
              ))}</div>
            </div>
          )}
          <div className="manual-model-version">Model {result.modelVersion} · generated {hydrated ? new Date(result.generatedAt).toLocaleTimeString() : "after analysis"}</div>
        </div>
      )}
    </article>
  );
}
