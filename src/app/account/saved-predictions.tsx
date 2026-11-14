"use client";

import Link from "next/link";
import { ArrowRight, BookMarked, RefreshCw, Target } from "lucide-react";
import { useEffect, useState } from "react";
import type { SavedManualPrediction } from "@/lib/manual-predictions";

export function SavedPredictions() {
  const [predictions, setPredictions] = useState<SavedManualPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/predictions/saved", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { predictions?: SavedManualPrediction[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Saved predictions could not be loaded.");
        setPredictions(payload.predictions ?? []);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Saved predictions could not be loaded.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return (
    <section className="saved-predictions">
      <div className="side-card-heading"><h2><BookMarked size={15} />Saved Picks</h2><span>{predictions.length}</span></div>
      {loading ? (
        <div className="saved-prediction-state"><span className="spinner" /> Loading your private predictions...</div>
      ) : error ? (
        <div className="notice error-notice">{error}</div>
      ) : predictions.length ? (
        <div className="saved-prediction-list">
          {predictions.map((prediction) => (
            <article className="saved-prediction-card" key={prediction.id}>
              <div className="saved-prediction-head">
                <span><Target size={14} />{prediction.results.length} analyzed {prediction.results.length === 1 ? "match" : "matches"}</span>
                <small>{prediction.createdAt ? new Date(prediction.createdAt).toLocaleString() : "Saved"}</small>
              </div>
              <div className="saved-prediction-picks">
                {prediction.results.map((result) => (
                  <div className="saved-prediction-pick" key={result.fixtureId}>
                    <span>{result.homeTeam.name} vs {result.awayTeam.name}</span>
                    <strong>{result.recommendedSelection ?? (result.analysisStatus === "insufficient" ? "Insufficient data" : "No positive value")}</strong>
                    {result.estimatedProbability !== null && <small>{result.estimatedProbability.toFixed(1)}% · {result.marketLabel}</small>}
                  </div>
                ))}
              </div>
              <small className="saved-model-version">Model {prediction.modelVersion}</small>
            </article>
          ))}
        </div>
      ) : (
        <div className="saved-prediction-state">
          <BookMarked size={22} />
          <strong>No saved manual analysis yet</strong>
          <span>Your private saved picks will appear here.</span>
          <Link className="primary-button" href="/manual-analysis">Start a manual analysis <ArrowRight size={13} /></Link>
        </div>
      )}
      <button type="button" className="outline-button saved-refresh" onClick={() => window.location.reload()}><RefreshCw size={13} />Refresh saved picks</button>
    </section>
  );
}
