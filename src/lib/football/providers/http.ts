import "server-only";

import { consume } from "../rate-limit";
import { ProviderResponseError } from "./types";

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;
/** Provider plans are metered, so keep a conservative ceiling per instance. */
const PROVIDER_REQUESTS_PER_MINUTE = 240;

export interface ProviderFetchOptions {
  provider: string;
  apiKey: string;
  /** Where the credential goes. Both supported providers use a header. */
  auth?: { header?: string; query?: string };
  timeoutMs?: number;
  retries?: number;
}

/**
 * Server-only fetch for football data providers.
 *
 * Adds a request budget, a hard timeout and bounded retries (honouring Retry-After on
 * 429) so a slow or throttled provider cannot stall a route or exhaust the quota.
 */
export async function providerFetchJson<T>(
  url: string,
  options: ProviderFetchOptions,
): Promise<T> {
  const {
    provider,
    apiKey,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    consume(`provider:${provider}`, PROVIDER_REQUESTS_PER_MINUTE);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = { accept: "application/json" };
      let target = url;

      if (options.auth?.header) headers[options.auth.header] = apiKey;
      if (options.auth?.query) {
        const parsed = new URL(url);
        parsed.searchParams.set(options.auth.query, apiKey);
        target = parsed.toString();
      }

      const response = await fetch(target, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = new ProviderResponseError(
          `${provider} responded with ${response.status}.`,
          response.status,
        );
        if (attempt < retries) await delay(retryDelay(response, attempt));
        continue;
      }

      if (!response.ok) {
        lastError = new ProviderResponseError(
          `${provider} responded with ${response.status}.`,
          response.status,
        );
        // Non-retryable client error (bad key, bad query) - fail fast.
        break;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await delay(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ProviderResponseError(`${provider} request failed.`);
}

function backoff(attempt: number) {
  return Math.min(2_000, 250 * 2 ** attempt);
}

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(5_000, seconds * 1_000);
  return backoff(attempt);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
