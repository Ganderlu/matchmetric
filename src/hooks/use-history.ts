"use client";

import { useEffect, useState } from "react";
import type { HistoryPayload, HistoryRangeKey } from "@/lib/history/types";

/**
 * Client bridge to the History service.
 *
 * The UI never assembles a record or grades a result: it sends the date window and the search
 * text, and the server returns already-graded entries. Window boundaries are resolved in the
 * member's own timezone so "Today" means their today.
 */

const DAY_MS = 86_400_000;

export interface HistoryQuery {
  range: HistoryRangeKey;
  /** `yyyy-mm-dd`, only read when the range is "custom". */
  from: string;
  to: string;
  search: string;
}

export const DEFAULT_HISTORY_QUERY: HistoryQuery = {
  range: "all",
  from: "",
  to: "",
  search: "",
};

function windowFor(range: HistoryRangeKey, from: string, to: string): { from: number | null; to: number | null } {
  if (range === "all") return { from: null, to: null };

  if (range === "custom") {
    const start = from ? Date.parse(`${from}T00:00:00`) : Number.NaN;
    const end = to ? Date.parse(`${to}T23:59:59.999`) : Number.NaN;
    return { from: Number.isFinite(start) ? start : null, to: Number.isFinite(end) ? end : null };
  }

  if (range === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { from: start.getTime(), to: end.getTime() };
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return { from: Date.now() - days * DAY_MS, to: Date.now() };
}

export function useHistory(query: HistoryQuery) {
  const [payload, setPayload] = useState<HistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { range, from, to, search } = query;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    // Typing is debounced; a range change is fetched immediately.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      const bounds = windowFor(range, from, to);
      if (bounds.from !== null) params.set("from", new Date(bounds.from).toISOString());
      if (bounds.to !== null) params.set("to", new Date(bounds.to).toISOString());
      if (search.trim()) params.set("q", search.trim());

      void fetch(`/api/history?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as (HistoryPayload & { error?: string }) | null;
          if (!response.ok || !data) throw new Error(data?.error ?? "History could not be loaded.");
          setPayload(data);
        })
        .catch((cause: unknown) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : "History could not be loaded.");
        })
        .finally(() => setLoading(false));
    }, search ? 300 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [range, from, to, search]);

  return { payload, loading, error };
}
