import { tracedFetch } from "./telemetry";

export const DEFAULT_TIMEOUT_MS = 10_000;

export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    this.name = "TimeoutError";
  }
}

/**
 * fetch with a hard timeout. An optional caller signal still cancels the request;
 * the timeout fires independently so a hung provider can never stall a screen.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const outer = init.signal;
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onAbort);
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await tracedFetch(url, { ...init, signal: controller.signal }, {
      timeoutMs,
      errorType: () => (timedOut ? "timeout" : undefined),
    });
  } catch (error) {
    if (timedOut) throw new TimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

const inflight = new Map<string, Promise<unknown>>();

/**
 * Share one in-flight promise between identical concurrent requests, so several
 * screens or components asking for the same data trigger a single network call.
 * The entry is dropped as soon as the request settles; this is not a cache.
 */
export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const request = run().finally(() => {
    if (inflight.get(key) === request) inflight.delete(key);
  });
  inflight.set(key, request);
  return request;
}
