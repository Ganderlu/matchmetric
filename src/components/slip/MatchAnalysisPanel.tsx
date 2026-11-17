"use client";

import { ArrowLeft, Check, RotateCcw, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { effectiveSelection } from "@/lib/slip-analysis";
import { ConfidenceBadge, DataQualityBadge, LoadingIndicator, OddsDisplay, ProbabilityIndicator } from "@/components/shared/indicators";
import type { SlipEntry, SlipPrediction } from "@/types/slip";

/**
 * The detailed prediction view for one fixture.
 *
 * Three separate parts, on purpose:
 *
 * - Best Pick is the engine's own recommendation.
 * - Highest Probability and Best Value are two distinct rankings of the remaining priced
 *   markets. The most likely selection is frequently not the best-value one, so they are never
 *   merged into a single list.
 *
 * Choosing an alternative writes `userSelectedPrediction` only. The engine's recommendation
 * stays on the entry, so it can always be shown again or restored.
 */
export function MatchAnalysisPanel({
  entry,
  busy,
  onBack,
  onAnalyse,
  onSelect,
}: {
  entry: SlipEntry;
  busy: boolean;
  onBack: () => void;
  onAnalyse: () => void;
  onSelect: (prediction: SlipPrediction | undefined) => void;
}) {
  const recommendation = entry.matchMetricRecommendation;
  const userSelection = effectiveSelection(entry);
  const replaced =
    Boolean(entry.userSelectedPrediction) &&
    Boolean(recommendation) &&
    (entry.userSelectedPrediction?.selection !== recommendation?.selection ||
      entry.userSelectedPrediction?.market !== recommendation?.marketLabel);

  return (
    <div className="slip-analysis">
      <div className="slip-analysis-head">
        <button type="button" className="slip-back-btn" onClick={onBack} aria-label="Back to your slip">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h3>
            {entry.homeTeam} <span>vs</span> {entry.awayTeam}
          </h3>
          <small>
            {entry.competition}
            {entry.generatedAt ? ` · analysed ${new Date(entry.generatedAt).toLocaleString()}` : ""}
          </small>
        </div>
      </div>

      {entry.originalUserSelection && (
        <div className={`slip-compare-note slip-compare-${entry.comparison?.status ?? "unverified"}`}>
          <strong>Your placed selection: {entry.originalUserSelection.market} · {entry.originalUserSelection.selection}</strong>
          <span>{entry.comparison?.note ?? "Compare it with MatchMetric's evaluation below."}</span>
        </div>
      )}

      {busy || entry.status === "analysing" ? (
        <div className="slip-analysis-state">
          <LoadingIndicator label="Analysing with the MatchMetric engine..." />
        </div>
      ) : !recommendation ? (
        <div className="slip-analysis-state">
          <p>{entry.analysisNote ?? "This match has not been analysed yet."}</p>
          {entry.analysable && (
            <button type="button" className="slip-analyse-btn" onClick={onAnalyse}>
              Analyse this match
            </button>
          )}
          {!entry.analysable && (
            <small>Demonstration fixtures are never analysed. MatchMetric only reports provider-backed results.</small>
          )}
        </div>
      ) : (
        <>
          <section className="slip-analysis-section">
            <h4>
              <Trophy size={14} strokeWidth={2.2} /> MatchMetric best pick
            </h4>
            <PredictionAlternative
              prediction={recommendation}
              confidence={entry.confidence}
              featured
              selected={!replaced}
              onSelect={() => onSelect(undefined)}
              actionLabel={replaced ? "Restore" : undefined}
            />
            <p className="slip-analysis-footnote">
              This is MatchMetric&rsquo;s current recommendation for this fixture.
              {replaced && " Your chosen selection is kept below it."}
            </p>
          </section>

          <section className="slip-analysis-section">
            <h4>
              <TrendingUp size={14} strokeWidth={2.2} /> Highest probability
            </h4>
            {entry.highestProbability.length ? (
              entry.highestProbability.map((prediction) => (
                <PredictionAlternative
                  key={`prob-${prediction.market}-${prediction.selection}`}
                  prediction={prediction}
                  confidence={entry.confidence}
                  selected={isSelected(prediction, userSelection)}
                  onSelect={() => onSelect(prediction)}
                />
              ))
            ) : (
              <p className="slip-analysis-footnote">No other priced selection qualified for this fixture.</p>
            )}
          </section>

          <section className="slip-analysis-section">
            <h4>
              <Sparkles size={14} strokeWidth={2.2} /> Best value
            </h4>
            {entry.bestValue.length ? (
              entry.bestValue.map((prediction) => (
                <PredictionAlternative
                  key={`value-${prediction.market}-${prediction.selection}`}
                  prediction={prediction}
                  confidence={entry.confidence}
                  selected={isSelected(prediction, userSelection)}
                  onSelect={() => onSelect(prediction)}
                />
              ))
            ) : (
              <p className="slip-analysis-footnote">No other priced selection qualified for this fixture.</p>
            )}
          </section>

          <div className="slip-analysis-meta">
            <DataQualityBadge quality={entry.dataQuality} />
            <ConfidenceBadge confidence={entry.confidence} />
            {entry.modelVersion && <span className="slip-model">Model {entry.modelVersion}</span>}
          </div>
          <p className="slip-analysis-footnote">
            Highest probability and best value are separate rankings: the most likely outcome is not automatically the
            best-value one. Selecting an alternative never removes MatchMetric&rsquo;s original recommendation.
          </p>
        </>
      )}
    </div>
  );
}

export function PredictionAlternative({
  prediction,
  confidence,
  selected,
  featured,
  onSelect,
  actionLabel,
}: {
  prediction: SlipPrediction;
  confidence?: SlipEntry["confidence"];
  selected?: boolean;
  featured?: boolean;
  onSelect: () => void;
  actionLabel?: string;
}) {
  return (
    <div className={`slip-alternative ${featured ? "slip-alternative-featured" : ""} ${selected ? "slip-alternative-selected" : ""}`}>
      <div className="slip-alternative-head">
        <div>
          <small>{prediction.marketLabel}</small>
          <strong>{prediction.selection}</strong>
        </div>
        <div className="slip-alternative-price">
          <OddsDisplay odds={prediction.odds} />
          {selected && (
            <span className="slip-selected-chip">
              <Check size={11} strokeWidth={3} /> Selected
            </span>
          )}
        </div>
      </div>
      <ProbabilityIndicator probability={prediction.probability} impliedProbability={prediction.impliedProbability} />
      <div className="slip-alternative-foot">
        {typeof prediction.expectedValue === "number" && (
          <span className="slip-ev">Est. value {(prediction.expectedValue * 100).toFixed(1)}%</span>
        )}
        <ConfidenceBadge confidence={confidence} />
        <button type="button" className="slip-ghost-btn slip-select-btn" onClick={onSelect}>
          {actionLabel ? (
            <>
              <RotateCcw size={12} strokeWidth={2.2} /> {actionLabel}
            </>
          ) : selected ? (
            "Keep this pick"
          ) : (
            "Use this pick"
          )}
        </button>
      </div>
    </div>
  );
}

function isSelected(
  prediction: SlipPrediction,
  selection: { market: string; selection: string } | undefined,
) {
  if (!selection) return false;
  return prediction.selection === selection.selection && prediction.marketLabel === selection.market;
}
