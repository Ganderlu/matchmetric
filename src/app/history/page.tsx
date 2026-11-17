"use client";

import { Compass, History as HistoryIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HistoryControls } from "@/components/history/HistoryControls";
import { HistoryEntryCard } from "@/components/history/HistoryEntryCard";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { ExpandedSlip } from "@/components/slip/ExpandedSlip";
import { FloatingSlipButton } from "@/components/slip/FloatingSlipButton";
import { DEFAULT_HISTORY_QUERY, useHistory } from "@/hooks/use-history";
import type { HistoryEntry, HistorySortKey, HistoryStatusFilter } from "@/lib/history/types";

/**
 * History.
 *
 * Completed records only: an entry lands here once every selection inside it has resolved. Anything
 * still open or live belongs to Open Games and is never duplicated here. The records are assembled
 * and graded by the service behind `/api/history`; this page only orders, filters and presents them.
 *
 * The performance summary counts entries, not matches: an entry wins only when every required
 * selection won, so its rate is a different statistic from per-selection accuracy. Voided entries
 * are reported separately and never counted as wins or losses, and the whole block stays entirely
 * separate from the engine's own model performance on Insights.
 */

function sortEntries(entries: HistoryEntry[], sort: HistorySortKey): HistoryEntry[] {
  const copy = [...entries];
  switch (sort) {
    case "oldest":
      return copy.sort((left, right) => left.dateMs - right.dateMs);
    case "most-matches":
      return copy.sort((left, right) => right.matchCount - left.matchCount || right.dateMs - left.dateMs);
    case "won-first":
      return copy.sort((left, right) => rank(left, "won") - rank(right, "won") || right.dateMs - left.dateMs);
    case "lost-first":
      return copy.sort((left, right) => rank(left, "lost") - rank(right, "lost") || right.dateMs - left.dateMs);
    case "recent":
    default:
      return copy.sort((left, right) => right.dateMs - left.dateMs);
  }
}

/** Puts entries matching `first` at the top, leaving the rest in their recent-first order. */
function rank(entry: HistoryEntry, first: "won" | "lost"): number {
  return entry.status === first ? 0 : 1;
}

export default function HistoryPage() {
  const [query, setQuery] = useState(DEFAULT_HISTORY_QUERY);
  const [status, setStatus] = useState<HistoryStatusFilter>("all");
  const [sort, setSort] = useState<HistorySortKey>("recent");
  const { payload, loading, error } = useHistory(query);

  const all = payload?.entries ?? [];
  const visible = sortEntries(
    status === "all" ? all : all.filter((entry) => entry.status === status),
    sort,
  );

  return (
    <div className="mm-app-layout">
      <div className="mm-main-wrap">
        <MobileHeader />

        <main className="mm-main">
          <div className="history-page">
            <header className="history-head">
              <p className="history-eyebrow">Records</p>
              <h1>History</h1>
              <p>Your completed prediction records</p>
            </header>

            {loading ? (
              <div className="history-loading">
                <div className="history-summary">
                  {[0, 1, 2, 3].map((index) => (
                    <div className="skeleton" key={index} style={{ height: 74, borderRadius: 14 }} />
                  ))}
                </div>
                <div className="skeleton" style={{ height: 82, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 168, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 168, borderRadius: 16 }} />
              </div>
            ) : error ? (
              <div className="notice error-notice" role="status">
                {error}
              </div>
            ) : payload ? (
              payload.configured ? (
                <>
                  <section className="history-summary" aria-label="Performance summary">
                    <div className="history-stat">
                      <span className="history-stat-label">Total Settled Entries</span>
                      <strong className="history-stat-value">{payload.summary.settledEntries}</strong>
                      <span className="history-stat-hint">Entries with a decided result</span>
                    </div>
                    <div className="history-stat">
                      <span className="history-stat-label">Won Entries</span>
                      <strong className="history-stat-value positive">{payload.summary.won}</strong>
                      <span className="history-stat-hint">Every required selection won</span>
                    </div>
                    <div className="history-stat">
                      <span className="history-stat-label">Lost Entries</span>
                      <strong className="history-stat-value negative">{payload.summary.lost}</strong>
                      <span className="history-stat-hint">At least one selection was lost</span>
                    </div>
                    <div className="history-stat">
                      <span className="history-stat-label">Win Rate</span>
                      <strong className="history-stat-value">
                        {payload.summary.settledEntries > 0 ? `${payload.summary.winRate.toFixed(1)}%` : "—"}
                      </strong>
                      <span className="history-stat-hint">Won ÷ settled entries</span>
                    </div>
                  </section>

                  <p className="history-summary-note">
                    {payload.summary.voided > 0
                      ? `${payload.summary.voided} voided ${payload.summary.voided === 1 ? "entry is" : "entries are"} excluded from wins, losses and the win rate. `
                      : ""}
                    Match-level record kept separately: {payload.summary.matchesWon} of {payload.summary.matchesSettled} settled
                    {payload.summary.matchesSettled === 1 ? " selection" : " selections"} won.
                  </p>

                  <HistoryControls
                    status={status}
                    onStatus={setStatus}
                    sort={sort}
                    onSort={setSort}
                    query={query}
                    onChange={setQuery}
                    counts={payload.counts}
                  />

                  {all.length === 0 ? (
                    <div className="history-empty">
                      <span className="history-empty-icon" aria-hidden="true">
                        <HistoryIcon size={26} strokeWidth={1.8} />
                      </span>
                      <strong>Your History Starts Here</strong>
                      <p>
                        Once your saved predictions are completed, you&rsquo;ll find their results and performance records
                        here.
                      </p>
                      <Link className="primary-button" href="/">
                        <Compass size={14} /> Explore Matches
                      </Link>
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="history-empty">
                      <span className="history-empty-icon" aria-hidden="true">
                        <HistoryIcon size={26} strokeWidth={1.8} />
                      </span>
                      <strong>No {status} entries in this view</strong>
                      <p>
                        No completed entry matches this filter and date range. Choose &ldquo;All&rdquo; or widen the date
                        range to see more of your record.
                      </p>
                    </div>
                  ) : (
                    <div className="history-list">
                      {visible.map((entry) => (
                        <HistoryEntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}

                  <p className="history-scope-note">
                    <strong>Scope.</strong> History holds completed records only; anything still open or live lives in{" "}
                    <Link href="/open-games">Open Games</Link>. Your record is reported on its own and is never combined
                    with the MatchMetric engine&rsquo;s model performance, which is tracked separately on{" "}
                    <Link href="/insights">Insights</Link>. Saved records are never overwritten, and the odds,
                    probabilities and recommendations shown are exactly as they were recorded at the time.
                  </p>
                </>
              ) : (
                <div className="notice error-notice" role="status">
                  {payload.notice ?? "History is not configured on the server."}
                </div>
              )
            ) : null}
          </div>
        </main>
      </div>

      <FloatingSlipButton />
      <ExpandedSlip />
      <BottomNavigation />
    </div>
  );
}
