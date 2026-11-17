"use client";

import { Check, RefreshCw, Sparkles, X } from "lucide-react";
import { effectivePrediction } from "@/lib/slip-analysis";
import { ConfidenceBadge, DataQualityBadge, LoadingIndicator, OddsDisplay, ProbabilityIndicator, SourceBadge } from "@/components/shared/indicators";
import type { SlipEntry } from "@/types/slip";

/**
 * Manual and screenshot entries share this card.
 *
 * Both workflows ask the same thing of a match — remove it, analyse it, or read its picks — so
 * they share one control set rather than two near-identical ones. The source badge and, for
 * screenshot imports, the original placed selection are the only differences.
 */
export function SlipMatchCard({
  entry,
  busy,
  onAnalyse,
  onOpen,
  onRemove,
  onResetSelection,
}: {
  entry: SlipEntry;
  busy: boolean;
  onAnalyse: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onResetSelection: () => void;
}) {
  const recommendation = entry.matchMetricRecommendation;
  const replaced =
    Boolean(entry.userSelectedPrediction) &&
    Boolean(recommendation) &&
    (entry.userSelectedPrediction?.selection !== recommendation?.selection ||
      entry.userSelectedPrediction?.market !== recommendation?.marketLabel);
  const effective = effectivePrediction(entry);
  const kickoff = new Date(entry.kickoff);
  const kickoffLabel = Number.isNaN(kickoff.getTime())
    ? "Kickoff to be confirmed"
    : kickoff.toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <article className={`slip-card slip-card-${entry.status}`}>
      <div className="slip-card-head">
        <span className="slip-card-league">
          {entry.leagueFlag ? `${entry.leagueFlag} ` : ""}
          {entry.competition}
        </span>
        <span className="slip-card-time">{kickoffLabel}</span>
      </div>

      <button type="button" className="slip-card-teams" onClick={onOpen}>
        <span className="slip-card-team">{entry.homeTeam}</span>
        <span className="slip-card-vs">vs</span>
        <span className="slip-card-team slip-card-team-away">{entry.awayTeam}</span>
      </button>

      <div className="slip-card-badges">
        <SourceBadge source={entry.source} />
        <StatusChip entry={entry} />
        {entry.status === "analysed" && <DataQualityBadge quality={entry.dataQuality} />}
      </div>

      {entry.originalUserSelection && (
        <p className="slip-card-original">
          <span>Your placed selection</span>
          <strong>
            {entry.originalUserSelection.market} · {entry.originalUserSelection.selection}
          </strong>
        </p>
      )}

      <div className="slip-card-body">
        {busy || entry.status === "analysing" ? (
          <LoadingIndicator label="Analysing with the MatchMetric engine..." />
        ) : entry.status === "error" ? (
          <p className="slip-card-note slip-card-note-error">{entry.analysisNote}</p>
        ) : entry.analysisStatus === "no-value" || entry.analysisStatus === "insufficient" ? (
          <p className="slip-card-note">{entry.analysisNote}</p>
        ) : recommendation ? (
          <div className="slip-pick">
            <span className="slip-pick-tag">
              <Sparkles size={12} strokeWidth={2.4} /> MatchMetric best pick
            </span>
            <p className="slip-pick-selection">
              <strong>{recommendation.marketLabel}</strong> · {recommendation.selection}
            </p>
            <ProbabilityIndicator
              probability={recommendation.probability}
              impliedProbability={recommendation.impliedProbability}
            />
            <div className="slip-pick-meta">
              <OddsDisplay odds={recommendation.odds} />
              <ConfidenceBadge confidence={entry.confidence} />
            </div>
          </div>
        ) : (
          <p className="slip-card-note slip-card-note-idle">Awaiting analysis</p>
        )}
      </div>

      {replaced && effective && (
        <div className="slip-card-replaced">
          <span>
            <Check size={12} strokeWidth={2.6} /> Your selection: {effective.marketLabel} · {effective.selection}
          </span>
          <button type="button" onClick={onResetSelection}>
            <RefreshCw size={12} strokeWidth={2.2} /> Use MatchMetric&rsquo;s pick
          </button>
        </div>
      )}

      <div className="slip-card-actions">
        {entry.analysable ? (
          <button type="button" className="slip-ghost-btn" onClick={onAnalyse} disabled={busy}>
            {entry.status === "analysed" ? "Re-analyse" : "Analyse"}
          </button>
        ) : (
          <span className="slip-card-unavailable">Demonstration fixture</span>
        )}
        {recommendation && (
          <button type="button" className="slip-ghost-btn" onClick={onOpen}>
            View picks
          </button>
        )}
        <button
          type="button"
          className="slip-card-remove"
          onClick={onRemove}
          aria-label={`Remove ${entry.homeTeam} vs ${entry.awayTeam} from your slip`}
        >
          <X size={15} />
        </button>
      </div>
    </article>
  );
}

function StatusChip({ entry }: { entry: SlipEntry }) {
  if (entry.status === "analysing") return <span className="slip-status slip-status-busy">Analysing</span>;
  if (entry.status === "error") return <span className="slip-status slip-status-error">Needs attention</span>;
  if (entry.status === "analysed") {
    return (
      <span className={`slip-status slip-status-${entry.analysisStatus ?? "recommended"}`}>
        {entry.analysisStatus === "insufficient"
          ? "Insufficient data"
          : entry.analysisStatus === "no-value"
            ? "No value found"
            : "Analysis complete"}
      </span>
    );
  }
  return <span className="slip-status">Awaiting analysis</span>;
}

/** Automatic picks arrive already analysed, so they expose removal only. */
export function AutomaticMatchCard({
  entry,
  onRemove,
}: {
  entry: SlipEntry;
  onRemove: () => void;
}) {
  const pick = entry.matchMetricRecommendation;
  const kickoff = new Date(entry.kickoff);
  const kickoffLabel = Number.isNaN(kickoff.getTime())
    ? "Kickoff to be confirmed"
    : kickoff.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <article className="slip-card slip-card-analysed slip-card-auto">
      <div className="slip-card-head">
        <span className="slip-card-league">
          {entry.leagueFlag ? `${entry.leagueFlag} ` : ""}
          {entry.competition}
        </span>
        <span className="slip-card-time">{kickoffLabel}</span>
      </div>
      <div className="slip-card-teams slip-card-teams-static">
        <span className="slip-card-team">{entry.homeTeam}</span>
        <span className="slip-card-vs">vs</span>
        <span className="slip-card-team slip-card-team-away">{entry.awayTeam}</span>
      </div>
      <div className="slip-card-badges">
        <SourceBadge source="automatic" />
        <span className="slip-status slip-status-recommended">Ready to place</span>
        <DataQualityBadge quality={entry.dataQuality} />
      </div>
      {pick && (
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
            <ConfidenceBadge confidence={entry.confidence} />
          </div>
        </div>
      )}
      <div className="slip-card-actions">
        <button
          type="button"
          className="slip-card-remove"
          onClick={onRemove}
          aria-label={`Remove ${entry.homeTeam} vs ${entry.awayTeam} from your slip`}
        >
          <X size={15} />
        </button>
      </div>
    </article>
  );
}
