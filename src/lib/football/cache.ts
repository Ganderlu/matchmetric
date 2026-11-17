import "server-only";

import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase-admin";
import type {
  Fixture,
  FixtureQuery,
  League,
  MatchDetail,
  MatchStatus,
  OddsMarket,
  ProviderName,
  Team,
} from "./types";

/**
 * Firestore-backed normalized cache.
 *
 * The API routes never talk to a provider on every request: a provider response is
 * normalised, written into the collections below, and then served from Firestore until
 * its TTL expires. That keeps a page load from burning provider quota and gives the app
 * a working dataset whenever the provider is briefly unavailable.
 *
 * The Admin SDK bypasses security rules, so these collections stay closed to clients.
 *
 * Collection notes:
 * - `leagues` / `teams` are reference data written as a side effect of a fixture sync.
 * - `fixtures` holds one normalised fixture per document, keyed by its provider-scoped id.
 * - `match_statistics` holds the whole normalised match-centre payload for a fixture
 *   (statistics plus form, head-to-head, lineups, events, injuries and availability) so
 *   the match centre needs a single read.
 * - `odds` mirrors the normalised odds markets so they can be queried on their own.
 * - `predictions` / `prediction_results` are reserved for the prediction engine; nothing
 *   writes to them yet because MatchMetric never invents a prediction.
 */
export const COLLECTIONS = {
  leagues: "leagues",
  teams: "teams",
  fixtures: "fixtures",
  matchStatistics: "match_statistics",
  odds: "odds",
  predictions: "predictions",
  predictionResults: "prediction_results",
} as const;

export type FootballCollection = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/** Live data changes minute to minute; a settled result never changes. */
const LIVE_TTL_MS = 45_000;
const SCHEDULED_TTL_MS = 10 * 60_000;
/** A match still marked "scheduled" after kickoff should be re-checked quickly. */
const KICKOFF_GRACE_TTL_MS = 2 * 60_000;
const SETTLED_TTL_MS = 12 * 60 * 60_000;

/** Safety bound on a single cached window read. */
const MAX_WINDOW_DOCS = 400;

export function ttlForFixture(
  status: MatchStatus,
  kickoff: string,
  now = Date.now(),
): number {
  if (status === "live" || status === "halftime") return LIVE_TTL_MS;
  if (status === "scheduled" || status === "unknown") {
    const kickoffAt = new Date(kickoff).getTime();
    return Number.isFinite(kickoffAt) && kickoffAt < now ? KICKOFF_GRACE_TTL_MS : SCHEDULED_TTL_MS;
  }
  return SETTLED_TTL_MS;
}

/** True when a stored `expiresAt` is still in the future (or absent, i.e. never expires). */
export function isFresh(value: unknown, now = Date.now()): boolean {
  const expiresAt = value as { toMillis?: () => number } | undefined;
  if (!expiresAt || typeof expiresAt.toMillis !== "function") return false;
  return expiresAt.toMillis() > now;
}

function db(): Firestore | null {
  try {
    return getAdminDb();
  } catch {
    // Firestore caching is optional; a bad cache credential must not block live provider data.
    return null;
  }
}

/**
 * Firestore rejects `undefined` field values, and the normalised shapes use optional
 * properties. A JSON round-trip drops them; every value in these shapes is a primitive,
 * a plain object or an array, so nothing else is altered.
 */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Read a stored document back into its normalized shape, minus the cache bookkeeping. */
function dropMeta<T>(stored: object, keys: string[]): T {
  const clone = { ...stored } as Record<string, unknown>;
  for (const key of keys) delete clone[key];
  return clone as T;
}

// ---- fixtures --------------------------------------------------------------

export async function readFixtures(
  provider: ProviderName,
  query: FixtureQuery,
): Promise<{ fixtures: Fixture[]; fresh: boolean }> {
  const firestore = db();
  if (!firestore) return { fixtures: [], fresh: false };

  try {
    const snapshot = await firestore
      .collection(COLLECTIONS.fixtures)
      .where("kickoffDate", ">=", query.from)
      .where("kickoffDate", "<=", query.to)
      .limit(MAX_WINDOW_DOCS)
      .get();

    const now = Date.now();
    const inScope = snapshot.docs
      .map((doc) => doc.data() as Fixture & { expiresAt?: Timestamp })
      .filter((stored) => {
        if (stored.provider !== provider) return false;
        if (query.leagueIds?.length && !query.leagueIds.includes(stored.league.id)) return false;
        if (query.statuses?.length && !query.statuses.includes(stored.status)) return false;
        return true;
      });

    const fixtures = inScope
      .map((stored) => dropMeta<Fixture>(stored, ["expiresAt"]))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    return {
      fixtures,
      fresh: inScope.length > 0 && inScope.every((stored) => isFresh(stored.expiresAt, now)),
    };
  } catch {
    // A missing index or an unavailable database must not break the request path.
    return { fixtures: [], fresh: false };
  }
}

export async function writeFixtures(
  provider: ProviderName,
  fixtures: Fixture[],
): Promise<void> {
  const firestore = db();
  if (!firestore || !fixtures.length) return;

  try {
    const now = Date.now();
    const batch = firestore.batch();

    for (const fixture of fixtures) {
      const ttl = ttlForFixture(fixture.status, fixture.kickoff, now);
      batch.set(firestore.collection(COLLECTIONS.fixtures).doc(fixture.id), {
        ...plain(fixture),
        kickoffDate: fixture.kickoff.slice(0, 10),
        expiresAt: Timestamp.fromMillis(now + ttl),
        updatedAt: Timestamp.fromMillis(now),
      });
    }

    await batch.commit();
    await writeTeams(provider, fixtures);
    await writeLeagues(leaguesOf(fixtures));
  } catch {
    // Caching is best-effort: the response the caller already has is still correct.
  }
}

/** Safety bound on a single by-id fixture read. */
const FIXTURE_READ_CHUNK = 100;

/** A cached fixture together with when its state was last written. */
export interface CachedFixture extends Fixture {
  /** ISO instant of the last cache write, or "" when the document carries none. */
  cachedAt: string;
}

/**
 * Read cached fixtures by id.
 *
 * Unlike `readFixtures` this is not scoped to a date window: the caller already knows which
 * fixtures it needs, and the stored document is the app's latest known state for each one —
 * including the live score, the minute and the provider's own status label. A missing document
 * simply means that fixture has not been synced, and the caller decides what to show instead
 * rather than inventing a state.
 */
export async function readCachedFixtures(ids: string[]): Promise<Map<string, CachedFixture>> {
  const map = new Map<string, CachedFixture>();
  const firestore = db();
  if (!firestore || !ids.length) return map;

  const unique = [...new Set(ids)];
  try {
    for (let index = 0; index < unique.length; index += FIXTURE_READ_CHUNK) {
      const refs = unique
        .slice(index, index + FIXTURE_READ_CHUNK)
        .map((id) => firestore.collection(COLLECTIONS.fixtures).doc(id));
      const docs = await firestore.getAll(...refs);
      for (const doc of docs) {
        if (!doc.exists) continue;
        const stored = doc.data() as Fixture & { updatedAt?: unknown };
        map.set(doc.id, {
          ...dropMeta<Fixture>(stored, ["expiresAt", "updatedAt", "kickoffDate"]),
          cachedAt: toIsoInstant(stored.updatedAt),
        });
      }
    }
  } catch {
    return map;
  }
  return map;
}

function toIsoInstant(value: unknown): string {
  const stamp = value as { toDate?: () => Date } | undefined;
  const date = stamp?.toDate?.();
  return date instanceof Date ? date.toISOString() : "";
}

/** The distinct competitions present in a fixture set, rebuilt as reference rows. */
function leaguesOf(fixtures: Fixture[]): League[] {
  const leagues = new Map<string, League>();
  for (const fixture of fixtures) {
    if (leagues.has(fixture.league.id)) continue;
    leagues.set(fixture.league.id, {
      ...fixture.league,
      provider: fixture.provider,
      providerId: fixture.league.id.split(":")[1] ?? "",
    });
  }
  return [...leagues.values()];
}

// ---- reference data --------------------------------------------------------

export async function readLeagues(provider: ProviderName): Promise<League[] | null> {
  const firestore = db();
  if (!firestore) return null;

  try {
    const snapshot = await firestore
      .collection(COLLECTIONS.leagues)
      .where("provider", "==", provider)
      .get();
    if (snapshot.empty) return null;

    return snapshot.docs.map((doc) => doc.data() as League);
  } catch {
    return null;
  }
}

export async function writeLeagues(leagues: League[]): Promise<void> {
  const firestore = db();
  if (!firestore || !leagues.length) return;

  try {
    const batch = firestore.batch();
    for (const league of leagues) {
      batch.set(firestore.collection(COLLECTIONS.leagues).doc(league.id), {
        ...plain(league),
        updatedAt: Timestamp.fromMillis(Date.now()),
      });
    }
    await batch.commit();
  } catch {
    // best-effort
  }
}

async function writeTeams(provider: ProviderName, fixtures: Fixture[]): Promise<void> {
  const firestore = db();
  if (!firestore) return;

  const teams = new Map<string, Team>();
  for (const fixture of fixtures) {
    teams.set(fixture.homeTeam.id, fixture.homeTeam);
    teams.set(fixture.awayTeam.id, fixture.awayTeam);
  }
  if (!teams.size) return;

  try {
    const batch = firestore.batch();
    for (const team of teams.values()) {
      batch.set(firestore.collection(COLLECTIONS.teams).doc(team.id), {
        ...plain(team),
        provider,
        updatedAt: Timestamp.fromMillis(Date.now()),
      });
    }
    await batch.commit();
  } catch {
    // best-effort
  }
}

// ---- match centre ----------------------------------------------------------

export async function readMatchCentre(
  fixtureId: string,
): Promise<{ detail: MatchDetail | null; fresh: boolean }> {
  const firestore = db();
  if (!firestore) return { detail: null, fresh: false };

  try {
    const snapshot = await firestore.collection(COLLECTIONS.matchStatistics).doc(fixtureId).get();
    if (!snapshot.exists) return { detail: null, fresh: false };

    const stored = snapshot.data() as
      | (MatchDetail & { expiresAt?: Timestamp; updatedAt?: Timestamp })
      | undefined;
    if (!stored) return { detail: null, fresh: false };

    const detail = dropMeta<MatchDetail>(stored, ["expiresAt", "updatedAt"]);

    // Odds live in their own collection; prefer the mirrored copy when it is present.
    const oddsSnapshot = await firestore.collection(COLLECTIONS.odds).doc(fixtureId).get();
    if (oddsSnapshot.exists) {
      const oddsDoc = oddsSnapshot.data() as { markets?: OddsMarket[] } | undefined;
      if (oddsDoc?.markets) detail.odds = oddsDoc.markets;
    }

    return { detail, fresh: isFresh(stored.expiresAt) };
  } catch {
    return { detail: null, fresh: false };
  }
}

export async function writeMatchCentre(detail: MatchDetail): Promise<void> {
  const firestore = db();
  if (!firestore) return;

  try {
    const now = Date.now();
    const expiresAt = Timestamp.fromMillis(
      now + ttlForFixture(detail.fixture.status, detail.fixture.kickoff, now),
    );
    const { odds, ...rest } = detail;

    const batch = firestore.batch();
    batch.set(firestore.collection(COLLECTIONS.matchStatistics).doc(detail.fixture.id), {
      ...plain(rest),
      expiresAt,
      updatedAt: Timestamp.fromMillis(now),
    });
    batch.set(firestore.collection(COLLECTIONS.odds).doc(detail.fixture.id), {
      fixtureId: detail.fixture.id,
      markets: plain(odds),
      expiresAt,
      updatedAt: Timestamp.fromMillis(now),
    });
    await batch.commit();
  } catch {
    // best-effort
  }
}
