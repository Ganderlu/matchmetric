"use client";

import { ArrowLeft, Check, Lightbulb, Sparkles, TriangleAlert, X, XCircle } from "lucide-react";
import { OddsDisplay, ProbabilityIndicator } from "@/components/shared/indicators";
import type { ScreenshotComparisonRow } from "@/types/slip";

/**
 * Replay Game comparison.
 *
 * The user's placed selections and MatchMetric's suggested evaluations are shown as two separate
 * columns per fixture. A green state means the comparison agrees; a red state means the engine
 * found a different alternative — which is labelled a suggested change, never a guaranteed
 * mistake. Converting is entirely the user's decision.
 */
export function ScreenshotComparison({
  rows,
  loading,
  converting,
  onConvert,
  onCancel,
  onRemove,
}: {
  rows: ScreenshotComparisonRow[];
  loading: boolean;
  converting: boolean;
  onConvert: () => void;
  onCancel: () => void;
  onRemove: (id: string) => void;
}) {
  const matches = rows.filter((row) => row.status === "match").length;
  const changes = rows.filter((row) => row.status === "change").length;
  const unverified = rows.filter((row) => row.status === "unverified").length;

  return (
    <div className="screenshot-compare">
      <div className="screenshot-verify-head">
        <button type="button" className="slip-back-btn" onClick={onCancel} aria-label="Back to verification">
          <ArrowLeft size={16} />
        </button>
        <div>
          <span className="slip-eyebrow">Replay Game</span>
          <h3>Your slip vs MatchMetric</h3>
          <small>
            {matches} match · {changes} suggested {changes === 1 ? "change" : "changes"}
            {unverified ? ` · ${unverified} unverified` : ""}
          </small>
        </div>
      </div>

      {loading ? (
        <div className="slip-analysis-state">
          <span className="slip-loading" role="status">
            <span className="spinner" />
            Comparing your selections with the MatchMetric engine...
          </span>
        </div>
      ) : (
        <div className="screenshot-compare-list">
          {rows.map((row) => (
            <ComparisonMatchCard key={row.id} row={row} onRemove={() => onRemove(row.id)} />
          ))}
          {!rows.length && <p className="slip-section-note">Nothing left to compare.</p>}
        </div>
      )}

      <div className="screenshot-verify-actions">
        <button
          type="button"
          className="slip-analyse-all"
          onClick={onConvert}
          disabled={converting || loading || !rows.length}
        >
          {converting ? (
            <>
              <span className="spinner" /> Converting...
            </>
          ) : (
            <>
              <Sparkles size={16} strokeWidth={2.4} /> Convert to MatchMetric Picks
            </>
          )}
        </button>
        <button type="button" className="slip-replay-btn" onClick={onCancel} disabled={converting}>
          <XCircle size={15} strokeWidth={2.2} /> Cancel
        </button>
        <p className="slip-section-note">
          Converting replaces the selections marked as suggested changes with MatchMetric&rsquo;s picks. Your original
          selections stay recorded on each entry. Cancel keeps your original selections untouched.
        </p>
      </div>
    </div>
  );
}

function ComparisonMatchCard({
  row,
  onRemove,
}: {
  row: ScreenshotComparisonRow;
  onRemove: () => void;
}) {
  const match = row.status === "match";
  const unverified = row.status === "unverified";

  return (
    <article className={`compare-card compare-card-${row.status}`}>
      <div className="compare-card-head">
        <div>
          <strong>
            {row.homeTeam} <span>vs</span> {row.awayTeam}
          </strong>
          <small>{row.competition}</small>
        </div>
        <div className="compare-card-head-right">
          <span className={`compare-status compare-status-${row.status}`}>
            {match ? (
              <>
                <Check size={12} strokeWidth={3} /> Matches MatchMetric
              </>
            ) : unverified ? (
              <>
                <TriangleAlert size={12} strokeWidth={2.6} /> Unverified
              </>
            ) : (
              <>
                <Lightbulb size={12} strokeWidth={2.4} /> Suggested Change
              </>
            )}
          </span>
          <button
            type="button"
            className="slip-card-remove"
            onClick={onRemove}
            aria-label={`Remove ${row.homeTeam} vs ${row.awayTeam} from the comparison`}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="compare-columns">
        <div className="compare-column">
          <span className="compare-column-label">Your placed selection</span>
          <strong>{row.userSelection.market}</strong>
          <p>{row.userSelection.selection}</p>
        </div>
        <div className="compare-column compare-column-suggested">
          <span className="compare-column-label">MatchMetric suggests</span>
          {row.recommendation ? (
            <>
              <strong>{row.recommendation.marketLabel}</strong>
              <p>{row.recommendation.selection}</p>
              <ProbabilityIndicator
                probability={row.recommendation.probability}
                impliedProbability={row.recommendation.impliedProbability}
              />
              <OddsDisplay odds={row.recommendation.odds} />
            </>
          ) : (
            <p className="compare-column-empty">No priced MatchMetric alternative for this fixture.</p>
          )}
        </div>
      </div>

      <p className="compare-note">{row.note}</p>
    </article>
  );
}
