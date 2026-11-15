import "server-only";

import type { DataSource, Fixture, FixtureQuery, ProviderName } from "./types";
import { readFixtures, readMatchCentre, writeFixtures, writeMatchCentre } from "./cache";
import { createDemoProvider, demoPreview } from "./providers/demo";
import { getProvider, resolveProviderName } from "./providers";
import type { FootballProvider } from "./providers/types";
import {
  marketLabel,
  toFixtureView,
  toMatchDetailView,
  type FixtureFeedView,
  type FixtureView,
  type LeagueView,
  type MatchDetailView,
} from "./view-model";

/**
 * The server-side façade for football data.
 *
 * The API routes call these functions and nothing else, so the provider/cache policy lives
 * in one place:
 *
 * 1. A configured provider is used, and its normalized output is cached in Firestore.
 * 2. A fresh cache entry is served without touching the provider.
 * 3. When the provider fails, the last cached window is served with an explicit notice.
 * 4. With no provider key (or `FOOTBALL_PROVIDER=demo`), clearly-labelled mock fixtures are
 *    returned and the source is reported as `demo` / `unconfigured` so the UI can say so.
 *
 * No statistic, odd or prediction is ever synthesised here.
 */

export interface LeagueListResult {
  leagues: LeagueView[];
  provider: ProviderName;
  source: DataSource;
}

export interface MatchCentreResult {
  detail: MatchDetailView | null;
  source: DataSource;
  notice?: string;
}

interface ActiveProvider {
  provider: FootballProvider;
  /** Where data from this provider should be labelled as coming from. */
  source: DataSource;
  notice?: string;
}

function activeProvider(): ActiveProvider {
  const requested = resolveProviderName();
  const provider = getProvider(requested);

  if (requested === "demo") {
    return {
      provider,
      source: "demo",
      notice: "FOOTBALL_PROVIDER=demo is set. Every fixture below is clearly-labelled mock data.",
    };
  }

  if (!provider.configured) {
    return {
      provider: createDemoProvider(),
      source: "unconfigured",
      notice:
        "Mock data. No football data provider is connected, so nothing below is a real fixture, statistic, odd or prediction. Add a provider API key to the server environment to switch this on.",
    };
  }

  return { provider, source: "provider" };
}

export async function getFixtureFeed(query: FixtureQuery): Promise<FixtureFeedView> {
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 40;
  const { provider, source, notice } = activeProvider();
  const effective: FixtureQuery = { ...query, page, perPage };

  if (source !== "provider") {
    const feed = await provider.getFixtures(effective);
    return {
      fixtures: feed.fixtures.map((fixture) => mockView(fixture, source)),
      source,
      provider: provider.name,
      page,
      perPage,
      hasMore: false,
      notice,
    };
  }

  const cached = await readFixtures(provider.name, effective);
  if (cached.fresh) {
    return paginate(cached.fixtures, page, perPage, "cache", provider.name);
  }

  try {
    const feed = await provider.getFixtures(effective);
    await writeFixtures(provider.name, feed.fixtures);
    return {
      fixtures: feed.fixtures.map((fixture) => toFixtureView(fixture, "provider")),
      source: "provider",
      provider: provider.name,
      page: feed.pagination.page,
      perPage: feed.pagination.perPage,
      hasMore: feed.pagination.hasMore,
    };
  } catch (error) {
    if (cached.fixtures.length) {
      return paginate(
        cached.fixtures,
        page,
        perPage,
        "cache",
        provider.name,
        "The football data provider is unreachable right now, so the last successful update is shown.",
      );
    }
    return {
      fixtures: [],
      source: "unconfigured",
      provider: provider.name,
      page,
      perPage,
      hasMore: false,
      notice: `${errorMessage(error)} No fixtures can be shown until the provider responds.`,
    };
  }
}

export async function getTrackedLeagues(): Promise<LeagueListResult> {
  const { provider, source } = activeProvider();

  // A provider may be able to report which competitions its credential can actually read.
  // `null` means "unknown", in which case nothing is marked unavailable.
  const accessible =
    source === "provider" && provider.listAccessibleCompetitionIds
      ? await provider.listAccessibleCompetitionIds()
      : null;

  const leagues: LeagueView[] = provider.listCompetitions().map((competition) => ({
    id: competition.id,
    name: competition.name,
    country: competition.country,
    flag: competition.flag,
    short: competition.short,
    provider: provider.name,
    available: source === "provider" && (accessible ? accessible.has(competition.id) : true),
  }));
  return { leagues, provider: provider.name, source };
}

export async function getMatchCentre(fixtureId: string): Promise<MatchCentreResult> {
  const separator = fixtureId.indexOf(":");
  const prefix = separator > 0 ? fixtureId.slice(0, separator) : "";
  const providerFixtureId = separator > 0 ? fixtureId.slice(separator + 1) : "";

  if (!prefix || !providerFixtureId) {
    return { detail: null, source: "unconfigured", notice: "That fixture identifier is not valid." };
  }

  // A mock fixture only exists inside the demo provider's own id space.
  if (prefix === "demo") {
    const detail = await createDemoProvider().getMatchDetail(providerFixtureId);
    return { detail: detail ? toMatchDetailView(detail, "demo") : null, source: "demo" };
  }

  const { provider, source, notice } = activeProvider();
  if (source !== "provider" || provider.name !== prefix) {
    return {
      detail: null,
      source,
      notice:
        notice ??
        `This fixture belongs to the "${prefix}" provider, which is not the one currently active.`,
    };
  }

  const cached = await readMatchCentre(fixtureId);
  if (cached.fresh && cached.detail) {
    return { detail: toMatchDetailView(cached.detail, "cache"), source: "cache" };
  }

  try {
    const detail = await provider.getMatchDetail(providerFixtureId);
    if (!detail) {
      return {
        detail: cached.detail ? toMatchDetailView(cached.detail, "cache") : null,
        source: cached.detail ? "cache" : "provider",
        notice: cached.detail
          ? undefined
          : "The provider has no detail for this match yet.",
      };
    }
    await writeMatchCentre(detail);
    return { detail: toMatchDetailView(detail, "provider"), source: "provider" };
  } catch (error) {
    if (cached.detail) {
      return {
        detail: toMatchDetailView(cached.detail, "cache"),
        source: "cache",
        notice: "The provider is unreachable right now, so the last successful update is shown.",
      };
    }
    return { detail: null, source: "unconfigured", notice: errorMessage(error) };
  }
}

/**
 * A lightweight single-fixture lookup used by accuracy tracking.
 *
 * It deliberately skips the full match centre (form, head-to-head, odds), so grading a
 * finished pick costs one provider read rather than five.
 */
export async function getFixtureById(
  fixtureId: string,
): Promise<{ fixture: Fixture | null; source: DataSource }> {
  const separator = fixtureId.indexOf(":");
  const prefix = separator > 0 ? fixtureId.slice(0, separator) : "";
  const providerFixtureId = separator > 0 ? fixtureId.slice(separator + 1) : "";

  if (!prefix || !providerFixtureId) return { fixture: null, source: "unconfigured" };

  if (prefix === "demo") {
    return { fixture: await createDemoProvider().getFixture(providerFixtureId), source: "demo" };
  }

  const { provider, source } = activeProvider();
  if (source !== "provider" || provider.name !== prefix) return { fixture: null, source };

  try {
    return { fixture: await provider.getFixture(providerFixtureId), source: "provider" };
  } catch {
    return { fixture: null, source };
  }
}

/** Attach the labelled mock preview to a demo fixture card. */
function mockView(fixture: Fixture, source: DataSource): FixtureView {
  const preview = demoPreview(fixture.id);
  if (!preview) return toFixtureView(fixture, source);
  return toFixtureView(fixture, source, {
    marketLabel: marketLabel(preview.market),
    pick: preview.pick,
    note: "Mock preview",
    homeForm: preview.homeForm,
    awayForm: preview.awayForm,
  });
}

function paginate(
  fixtures: Fixture[],
  page: number,
  perPage: number,
  source: DataSource,
  provider: ProviderName,
  notice?: string,
): FixtureFeedView {
  const start = (page - 1) * perPage;
  const slice = fixtures.slice(start, start + perPage);
  return {
    fixtures: slice.map((fixture) => toFixtureView(fixture, source)),
    source,
    provider,
    page,
    perPage,
    hasMore: fixtures.length > start + slice.length,
    notice,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The football data provider request failed.";
}
