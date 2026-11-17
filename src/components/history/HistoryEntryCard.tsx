"use client";

import { ChevronDown, Info, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { HistoryEntry, HistoryLegOutcome, HistoryMatch, HistoryStatus } from "@/lib/history/types";

/**
 * One completed prediction entry.
 *
 * The compact card keeps every match's own result visible, whatever the entry's overall outcome:
 * a manager needs to see that one leg lost, not just that the entry lost. The expanded view adds
 * the odds and probabilities recorded at saving time, the engine's original recommendation beside
 * the member's final selection, and the historical analysis snapshot where one was preserved.
 * Nothing here is recalculated and no mistake is ever implied.
 */

const STATUS_LABEL: Record<HistoryStatus, string> = { won: "WON", lost: "LOST", voided: "VOIDED" };

const LEG_LABEL: Record<HistoryLegOutcome, string> = {
  won: "Won",
  lost: "Lost",
  push: "Push",
  void: "Void",
  open: "Awaiting result",
  unevaluable: "Not gradable",
};

function formatDate(value: string): string {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

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

export function HistoryEntryCard({ entry }: { entry: HistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  const comparable = entry.matches.filter(
    (match) =>
      match.recorded &&
      (match.outcome === "won" || match.outcome === "lost") &&
      (match.engineOutcome === "won" || match.engineOutcome === "lost"),
  );
  const kept = comparable.filter((match) => !match.overridden).length;

  return (
    <article className={`history-card status-${entry.status}`}>
      <div className="history-card-head">
        <div className="history-card-top">
          <span className="history-ref" title={entry.reference}>
            MATCHMETRIC #{entry.reference}
          </span>
          <span className={`history-status-badge ${entry.status}`}>{STATUS_LABEL[entry.status]}</span>
        </div>
        <div className="history-card-meta">
          <span>
            {entry.matchCount} {entry.matchCount === 1 ? "Match" : "Matches"} · {entry.sourceLabel}
          </span>
          <span>Saved {formatDate(entry.savedAt)}</span>
          {entry.settledAt ? <span>Settled {formatDate(entry.settledAt)}</span> : null}
        </div>
      </div>

      <ul className="history-mini-list">
        {entry.matches.map((match) => (
          <li className="history-mini" key={match.fixtureId}>
            <div className="history-mini-main">
              <span className="history-team">
                <span className="history-team-badge" aria-hidden="true">
                  {initials(match.home.name, match.home.short)}
                </span>
                {match.home.name}
              </span>
              <span className="history-mini-vs">vs</span>
              <span className="history-team">
                <span className="history-team-badge" aria-hidden="true">
                  {initials(match.away.name, match.away.short)}
                </span>
                {match.away.name}
              </span>
              <span className="history-mini-score">
                {match.finalScore ? `${match.finalScore.home} – ${match.finalScore.away}` : "—"}
              </span>
            </div>
            <div className="history-mini-meta">
              <span className="history-mini-competition">{match.competition}</span>
              <span className="history-mini-pick">
                {match.marketLabel} — {match.selection}
              </span>
              <span className={`history-leg-pill ${match.outcome}`}>{LEG_LABEL[match.outcome]}</span>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="history-details-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Hide Details" : "View Details"}
        <ChevronDown size={15} className={expanded ? "open" : ""} />
      </button>

      {expanded ? (
        <div className="history-card-body">
          <div className="history-overview">
            <h3>Prediction Overview</h3>
            <dl>
              <div>
                <dt>Reference</dt>
                <dd>MATCHMETRIC #{entry.reference}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{entry.savedAt ? formatDateTime(entry.savedAt) : "—"}</dd>
              </div>
              <div>
                <dt>Settled</dt>
                <dd>{entry.settledAt ? formatDateTime(entry.settledAt) : "—"}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{entry.sourceLabel}</dd>
              </div>
              <div>
                <dt>Matches</dt>
                <dd>{entry.matchCount}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{STATUS_LABEL[entry.status]}</dd>
              </div>
              <div>
                <dt>Model version</dt>
                <dd>{entry.modelVersion || "Not recorded"}</dd>
              </div>
            </dl>
          </div>

          <div className="history-match-details">
            {entry.matches.map((match) => (
              <MatchDetail key={match.fixtureId} match={match} />
            ))}
          </div>

          <div className="history-compare-summary">
            <Target size={14} />
            <span>
              {comparable.length === 0
                ? "No selection in this entry has a decisive outcome on both sides, so nothing is being claimed about the comparison."
                : kept === comparable.length
                  ? `You kept MatchMetric's original recommendation in all ${comparable.length} comparable ${comparable.length === 1 ? "selection" : "selections"}.`
                  : `You chose differently from MatchMetric's recommendation in ${comparable.length - kept} of ${comparable.length} comparable selections.`}
            </span>
          </div>

          <div className="history-card-actions">
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

function MatchDetail({ match }: { match: HistoryMatch }) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const sameSelection =
    match.recommendation !== null && match.finalSelection.selection === match.recommendation.selection;
  const comparison = comparisonText(match);

  return (
    <section className="history-match">
      <header className="history-match-head">
        <div className="history-match-teams">
          <span className="history-team">
            <span className="history-team-badge" aria-hidden="true">
              {initials(match.home.name, match.home.short)}
            </span>
            {match.home.name}
          </span>
          <span className="history-mini-vs">vs</span>
          <span className="history-team">
            <span className="history-team-badge" aria-hidden="true">
              {initials(match.away.name, match.away.short)}
            </span>
            {match.away.name}
          </span>
        </div>
        <span className="history-match-score">
          {match.finalScore ? `${match.finalScore.home} – ${match.finalScore.away}` : "—"}
        </span>
      </header>

      <p className="history-match-sub">
        {match.competition}
        {match.kickoff ? ` · ${formatDateTime(match.kickoff)}` : ""}
        {match.settledAt ? ` · settled ${formatDate(match.settledAt)}` : ""}
      </p>

      <dl className="history-match-facts">
        <div>
          <dt>Market</dt>
          <dd>{match.marketLabel}</dd>
        </div>
        <div>
          <dt>Your selection</dt>
          <dd>{match.selection}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>
            <span className={`history-leg-pill ${match.outcome}`}>{LEG_LABEL[match.outcome]}</span>
          </dd>
        </div>
        <div>
          <dt>Odds at saving</dt>
          <dd>{match.finalSelection.odds !== null ? match.finalSelection.odds.toFixed(2) : "Not recorded"}</dd>
        </div>
        <div>
          <dt>Probability at saving</dt>
          <dd>
            {match.finalSelection.probability !== null
              ? `${Math.round(match.finalSelection.probability)}%`
              : "Not recorded"}
          </dd>
        </div>
      </dl>

      <div className="history-reco">
        <div className="history-reco-row">
          <span className="history-reco-label">MatchMetric original recommendation</span>
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
                {match.recommendation.generatedAt ? ` · recorded ${formatDate(match.recommendation.generatedAt)}` : ""}
              </small>
            </>
          ) : (
            <strong className="history-muted">No recommendation was recorded for this match.</strong>
          )}
        </div>
        <div className="history-reco-row">
          <span className="history-reco-label">Your final selection</span>
          <strong>
            {match.finalSelection.marketLabel || match.marketLabel} — {match.finalSelection.selection}
          </strong>
          {sameSelection ? <em className="history-same">Same Selection</em> : null}
        </div>
      </div>

      {comparison ? <p className="history-comparison">{comparison}</p> : null}

      {match.analysis ? (
        <div className="history-analysis">
          <button
            type="button"
            className="history-analysis-toggle"
            aria-expanded={analysisOpen}
            onClick={() => setAnalysisOpen((value) => !value)}
          >
            {analysisOpen ? "Hide Original Analysis" : "View Original Analysis"}
            <ChevronDown size={14} className={analysisOpen ? "open" : ""} />
          </button>

          {analysisOpen ? (
            <div className="history-analysis-body">
              <p className="history-analysis-caption">
                Preserved exactly as it was recorded before kickoff. Nothing here has been rewritten.
              </p>
              {match.analysis.homeForm ? (
                <div className="history-analysis-form">
                  <strong>{match.home.name}</strong>
                  <p>{match.analysis.homeForm}</p>
                </div>
              ) : null}
              {match.analysis.awayForm ? (
                <div className="history-analysis-form">
                  <strong>{match.away.name}</strong>
                  <p>{match.analysis.awayForm}</p>
                </div>
              ) : null}
              {match.analysis.keyInsights.length ? (
                <div className="history-analysis-block">
                  <span>Key insights</span>
                  <ul>
                    {match.analysis.keyInsights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {match.analysis.weakeningFactors.length ? (
                <div className="history-analysis-block">
                  <span>Weakening factors</span>
                  <ul>
                    {match.analysis.weakeningFactors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <dl className="history-analysis-facts">
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
        <p className="history-analysis-missing">
          <Info size={12} /> No historical analysis was preserved for this match.
        </p>
      )}
    </section>
  );
}

/** Honest, neutral wording — it never implies the member got it wrong. */
function comparisonText(match: HistoryMatch): string | null {
  if (!match.recorded) return null;
  const userDecisive = match.outcome === "won" || match.outcome === "lost";
  const engineDecisive = match.engineOutcome === "won" || match.engineOutcome === "lost";
  if (!userDecisive || !engineDecisive) return null;

  if (!match.overridden) {
    return `You kept MatchMetric's recommendation here; it settled ${match.outcome}.`;
  }
  if (match.outcome === "won" && match.engineOutcome === "lost") {
    return "Your pick won where MatchMetric's original recommendation would not have.";
  }
  if (match.outcome === "lost" && match.engineOutcome === "won") {
    return "MatchMetric's original recommendation would have won where your pick did not.";
  }
  if (match.outcome === "won") return "Both your pick and MatchMetric's recommendation won.";
  return "Neither your pick nor MatchMetric's recommendation won.";
}
