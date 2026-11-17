"use client";

import { ChevronDown, Info, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { TeamView } from "@/lib/football/views";
import type {
  OpenGamesEntry,
  OpenGamesLegOutcome,
  OpenGamesMatch,
  OpenGamesStatus,
} from "@/lib/open-games/types";

/**
 * One saved prediction entry.
 *
 * The compact card keeps every match's own state and result visible, whatever the entry's overall
 * outcome: a member needs to see that one selection is still to play or that one leg lost, not just
 * the entry's headline. The live score sits beside the saved pick and never replaces it, so a match
 * going in play cannot rewrite the prediction or the probability recorded at saving time.
 *
 * The expanded view adds the odds and probability recorded at saving time, the engine's original
 * recommendation next to the member's saved prediction, and the analysis snapshot where one was
 * preserved. Nothing here is recalculated and nothing is ever fabricated.
 */

const STATUS_LABEL: Record<OpenGamesStatus, string> = {
  open: "OPEN",
  live: "LIVE",
  won: "WON",
  lost: "LOST",
  voided: "VOIDED",
};

const LEG_LABEL: Record<OpenGamesLegOutcome, string> = {
  won: "Won",
  lost: "Lost",
  push: "Push",
  void: "Void",
  open: "Awaiting result",
  unevaluable: "Not gradable",
};

function formatDateTime(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string, short?: string): string {
  const source = (short || name).trim();
  return source.slice(0, 3).toUpperCase();
}

/** The live picture, labelled from the feed's own state — never from an assumption. */
function stateLabel(match: OpenGamesMatch): string {
  switch (match.matchStatus) {
    case "live":
    case "halftime":
      return match.minute !== null ? `LIVE ${match.minute}'` : "LIVE";
    case "finished":
      return "FULL TIME";
    case "postponed":
      return "POSTPONED";
    case "cancelled":
      return "CANCELLED";
    case "scheduled":
      return "UPCOMING";
    default:
      return "AWAITING RESULT";
  }
}

function stateClass(match: OpenGamesMatch): string {
  switch (match.matchStatus) {
    case "live":
    case "halftime":
      return "live";
    case "finished":
      return "finished";
    case "postponed":
    case "cancelled":
      return "void";
    case "scheduled":
      return "upcoming";
    default:
      return "unknown";
  }
}

/** The score to show: the running score in play, otherwise the final score. */
function scoreText(match: OpenGamesMatch): string | null {
  const live = match.liveScore;
  if (live && live.home !== null && live.away !== null) return `${live.home} – ${live.away}`;
  if (match.finalScore) return `${match.finalScore.home} – ${match.finalScore.away}`;
  return null;
}

function TeamName({ team }: { team: TeamView }) {
  return (
    <span className="og-team">
      <span className="og-team-badge" aria-hidden="true">
        {initials(team.name, team.short)}
      </span>
      {team.name}
    </span>
  );
}

export function OpenGamesEntryCard({ entry }: { entry: OpenGamesEntry }) {
  const [expanded, setExpanded] = useState(false);

  const comparable = entry.matches.filter(
    (match) =>
      match.recorded &&
      (match.outcome === "won" || match.outcome === "lost") &&
      (match.engineOutcome === "won" || match.engineOutcome === "lost"),
  );
  const kept = comparable.filter((match) => !match.overridden).length;

  return (
    <article className={`og-card status-${entry.status}`}>
      <div className="og-card-head">
        <div className="og-card-top">
          <span className="og-ref" title={entry.reference}>
            MATCHMETRIC #{entry.reference}
          </span>
          <div className="og-card-top-right">
            <span className={`og-status-badge ${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
            <button
              type="button"
              className="og-toggle"
              aria-expanded={expanded}
              aria-label={expanded ? "Hide prediction details" : "Show prediction details"}
              onClick={() => setExpanded((value) => !value)}
            >
              <ChevronDown size={16} className={expanded ? "open" : ""} />
            </button>
          </div>
        </div>
        <div className="og-card-meta">
          <span>
            {entry.matchCount} {entry.matchCount === 1 ? "Match" : "Matches"} · {entry.sourceLabel}
          </span>
          <span>Saved {formatDateTime(entry.savedAt)}</span>
          {entry.liveMatches > 0 ? <span className="og-card-live">{entry.liveMatches} in play</span> : null}
        </div>
      </div>

      <ul className="og-match-list">
        {entry.matches.map((match) => (
          <li className="og-match" key={match.fixtureId}>
            <div className="og-match-top">
              <span className={`og-state ${stateClass(match)}`}>{stateLabel(match)}</span>
              {scoreText(match) ? <span className="og-match-score">{scoreText(match)}</span> : null}
            </div>
            <div className="og-match-teams">
              <TeamName team={match.home} />
              <span className="og-vs">vs</span>
              <TeamName team={match.away} />
            </div>
            <div className="og-match-meta">
              <span className="og-competition">{match.competition}</span>
              {match.kickoff ? <span>{formatDateTime(match.kickoff)}</span> : null}
            </div>
            <div className="og-match-pick">
              <span className="og-pick">
                <span className="og-pick-market">{match.marketLabel}</span>
                <span className="og-pick-selection">{match.selection}</span>
              </span>
              <span className="og-pick-values">
                <em>Prob</em>
                {match.finalSelection.probability !== null
                  ? ` ${Math.round(match.finalSelection.probability)}%`
                  : " —"}
                <em>Odds</em>
                {match.finalSelection.odds !== null ? ` ${match.finalSelection.odds.toFixed(2)}` : " —"}
              </span>
              <span className={`og-leg-pill ${match.outcome}`}>{LEG_LABEL[match.outcome]}</span>
            </div>
          </li>
        ))}
      </ul>

      {expanded ? (
        <div className="og-card-body">
          <div className="og-overview">
            <h3>Prediction Overview</h3>
            <dl>
              <div>
                <dt>Reference</dt>
                <dd>MATCHMETRIC #{entry.reference}</dd>
              </div>
              <div>
                <dt>Date saved</dt>
                <dd>{entry.savedAt ? formatDateTime(entry.savedAt) : "—"}</dd>
              </div>
              <div>
                <dt>Number of matches</dt>
                <dd>{entry.matchCount}</dd>
              </div>
              <div>
                <dt>Overall status</dt>
                <dd>{STATUS_LABEL[entry.status]}</dd>
              </div>
              <div>
                <dt>Selection source</dt>
                <dd>{entry.sourceLabel}</dd>
              </div>
              <div>
                <dt>Model version</dt>
                <dd>{entry.modelVersion || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Settled</dt>
                <dd>{entry.settledAt ? formatDateTime(entry.settledAt) : "Not settled"}</dd>
              </div>
              <div>
                <dt>Match results</dt>
                <dd>
                  {entry.wonMatches} won · {entry.lostMatches} lost · {entry.voidedMatches} void
                  {entry.openMatches > 0 ? ` · ${entry.openMatches} pending` : ""}
                </dd>
              </div>
            </dl>
          </div>

          <div className="og-match-details">
            {entry.matches.map((match) => (
              <MatchDetail key={match.fixtureId} match={match} />
            ))}
          </div>

          <div className="og-compare-summary">
            <Target size={14} />
            <span>
              {comparable.length === 0
                ? "No selection in this entry has a decisive outcome on both sides, so nothing is being claimed about the comparison."
                : kept === comparable.length
                  ? `You kept MatchMetric's original recommendation in all ${comparable.length} comparable ${comparable.length === 1 ? "selection" : "selections"}.`
                  : `You chose differently from MatchMetric's recommendation in ${comparable.length - kept} of ${comparable.length} comparable selections.`}
            </span>
          </div>

          <div className="og-card-actions">
            <Link className="outline-button" href="/manual-analysis">
              <Sparkles size={13} /> Analyse Similar Matches
            </Link>
            <p>Opens the analysis workspace. Your saved picks are never copied into a new slip automatically.</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MatchDetail({ match }: { match: OpenGamesMatch }) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const sameSelection =
    match.recommendation !== null && match.finalSelection.selection === match.recommendation.selection;
  const score = scoreText(match);

  return (
    <section className="og-match-detail">
      <header className="og-detail-head">
        <div className="og-detail-teams">
          <TeamName team={match.home} />
          <span className="og-vs">vs</span>
          <TeamName team={match.away} />
        </div>
        <span className="og-detail-score">{score ?? "—"}</span>
      </header>

      <p className="og-detail-sub">
        {match.competition}
        {match.kickoff ? ` · ${formatDateTime(match.kickoff)}` : ""}
        {match.statusLabel ? ` · ${match.statusLabel}` : ""}
      </p>

      <dl className="og-facts">
        <div>
          <dt>Market</dt>
          <dd>{match.marketLabel || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Selected outcome</dt>
          <dd>{match.selection || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Probability at saving</dt>
          <dd>
            {match.finalSelection.probability !== null
              ? `${Math.round(match.finalSelection.probability)}%`
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Odds at saving</dt>
          <dd>{match.finalSelection.odds !== null ? match.finalSelection.odds.toFixed(2) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Match result</dt>
          <dd>{score ? `${score} · ${stateLabel(match)}` : stateLabel(match)}</dd>
        </div>
        <div>
          <dt>Prediction outcome</dt>
          <dd>
            <span className={`og-leg-pill ${match.outcome}`}>{LEG_LABEL[match.outcome]}</span>
          </dd>
        </div>
      </dl>

      <div className="og-reco">
        <div className="og-reco-row">
          <span className="og-reco-label">MatchMetric Original Pick</span>
          {match.recommendation ? (
            <>
              <strong>
                {match.recommendation.marketLabel || "Recommended market"} — {match.recommendation.selection}
              </strong>
              <small>
                {match.recommendation.estimatedProbability !== null
                  ? `Estimated ${Math.round(match.recommendation.estimatedProbability)}%`
                  : "No probability recorded"}
                {match.recommendation.odds !== null ? ` · odds ${match.recommendation.odds.toFixed(2)}` : ""}
              </small>
            </>
          ) : (
            <strong className="og-muted">No recommendation was recorded for this match.</strong>
          )}
        </div>
        <div className="og-reco-row">
          <span className="og-reco-label">Your Saved Prediction</span>
          <strong>
            {match.finalSelection.marketLabel || match.marketLabel} — {match.finalSelection.selection}
          </strong>
          {sameSelection ? <em className="og-same">Same Selection</em> : null}
        </div>
      </div>

      {match.liveUpdatedAt ? (
        <p className="og-live-note">Live state captured {formatDateTime(match.liveUpdatedAt)}.</p>
      ) : null}

      {match.analysis ? (
        <div className="og-analysis">
          <button
            type="button"
            className="og-analysis-toggle"
            aria-expanded={analysisOpen}
            onClick={() => setAnalysisOpen((value) => !value)}
          >
            {analysisOpen ? "Hide Saved Analysis" : "View Saved Analysis"}
            <ChevronDown size={14} className={analysisOpen ? "open" : ""} />
          </button>

          {analysisOpen ? (
            <div className="og-analysis-body">
              <p className="og-analysis-caption">
                Preserved exactly as it was recorded before kickoff. Nothing here has been rewritten.
              </p>
              {match.analysis.homeForm ? (
                <div className="og-analysis-form">
                  <strong>{match.home.name}</strong>
                  <p>{match.analysis.homeForm}</p>
                </div>
              ) : null}
              {match.analysis.awayForm ? (
                <div className="og-analysis-form">
                  <strong>{match.away.name}</strong>
                  <p>{match.analysis.awayForm}</p>
                </div>
              ) : null}
              {match.analysis.keyInsights.length ? (
                <div className="og-analysis-block">
                  <span>Key insights</span>
                  <ul>
                    {match.analysis.keyInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {match.analysis.weakeningFactors.length ? (
                <div className="og-analysis-block">
                  <span>Weakening factors</span>
                  <ul>
                    {match.analysis.weakeningFactors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <dl className="og-analysis-facts">
                <div>
                  <dt>Confidence</dt>
                  <dd>{match.analysis.confidence ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Data quality</dt>
                  <dd>{match.analysis.dataQuality ?? "Not recorded"}</dd>
                </div>
                <div>
                  <dt>Stated probability</dt>
                  <dd>
                    {match.analysis.estimatedProbability !== null
                      ? `${Math.round(match.analysis.estimatedProbability)}%`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="og-analysis-missing">
          <Info size={12} /> No saved analysis was preserved for this match.
        </p>
      )}
    </section>
  );
}
