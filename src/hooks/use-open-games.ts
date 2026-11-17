"use client";

import { useEffect, useState } from "react";
import type { OpenGamesPayload } from "@/lib/open-games/types";

/**
 * Client bridge to the Open Games service.
 *
 * The UI never assembles an entry or grades a selection: it sends the search text and the server
 * returns already-graded entries. A quiet poll keeps the live picture fresh — it re-reads the same
 * route and swaps the payload in without showing the loading state again, so a score that moves
 * mid-match updates on its own. The poll never touches the saved prediction, which is part of the
 * payload and only ever changes when the server re-reads it from storage.
 */

/** Live data moves minute to minute; re-read on the same cadence the feed caches at. */
const REFRESH_MS = 45_000;

export function useOpenGames(search: string) {
  const [payload, setPayload] = useState<OpenGamesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setLoading(true);
    setError("");

    const load = async (silent: boolean) => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());

        const response = await fetch(`/api/open-games?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as (OpenGamesPayload & { error?: string }) | null;
        if (!active) return;
        if (!response.ok || !data) throw new Error(data?.error ?? "Open Games could not be loaded.");

        setPayload(data);
        setError("");
      } catch (cause) {
        if (!active) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        // A failed background refresh must not replace a list the member is already reading.
        if (!silent) setError(cause instanceof Error ? cause.message : "Open Games could not be loaded.");
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    // Typing is debounced; the first load is immediate.
    const timer = window.setTimeout(() => void load(false), search ? 300 : 0);
    const poll = window.setInterval(() => void load(true), REFRESH_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [search]);

  return { payload, loading, error };
}
