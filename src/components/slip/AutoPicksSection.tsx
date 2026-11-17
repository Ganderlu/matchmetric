"use client";

import { ChevronDown, Loader2, Plus, Share2, Sparkles, TrendingUp, Wand2, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSlip } from "@/context/SlipContext";
import { useSlipActions } from "@/hooks/use-slip-actions";
import { fetchFixtureFeed } from "@/lib/football-client";
import type { FixtureView } from "@/lib/football/views";
import { autoPickToEntry, isAnalysableFixture, requestAutoPicks } from "@/lib/slip-analysis";
import { ConfidenceBadge, DataQualityBadge, OddsDisplay, ProbabilityIndicator } from "@/components/shared/indicators";
import { ShareSlipDialog } from "@/components/slip/ShareSlipDialog";
import { MAX_SLIP_ENTRIES, type AutoPick, type AutoPickFilters } from "@/types/slip";

/**
 * Automatic picks.
 *
 * This section only configures and ranks. Every pick it displays comes back from the engine
 * route already analysed, which is why an automatic card in the Game Slip never shows an
 * Analyse control. Nothing here invents a probability or a price: if the engine finds no
 * positive-value selection the section says so instead of filling the space.
 */

const isoDate = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};

/** Take the engine's own ranked picks and stop once the combined price reaches the target. */
function chooseByTarget(picks: AutoPick[], count: number, targetOdds: number): AutoPick[] {
  const limited = picks.slice(0, Math.max(1, Math.min(MAX_SLIP_ENTRIES, count)));
  if (!(targetOdds > 1) || limited.length <= 1) return limited;
  const chosen: AutoPick[] = [];
  let total = 1;
  for (const pick of limited) {
    chosen.push(pick);
    total *= pick.odds ?? 1;
    if (total >= targetOdds) break;
  }
  return chosen;
}

export function AutoPicksSection() {
  const { addEntries, setTab, setMessage } = useSlip();
  const { save, saving } = useSlipActions();

  const [candidates, setCandidates] = useState<FixtureView[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidateNotice, setCandidateNotice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<AutoPickFilters>({
    targetOdds: 0,
    selectionCount: 4,
    leagueIds: [],
    mode: "value",
    matchResultOnly: false,
    onePerLeague: false,
  });

  const [rawPicks, setRawPicks] = useState<AutoPick[]>([]);
  const [notice, setNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCandidates(true);
    fetchFixtureFeed({ from: isoDate(0), to: isoDate(3), perPage: 60, signal: controller.signal })
      .then((payload) => {
        setCandidates(payload.fixtures.filter((fixture) => isAnalysableFixture(fixture.id)));
        setCandidateNotice(payload.notice ?? "");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setCandidateNotice(cause instanceof Error ? cause.message : "Candidate fixtures could not be loaded.");
      })
      .finally(() => setLoadingCandidates(false));
    return () => controller.abort();
  }, []);

  const availableLeagues = useMemo(
    () => Array.from(new Set(candidates.map((fixture) => fixture.league.name))).slice(0, 10),
    [candidates],
  );

  const picks = useMemo(
    () => chooseByTarget(rawPicks, filters.selectionCount, filters.targetOdds),
    [filters.selectionCount, filters.targetOdds, rawPicks],
  );

  const combinedOdds = useMemo(() => {
    const priced = picks.filter((pick) => typeof pick.odds === "number");
    if (!priced.length || priced.length !== picks.length) return undefined;
    return priced.reduce((total, pick) => total * (pick.odds as number), 1);
  }, [picks]);

  const update = <Key extends keyof AutoPickFilters>(key: Key, value: AutoPickFilters[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const toggleLeague = (league: string) =>
    setFilters((current) => ({
      ...current,
      leagueIds: current.leagueIds.includes(league)
        ? current.leagueIds.filter((entry) => entry !== league)
        : [...current.leagueIds, league],
    }));

  const generate = async () => {
    if (!candidates.length) {
      setNotice(
        candidateNotice ||
          "No provider-backed fixtures are available to evaluate. Automatic picks are only generated from real fixture data.",
      );
      return;
    }
    setGenerating(true);
    setNotice("");
    setRawPicks([]);
    try {
      const response = await requestAutoPicks(
        candidates.slice(0, 12).map((fixture) => fixture.id),
        filters,
      );
      setRawPicks(response.picks);
      setNotice(response.notice ?? "");
      setGenerated(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Automatic picks could not be generated.");
    } finally {
      setGenerating(false);
    }
  };

  const addPick = (pick: AutoPick) => {
    const result = addEntries([autoPickToEntry(pick)]);
    if (!result.ok) {
      setMessage(result.reason ?? "That pick could not be added to your slip.");
      return;
    }
    setMessage(result.reason ?? "Added to your Game Slip. Automatic picks keep their analysed status.");
  };

  const addAll = () => {
    if (!picks.length) return;
    const result = addEntries(picks.map(autoPickToEntry));
    if (!result.ok && result.reason) {
      setMessage(result.reason);
      return;
    }
    setMessage(`${picks.length} automatic ${picks.length === 1 ? "pick" : "picks"} moved to your Game Slip.`);
    setTab("slip");
  };

  const savePicks = async () => {
    if (!picks.length) return;
    const entries = picks.map(autoPickToEntry);
    addEntries(entries);
    await save(entries);
  };

  return (
    <div className="slip-section slip-auto">
      <div className="slip-auto-config">
        <div className="slip-auto-config-head">
          <div>
            <span className="slip-eyebrow">Automatic Picks</span>
            <h3>Configure your selection</h3>
          </div>
          <button
            type="button"
            className="slip-ghost-btn"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
          >
            Filters <ChevronDown size={13} strokeWidth={2.4} className={showFilters ? "flip" : ""} />
          </button>
        </div>

        <div className="slip-segmented" role="group" aria-label="Ranking mode">
          <button
            type="button"
            className={filters.mode === "value" ? "active" : ""}
            onClick={() => update("mode", "value")}
          >
            <Sparkles size={13} strokeWidth={2.3} /> Best Value
          </button>
          <button
            type="button"
            className={filters.mode === "probability" ? "active" : ""}
            onClick={() => update("mode", "probability")}
          >
            <TrendingUp size={13} strokeWidth={2.3} /> Highest Probability
          </button>
        </div>

        <div className="slip-field-grid">
          <label className="slip-field">
            <span>Number of selections</span>
            <input
              type="number"
              min={1}
              max={MAX_SLIP_ENTRIES}
              value={filters.selectionCount}
              onChange={(event) =>
                update("selectionCount", Math.max(1, Math.min(MAX_SLIP_ENTRIES, Number(event.target.value) || 1)))
              }
            />
          </label>
          <label className="slip-field">
            <span>Target total odds</span>
            <input
              type="number"
              min={0}
              step={0.5}
              placeholder="Optional"
              value={filters.targetOdds || ""}
              onChange={(event) => update("targetOdds", Number(event.target.value) || 0)}
            />
          </label>
        </div>

        {showFilters && (
          <div className="slip-auto-advanced">
            <label className="slip-toggle">
              <input
                type="checkbox"
                checked={filters.matchResultOnly}
                onChange={(event) => update("matchResultOnly", event.target.checked)}
              />
              <span>
                Match-result markets only
                <small>Limit picks to match winner and double chance.</small>
              </span>
            </label>
            <label className="slip-toggle">
              <input
                type="checkbox"
                checked={filters.onePerLeague}
                onChange={(event) => update("onePerLeague", event.target.checked)}
              />
              <span>
                One selection per league
                <small>Spread the slip across competitions.</small>
              </span>
            </label>
            {availableLeagues.length > 0 && (
              <div className="slip-league-filter">
                <span>Competitions</span>
                <div className="slip-league-chips">
                  {availableLeagues.map((league) => (
                    <button
                      type="button"
                      key={league}
                      className={`slip-chip ${filters.leagueIds.includes(league) ? "active" : ""}`}
                      onClick={() => toggleLeague(league)}
                    >
                      {league}
                    </button>
                  ))}
                </div>
                <small className="slip-field-hint">
                  Leave all unselected to consider every available competition.
                </small>
              </div>
            )}
          </div>
        )}

        <button type="button" className="slip-analyse-all" onClick={generate} disabled={generating || loadingCandidates}>
          {generating ? (
            <>
              <Loader2 size={16} className="spin" /> Generating picks...
            </>
          ) : loadingCandidates ? (
            <>
              <Loader2 size={16} className="spin" /> Loading fixtures...
            </>
          ) : (
            <>
              <Zap size={16} strokeWidth={2.4} /> Generate Auto Picks
            </>
          )}
        </button>
      </div>

      {notice && <p className="slip-notice">{notice}</p>}

      {picks.length > 0 && (
        <>
          <div className="slip-auto-results-head">
            <span>
              {picks.length} {picks.length === 1 ? "pick" : "picks"} · already analysed
            </span>
            {combinedOdds && (
              <span>
                Combined {combinedOdds.toFixed(2)}
                {filters.targetOdds > 1 && ` · target ${filters.targetOdds.toFixed(2)}`}
              </span>
            )}
          </div>
          <div className="slip-entry-list">
            {picks.map((pick) => (
              <article className="slip-autopick-card" key={pick.fixtureId}>
                <div className="slip-card-head">
                  <span className="slip-card-league">
                    {pick.leagueFlag ? `${pick.leagueFlag} ` : ""}
                    {pick.competition}
                  </span>
                  <span className="slip-card-time">
                    {new Date(pick.kickoff).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="slip-card-teams slip-card-teams-static">
                  <span className="slip-card-team">{pick.homeTeam}</span>
                  <span className="slip-card-vs">vs</span>
                  <span className="slip-card-team slip-card-team-away">{pick.awayTeam}</span>
                </div>
                <div className="slip-pick">
                  <span className="slip-pick-tag">
                    <Sparkles size={12} strokeWidth={2.4} /> MatchMetric pick
                  </span>
                  <p className="slip-pick-selection">
                    <strong>{pick.marketLabel}</strong> · {pick.selection}
                  </p>
                  <ProbabilityIndicator probability={pick.probability} impliedProbability={pick.impliedProbability} />
                  <div className="slip-pick-meta">
                    <OddsDisplay odds={pick.odds} />
                    <ConfidenceBadge confidence={pick.confidence} />
                    <DataQualityBadge quality={pick.dataQuality} />
                  </div>
                </div>
                <div className="slip-card-actions">
                  <button type="button" className="slip-ghost-btn" onClick={() => addPick(pick)}>
                    <Plus size={13} strokeWidth={2.6} /> Add to Game Slip
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <div className="slip-section-actions">
        <button
          type="button"
          className="slip-analyse-all"
          onClick={addAll}
          disabled={!picks.length}
        >
          <Plus size={16} strokeWidth={2.6} /> Add all to Game Slip
        </button>
        {picks.length > 0 && (
          <div className="slip-action-buttons">
            <button type="button" className="slip-share-btn" onClick={() => setSharing(true)}>
              <Share2 size={15} strokeWidth={2.2} /> Share picks
            </button>
            <button type="button" className="slip-save-btn" onClick={savePicks} disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                <>
                  <Wand2 size={15} strokeWidth={2.2} /> Save to Open Games
                </>
              )}
            </button>
          </div>
        )}
        {generated && !picks.length && !notice && (
          <p className="slip-section-note">No qualifying picks were returned for this configuration.</p>
        )}
      </div>

      {sharing && (
        <ShareSlipDialog entries={picks.map(autoPickToEntry)} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}
