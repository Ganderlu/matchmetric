import "server-only";

/** Helpers shared by the provider adapters. */

/** YYYY-MM-DD in UTC, the date format both providers accept for range queries. */
export function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Build a kickoff instant from a provider timestamp. Prefer the Unix epoch because the
 * provider's localised string depends on the competition timezone.
 */
export function toKickoff(epochSeconds?: number | null, localised?: string | null): string | null {
  if (typeof epochSeconds === "number" && Number.isFinite(epochSeconds)) {
    const fromEpoch = new Date(epochSeconds * 1000);
    if (!Number.isNaN(fromEpoch.getTime())) return fromEpoch.toISOString();
  }
  if (localised) {
    const normalised = localised.includes("T") ? localised : localised.replace(" ", "T");
    const fromString = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`);
    if (!Number.isNaN(fromString.getTime())) return fromString.toISOString();
  }
  return null;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function clampPage(value: number | undefined, fallback: number, max: number): number {
  if (!value || !Number.isFinite(value) || value < 1) return fallback;
  return Math.min(Math.floor(value), max);
}
