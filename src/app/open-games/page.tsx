"use client";

import { Compass, Ticket } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNavigation } from "@/components/mobile/BottomNavigation";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { OpenGamesControls } from "@/components/open-games/OpenGamesControls";
import { OpenGamesEntryCard } from "@/components/open-games/OpenGamesEntryCard";
import { ExpandedSlip } from "@/components/slip/ExpandedSlip";
import { FloatingSlipButton } from "@/components/slip/FloatingSlipButton";
import { useOpenGames } from "@/hooks/use-open-games";
import type { OpenGamesEntry, OpenGamesSortKey, OpenGamesStatusFilter } from "@/lib/open-games/types";

/**
 * Open Games.
 *
 * Every prediction entry a member has saved from the MatchMetric Slip, whatever its state: still
 * to kick off, in play, or already decided. The entries are assembled and graded by the service
 * behind `/api/open-games`; this page only orders, filters and presents them, and refreshes
 * quietly so a live score moves on its own.
 *
 * This is a prediction-tracking screen, not a betting one: there is no stake, no cash-out and no
 * potential return, and the odds and probabilities on a card are the ones recorded when the entry
 * was saved — the live score is shown beside the prediction and never rewrites it.
 */

function sortEntries(entries: OpenGamesEntry[], sort: OpenGamesSortKey): OpenGamesEntry[] {
  const copy = [...entries];
  switch (sort) {
    case "oldest":
      return copy.sort((left, right) => left.dateMs - right.dateMs);
    case "kickoff":
      return copy.sort(
        (left, right) =>
          kickoffRank(left.pendingKickoffMs) - kickoffRank(right.pendingKickoffMs) || right.dateMs - left.dateMs,
      );
    case "settled":
      return copy.sort(
        (left, right) =>
          settledMs(right.settledAt) - settledMs(left.settledAt) || right.dateMs - left.dateMs,
      );
    case "recent":
    default:
      return copy.sort((left, right) => right.dateMs - left.dateMs);
  }
}

/** Entries with a kickoff still to come come first, soonest first; the rest follow. */
function kickoffRank(pendingKickoffMs: number): number {
  return pendingKickoffMs || Number.MAX_SAFE_INTEGER;
}

function settledMs(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0;
}

export default function OpenGamesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OpenGamesStatusFilter>("all");
  const [statusTouched, setStatusTouched] = useState(false);
  const [sort, setSort] = useState<OpenGamesSortKey>("recent");
  const { payload, loading, error } = useOpenGames(search);

  // A member who has pending predictions lands on "Open"; anyone else starts on "All".
  useEffect(() => {
    if (statusTouched || !payload) return;
    if (payload.counts.open > 0) setStatus("open");
  }, [payload, statusTouched]);

  const all = payload?.entries ?? [];
  const visible = sortEntries(
    status === "all" ? all : all.filter((entry) => entry.status === status),
    sort,
  );

  const chooseStatus = (next: OpenGamesStatusFilter) => {
    setStatusTouched(true);
    setStatus(next);
  };

  return (
    <div className="mm-app-layout">
      <div className="mm-main-wrap">
        <MobileHeader />

        <main className="mm-main">
          <div className="og-page">
            <header className="og-head">
              <p className="og-eyebrow">Predictions</p>
              <h1>Open Games</h1>
              <p>Track your saved predictions</p>
            </header>

            {loading ? (
              <div className="og-loading">
                <div className="og-summary">
                  {[0, 1, 2].map((index) => (
                    <div className="skeleton" key={index} style={{ height: 74, borderRadius: 14 }} />
                  ))}
                </div>
                <div className="skeleton" style={{ height: 86, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 176, borderRadius: 16 }} />
                <div className="skeleton" style={{ height: 176, borderRadius: 16 }} />
              </div>
            ) : error ? (
              <div className="notice error-notice" role="status">
                {error}
              </div>
            ) : payload ? (
              payload.configured ? (
                <>
                  <section className="og-summary" aria-label="Prediction summary">
                    <div className="og-stat">
                      <span className="og-stat-label">Total Open Predictions</span>
                      <strong className="og-stat-value">{payload.summary.totalEntries}</strong>
                      <span className="og-stat-hint">Every entry you have saved</span>
                    </div>
                    <div className="og-stat">
                      <span className="og-stat-label">Live Matches</span>
                      <strong className="og-stat-value live">{payload.summary.liveMatches}</strong>
                      <span className="og-stat-hint">Matches in play right now</span>
                    </div>
                    <div className="og-stat">
                      <span className="og-stat-label">Completed Predictions</span>
                      <strong className="og-stat-value">{payload.summary.completedEntries}</strong>
                      <span className="og-stat-hint">Entries with a decided result</span>
                    </div>
                  </section>

                  <p className="og-summary-note">
                    {payload.summary.upcomingMatches} upcoming · {payload.summary.liveMatches} in play ·{" "}
                    {payload.summary.completedMatches} completed of {payload.summary.totalMatches} saved{" "}
                    {payload.summary.totalMatches === 1 ? "match" : "matches"}
                    {payload.summary.completedEntries > 0
                      ? ` · ${payload.summary.won} won, ${payload.summary.lost} lost${
                          payload.summary.voided > 0 ? `, ${payload.summary.voided} voided` : ""
                        } (${payload.summary.winRate.toFixed(1)}% of decided entries)`
                      : ""}
                    . Live state captured {new Date(payload.generatedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>

                  <OpenGamesControls
                    status={status}
                    onStatus={chooseStatus}
                    sort={sort}
                    onSort={setSort}
                    search={search}
                    onSearch={setSearch}
                    counts={payload.counts}
                  />

                  {all.length === 0 ? (
                    <div className="og-empty">
                      <span className="og-empty-icon" aria-hidden="true">
                        <Ticket size={26} strokeWidth={1.8} />
                      </span>
                      <strong>No Open Games Yet</strong>
                      <p>
                        Your saved predictions will appear here once you add games from your MatchMetric Slip.
                      </p>
                      <Link className="primary-button" href="/">
                        <Compass size={14} /> Explore Matches
                      </Link>
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="og-empty">
                      <span className="og-empty-icon" aria-hidden="true">
                        <Ticket size={26} strokeWidth={1.8} />
                      </span>
                      <strong>Nothing matches this view</strong>
                      <p>
                        {search.trim()
                          ? "No saved entry matches that search. Try a team, competition or prediction reference."
                          : `You have no ${status} entries right now. Choose "All" to see every entry you have saved.`}
                      </p>
                    </div>
                  ) : (
                    <div className="og-list">
                      {visible.map((entry) => (
                        <OpenGamesEntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}

                  <p className="og-scope-note">
                    <strong>Scope.</strong> Open Games holds every prediction entry you have saved from the Slip.
                    Completed records are also archived in <Link href="/history">History</Link>, and the MatchMetric
                    engine&rsquo;s own model performance is tracked separately on <Link href="/insights">Insights</Link>.
                    The odds and probabilities shown are exactly as they were recorded when you saved, and a live score
                    never rewrites a saved prediction. There is no stake and no payout here — saving a prediction only
                    records it.
                  </p>
                </>
              ) : (
                <div className="notice error-notice" role="status">
                  {payload.notice ?? "Open Games is not configured on the server."}
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
