"use client";

import { useEffect, useState } from "react";
import type { InsightsPayload, InsightsRangeKey } from "@/lib/insights/types";
import type { SelectionSource } from "@/types/slip";

/**
 * Client bridge to the Insights analytics service.
 *
 * The UI never aggregates anything itself: it sends the window and the filters, and the
 * server returns already-calculated statistics for both datasets. Window boundaries are
 * resolved in the member's own timezone so "Today" means their today.
 */

const DAY_MS = 86_400_000;

export interface InsightsQuery {
  range: InsightsRangeKey;
  /** `yyyy-mm-dd`, only read when the range is "custom". */
  from: string;
  to: string;
  competition: string;
  market: string;
  source: SelectionSource | "";
}

export const DEFAULT_INSIGHTS_QUERY: InsightsQuery = {
  range: "all",
  from: "",
  to: "",
  competition: "",
  market: "",
  source: "",
};

function windowFor(range: InsightsRangeKey, from: string, to: string): { from: number | null; to: number | null } {
  if (range === "all") return { from: null, to: null };

  if (range === "custom") {
    const start = from ? Date.parse(`${from}T00:00:00`) : Number.NaN;
    const end = to ? Date.parse(`${to}T23:59:59.999`) : Number.NaN;
    return {
      from: Number.isFinite(start) ? start : null,
      to: Number.isFinite(end) ? end : null,
    };
  }

  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { from: start.getTime(), to: end.getTime() };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "3m" ? 90 : 182;
  const now = Date.now();
  return { from: now - days * DAY_MS, to: now };
}

export function useInsights(query: InsightsQuery) {
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { range, from, to, competition, market, source } = query;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ range, tz: String(new Date().getTimezoneOffset()) });
    const bounds = windowFor(range, from, to);
    if (bounds.from !== null) params.set("from", new Date(bounds.from).toISOString());
    if (bounds.to !== null) params.set("to", new Date(bounds.to).toISOString());
    if (competition) params.set("competition", competition);
    if (market) params.set("market", market);
    if (source) params.set("source", source);

    void fetch(`/api/insights?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as (InsightsPayload & { error?: string }) | null;
        if (!response.ok || !data) throw new Error(data?.error ?? "Insights could not be loaded.");
        setPayload(data);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Insights could not be loaded.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [range, from, to, competition, market, source]);

  return { payload, loading, error };
}
