import type { FixtureFeedView, LeagueListView, MatchCentreView } from "@/lib/football/views";

/**
 * Browser-side access to the football API routes.
 *
 * There is no provider credential here by design: every call goes to a MatchMetric route
 * which owns the provider key and the cache. Errors carry the server's message so the UI
 * can show something specific instead of a generic failure.
 */
export interface FixtureFeedParams {
  /** Inclusive UTC date, YYYY-MM-DD. */
  from: string;
  /** Inclusive UTC date, YYYY-MM-DD. */
  to: string;
  leagueIds?: string[];
  statuses?: string[];
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
}

export async function fetchFixtureFeed(params: FixtureFeedParams): Promise<FixtureFeedView> {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.leagueIds?.length) search.set("leagues", params.leagueIds.join(","));
  if (params.statuses?.length) search.set("status", params.statuses.join(","));
  if (params.page) search.set("page", String(params.page));
  if (params.perPage) search.set("perPage", String(params.perPage));

  const payload = await getJson<FixtureFeedView>(`/api/football/fixtures?${search.toString()}`, params.signal);
  return payload;
}

export async function fetchLeagues(signal?: AbortSignal): Promise<LeagueListView> {
  return getJson<LeagueListView>("/api/football/leagues", signal);
}

export async function fetchMatchCentre(
  fixtureId: string,
  signal?: AbortSignal,
): Promise<MatchCentreView> {
  return getJson<MatchCentreView>(`/api/football/match/${encodeURIComponent(fixtureId)}`, signal);
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `The request failed with status ${response.status}.`);
  }
  if (!payload) throw new Error("The server returned an unexpected response.");
  return payload;
}
