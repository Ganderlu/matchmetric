"use client";

import { useId } from "react";
import type { TrendPoint } from "@/lib/insights/types";

/**
 * "Performance Over Time", drawn as a responsive SVG.
 *
 * The chart is a view of the recorded history — one point per time bucket — and never
 * interpolates a value that was not observed. A flat or single-point series is still shown
 * honestly rather than padded out.
 */

export type TrendMetric = "winRate" | "settled" | "selections";

const WIDTH = 340;
const HEIGHT = 156;
const PAD = { left: 34, right: 12, top: 14, bottom: 24 };
const INNER_W = WIDTH - PAD.left - PAD.right;
const INNER_H = HEIGHT - PAD.top - PAD.bottom;

function valueOf(point: TrendPoint, metric: TrendMetric): number {
  if (metric === "winRate") return point.winRate;
  if (metric === "settled") return point.settled;
  return point.selections;
}

export function TrendChart({ points, metric }: { points: TrendPoint[]; metric: TrendMetric }) {
  const gradientId = useId();

  if (!points.length) {
    return (
      <div className="insights-chart-empty">
        No dated selections in this period yet, so there is no trend to draw.
      </div>
    );
  }

  const values = points.map((point) => valueOf(point, metric));
  const ceiling = metric === "winRate" ? 100 : Math.max(...values, 1);
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? INNER_W / 2 : (index / (points.length - 1)) * INNER_W);
  const y = (value: number) => PAD.top + INNER_H - (value / ceiling) * INNER_H;

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(valueOf(point, metric)).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PAD.top + INNER_H).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + INNER_H).toFixed(1)} Z`;

  const gridValues = [0, ceiling / 2, ceiling];
  const labelEvery = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div className="insights-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Performance over time">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridValues.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className="insights-chart-grid"
            />
            <text x={PAD.left - 6} y={y(value) + 3} className="insights-chart-axis" textAnchor="end">
              {metric === "winRate" ? `${Math.round(value)}%` : Math.round(value)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} className="insights-chart-line" />

        {points.map((point, index) => (
          <circle
            key={point.key}
            cx={x(index)}
            cy={y(valueOf(point, metric))}
            r={points.length === 1 ? 3.4 : 2.2}
            className="insights-chart-dot"
          />
        ))}

        {points.map((point, index) =>
          index % labelEvery === 0 || index === points.length - 1 ? (
            <text
              key={`label-${point.key}`}
              x={x(index)}
              y={HEIGHT - 8}
              className="insights-chart-axis"
              textAnchor="middle"
            >
              {point.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
