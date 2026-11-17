"use client";

import type { CalibrationBucket } from "@/lib/insights/types";

/** Bars are drawn on a 0-100% track, so a value outside that range is clamped rather than hidden. */
function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * "Prediction Calibration" — the probability the engine stated against what actually happened.
 *
 * Each bucket is a 0-100% track carrying two bars: the model's average stated probability and
 * the observed win rate for that bucket. A bucket with too few decisive predictions is drawn
 * faded and labelled rather than presented as a pattern.
 */
export function CalibrationChart({ buckets }: { buckets: CalibrationBucket[] }) {
  return (
    <div className="insights-calibration">
      <div className="insights-calibration-legend">
        <span className="insights-legend-item">
          <i className="insights-legend-swatch predicted" /> Predicted
        </span>
        <span className="insights-legend-item">
          <i className="insights-legend-swatch observed" /> Observed
        </span>
      </div>

      <ul className="insights-calibration-list">
        {buckets.map((bucket) => (
          <li key={bucket.key} className={`insights-calibration-row ${bucket.reliable ? "" : "unreliable"}`}>
            <div className="insights-calibration-head">
              <span className="insights-calibration-band">{bucket.label}</span>
              <span className="insights-calibration-count">
                {bucket.predictions} {bucket.predictions === 1 ? "prediction" : "predictions"}
                {bucket.reliable ? "" : " · insufficient"}
              </span>
            </div>
            <div className="insights-calibration-track">
              <span className="insights-calibration-line">
                <i
                  className="insights-calibration-bar predicted"
                  style={{ width: `${clamp(bucket.averageProbability)}%` }}
                />
              </span>
              <span className="insights-calibration-line">
                <i
                  className="insights-calibration-bar observed"
                  style={{ width: `${clamp(bucket.observedRate)}%` }}
                />
              </span>
            </div>
            <div className="insights-calibration-values">
              <span>
                predicted <strong>{bucket.averageProbability.toFixed(1)}%</strong>
              </span>
              <span>
                observed <strong>{bucket.observedRate.toFixed(1)}%</strong>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
