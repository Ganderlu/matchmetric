"use client";

import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared building blocks for the Insights dashboard.
 *
 * Everything here is presentational: the numbers arrive already calculated from the analytics
 * service so no component on this page ever derives a statistic of its own.
 */

/** A titled card. Insights is a long dashboard, so each block is its own card. */
export function InsightCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="insights-card">
      <header className="insights-card-head">
        <span className="insights-card-icon">
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <div className="insights-card-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="insights-card-action">{action}</div> : null}
      </header>
      <div className="insights-card-body">{children}</div>
    </section>
  );
}

/** One headline figure. `hint` always carries the sample size behind the value. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "positive" | "negative" | "muted";
}) {
  return (
    <div className="insights-stat">
      <span className="insights-stat-label">{label}</span>
      <strong className={`insights-stat-value ${tone ?? ""}`}>{value}</strong>
      <small className="insights-stat-hint">{hint}</small>
    </div>
  );
}

/** Marks a figure whose sample is too small to read as a pattern. */
export function SampleFlag({ reliable, settled }: { reliable: boolean; settled: number }) {
  if (reliable) return <span className="insights-flag ok">{settled} settled</span>;
  return <span className="insights-flag low">Low sample · {settled}</span>;
}

/** A percentage with its sample size beside it, so a rate is never shown bare. */
export function RateCell({ rate, settled, reliable }: { rate: number; settled: number; reliable: boolean }) {
  if (settled === 0) return <span className="insights-cell-muted">—</span>;
  return (
    <span className="insights-rate">
      <strong className={reliable ? "positive" : ""}>{rate.toFixed(1)}%</strong>
      <small>{settled} settled</small>
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="insights-empty">
      <span className="insights-empty-icon">
        <Icon size={24} strokeWidth={1.8} />
      </span>
      <strong>{title}</strong>
      <p>{message}</p>
      {action}
    </div>
  );
}

/** Supporting prose, used for the honesty notes each dataset carries. */
export function NoteList({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="insights-notes">
      {notes.map((note) => (
        <li key={note}>
          <Info size={12} />
          <span>{note}</span>
        </li>
      ))}
    </ul>
  );
}

export interface TableRow {
  id: string;
  cells: ReactNode[];
}

/** A scrollable data table. The first column is text, the rest are figures. */
export function InsightsTable({
  columns,
  rows,
  footnote,
}: {
  columns: string[];
  rows: TableRow[];
  footnote?: string;
}) {
  return (
    <div className="insights-table-wrap">
      <table className="insights-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.cells.map((cell, index) =>
                index === 0 ? (
                  <th key={columns[0]} scope="row" className="insights-table-lead">
                    {cell}
                  </th>
                ) : (
                  <td key={columns[index] ?? index}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {footnote ? <p className="insights-table-footnote">{footnote}</p> : null}
    </div>
  );
}
