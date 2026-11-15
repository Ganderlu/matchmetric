"use client";

import { Activity, BarChart3, RefreshCw, Target, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { AccuracySummary, MarketAccuracy, SettledPrediction } from "@/lib/prediction-tracking";

const OUTCOME_LABEL: Record<SettledPrediction["outcome"], string> = {
  won: "Won",
  lost: "Lost",
  push: "Push",
  void: "Void",
};

export function ModelAccuracy() {
  const [summary, setSummary] = useState<AccuracySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/predictions/accuracy", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { summary?: AccuracySummary; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Model accuracy could not be loaded.");
        setSummary(payload.summary ?? null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Model accuracy could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <section className="model-accuracy">
      <div className="side-card-heading">
        <h2><BarChart3 size={15} />Model Accuracy</h2>
        {summary && <span>{summary.settled} graded</span>}
      </div>

      {loading ? (
        <div className="saved-prediction-state"><span className="spinner" /> Loading the graded ledger...</div>
      ) : error ? (
        <div className="notice error-notice">{error}</div>
      ) : !summary || !summary.configured ? (
        <div className="saved-prediction-state">
          <Activity size={22} />
          <strong>Accuracy tracking is not available</strong>
          <span>{summary?.notice ?? "Graded predictions need a configured server store."}</span>
        </div>
      ) : summary.settled === 0 && summary.pending === 0 ? (
        <div className="saved-prediction-state">
          <Target size={22} />
          <strong>No graded picks yet</strong>
          <span>Save a value-qualified recommendation and its result appears here after full time.</span>
        </div>
      ) : (
        <>
          <div className="accuracy-metrics">
            <Metric label="Hit rate" value={summary.hitRate > 0 || summary.won > 0 ? `${summary.hitRate.toFixed(1)}%` : "—"} hint={`${summary.won}W · ${summary.lost}L${summary.push ? ` · ${summary.push}P` : ""}`} />
            <Metric label="Return on stake" value={`${summary.roi >= 0 ? "+" : ""}${summary.roi.toFixed(1)}%`} tone={summary.roi >= 0 ? "positive" : "negative"} hint={`avg odds ${summary.averageOdds.toFixed(2)}`} />
            <Metric label="Awaiting result" value={String(summary.pending)} hint={summary.voided ? `${summary.voided} void` : "graded at full time"} />
          </div>

          {summary.byMarket.length > 0 && (
            <div className="accuracy-table">
              <div className="accuracy-table-head"><span>Market</span><span>W/L</span><span>Hit</span><span>ROI</span></div>
              {summary.byMarket.map((market: MarketAccuracy) => (
                <div className="accuracy-table-row" key={market.market}>
                  <span>{market.marketLabel}</span>
                  <span>{market.won}/{market.lost}</span>
                  <span>{market.hitRate.toFixed(1)}%</span>
                  <span className={market.roi >= 0 ? "positive" : "negative"}>{market.roi >= 0 ? "+" : ""}{market.roi.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}

          {summary.recent.length > 0 && (
            <div className="saved-prediction-list">
              {summary.recent.map((entry) => (
                <article className="saved-prediction-card" key={entry.fixtureId}>
                  <div className="saved-prediction-head">
                    <span><TrendingUp size={14} />{entry.homeTeam} vs {entry.awayTeam}</span>
                    <span className={`accuracy-outcome ${entry.outcome}`}>{OUTCOME_LABEL[entry.outcome]}</span>
                  </div>
                  <div className="saved-prediction-picks">
                    <div className="saved-prediction-pick">
                      <span>{entry.marketLabel} · {entry.selection}</span>
                      <strong>{entry.homeScore ?? "-"}–{entry.awayScore ?? "-"} · {entry.odds.toFixed(2)}</strong>
                      <small>{entry.settledAt ? `Graded ${new Date(entry.settledAt).toLocaleDateString()}` : "Graded"}</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <button type="button" className="outline-button saved-refresh" onClick={() => window.location.reload()}>
        <RefreshCw size={13} />Re-grade and refresh
      </button>
    </section>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "positive" | "negative" }) {
  return (
    <div className="accuracy-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}
