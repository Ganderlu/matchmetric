"use client";

import type { PredictionConfidence, PredictionDataQuality } from "@/lib/manual-predictions";
import type { SelectionSource } from "@/types/slip";

/** Small shared building blocks for the slip, analysis panel and comparison screens. */

export function ProbabilityIndicator({
  probability,
  impliedProbability,
  label,
}: {
  probability: number;
  impliedProbability?: number;
  label?: string;
}) {
  const width = Math.max(2, Math.min(100, probability));
  return (
    <div className="slip-probability">
      <div className="slip-probability-head">
        <span>{label ?? "Estimated probability"}</span>
        <strong>{probability.toFixed(1)}%</strong>
      </div>
      <div className="slip-probability-track" role="presentation">
        <span style={{ width: `${width}%` }} />
        {typeof impliedProbability === "number" && (
          <i
            aria-hidden="true"
            style={{ left: `${Math.max(2, Math.min(99, impliedProbability))}%` }}
          />
        )}
      </div>
      {typeof impliedProbability === "number" && (
        <small className="slip-probability-note">
          Market price implies {impliedProbability.toFixed(1)}%
        </small>
      )}
    </div>
  );
}

export function OddsDisplay({ odds }: { odds?: number }) {
  if (typeof odds !== "number") {
    return <span className="slip-odds slip-odds-empty">No price</span>;
  }
  return <span className="slip-odds">{odds.toFixed(2)}</span>;
}

export function ConfidenceBadge({ confidence }: { confidence?: PredictionConfidence }) {
  if (!confidence) return null;
  return <span className={`slip-confidence slip-confidence-${confidence.toLowerCase()}`}>{confidence} confidence</span>;
}

export function DataQualityBadge({ quality }: { quality?: PredictionDataQuality }) {
  if (!quality) return null;
  return <span className={`slip-quality slip-quality-${quality.toLowerCase()}`}>Data {quality.toLowerCase()}</span>;
}

const SOURCE_LABEL: Record<SelectionSource, string> = {
  manual: "Manual",
  automatic: "Auto pick",
  screenshot: "Screenshot",
};

export function SourceBadge({ source }: { source: SelectionSource }) {
  return <span className={`slip-source slip-source-${source}`}>{SOURCE_LABEL[source]}</span>;
}

export function LoadingIndicator({ label }: { label: string }) {
  return (
    <span className="slip-loading" role="status">
      <span className="spinner" />
      {label}
    </span>
  );
}
