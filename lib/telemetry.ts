import { context, propagation, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { API_URL } from "./config";

/**
 * Request tracing on top of the OpenTelemetry API only. Until `initTelemetry()`
 * (lib/telemetry-setup.ts) registers an SDK, every call here is a cheap no-op.
 */

export const SLOW_REQUEST_MS = Number(process.env.EXPO_PUBLIC_OTEL_SLOW_REQUEST_MS) || 2_000;

// Browsers reject cross-origin requests carrying headers the server's CORS policy
// doesn't list, so the web build only sends `traceparent` when explicitly enabled.
const PROPAGATE_ON_WEB = process.env.EXPO_PUBLIC_OTEL_PROPAGATE_ON_WEB === "1";

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Only our own backend gets trace headers; third-party APIs never see them.
const PROPAGATE_ORIGINS = new Set(
  [API_URL, ...(process.env.EXPO_PUBLIC_OTEL_PROPAGATE_ORIGINS || "").split(",")]
    .map((value) => originOf(value.trim()))
    .filter((value): value is string => Boolean(value)),
);

function shouldPropagate(origin: string | null) {
  if (!origin || !PROPAGATE_ORIGINS.has(origin)) return false;
  // `document` exists only in the web build; avoids pulling react-native into plain-Node tests.
  return typeof document === "undefined" || PROPAGATE_ON_WEB;
}

function tracer() {
  return trace.getTracer("stonkwatcher.http");
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export type TraceMeta = {
  timeoutMs?: number;
  /** Lets the caller label an abort it caused (e.g. its own timeout). */
  errorType?: () => string | undefined;
};

/**
 * fetch wrapped in an OpenTelemetry client span. Records method, host, path
 * (never the query string, which can hold search terms), status, duration and
 * whether the request crossed SLOW_REQUEST_MS.
 */
export async function tracedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  meta: TraceMeta = {},
): Promise<Response> {
  const url = requestUrl(input);
  const requestMethod = typeof input === "object" && "method" in input ? input.method : undefined;
  const method = (init.method || requestMethod || "GET").toUpperCase();
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  const host = parsed?.hostname ?? "unknown";
  const span = tracer().startSpan(`${method} ${host}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      "http.request.method": method,
      "server.address": host,
      ...(parsed ? { "url.scheme": parsed.protocol.replace(":", ""), "url.path": parsed.pathname } : {}),
      ...(meta.timeoutMs ? { "app.request.timeout_ms": meta.timeoutMs } : {}),
    },
  });
  const spanContext = trace.setSpan(context.active(), span);

  let nextInit = init;
  if (span.isRecording() && shouldPropagate(parsed?.origin ?? null)) {
    const carrier: Record<string, string> = {};
    propagation.inject(spanContext, carrier);
    if (Object.keys(carrier).length) {
      const base = init.headers ?? (typeof input === "object" && "headers" in input ? input.headers : undefined);
      const headers = new Headers(base);
      for (const [key, value] of Object.entries(carrier)) headers.set(key, value);
      nextInit = { ...init, headers };
    }
  }

  const started = Date.now();
  try {
    const response = await context.with(spanContext, () => fetch(input, nextInit));
    span.setAttribute("http.response.status_code", response.status);
    if (response.status >= 400) {
      span.setAttribute("error.type", String(response.status));
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    return response;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    span.recordException(err);
    span.setAttribute("error.type", meta.errorType?.() ?? (err.name === "AbortError" ? "aborted" : err.name || "Error"));
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw error;
  } finally {
    const elapsed = Date.now() - started;
    span.setAttribute("app.request.duration_ms", elapsed);
    if (elapsed >= SLOW_REQUEST_MS) {
      span.setAttribute("app.request.slow", true);
      span.addEvent("slow_request", { "app.request.slow_threshold_ms": SLOW_REQUEST_MS });
    }
    span.end();
  }
}
