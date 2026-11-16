import { context, propagation, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  StackContextManager,
  TraceIdRatioBasedSampler,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";

// Read statically so Expo inlines them at build time.
const TRACES_ENDPOINT = process.env.EXPO_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || "";
const BASE_ENDPOINT = process.env.EXPO_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || "";
const EXPORT_HEADERS = process.env.EXPO_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS || "";
const SAMPLE_RATE = process.env.EXPO_PUBLIC_OTEL_TRACES_SAMPLE_RATE;
const ENVIRONMENT = process.env.EXPO_PUBLIC_OTEL_ENVIRONMENT || (__DEV__ ? "development" : "production");

let provider: TracerProvider | null = null;

function tracesUrl() {
  if (TRACES_ENDPOINT) return TRACES_ENDPOINT;
  if (BASE_ENDPOINT) return `${BASE_ENDPOINT.replace(/\/$/, "")}/v1/traces`;
  return null;
}

function parseHeaders(raw: string) {
  const headers: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    headers[decodeURIComponent(pair.slice(0, index).trim())] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return headers;
}

function sampleRatio() {
  const value = Number(SAMPLE_RATE);
  return SAMPLE_RATE !== undefined && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/**
 * Registers the OpenTelemetry SDK when an OTLP endpoint is configured. Without
 * one, the app keeps the API's no-op tracer and pays essentially nothing.
 */
export function initTelemetry() {
  if (provider) return provider;
  const url = tracesUrl();
  if (!url) return null;
  try {
    provider = new TracerProvider({
      resource: resourceFromAttributes({
        "service.name": "stonkwatcher-mobile",
        "service.version": Constants.expoConfig?.version ?? "unknown",
        "deployment.environment.name": ENVIRONMENT,
        "os.type": Platform.OS,
        "os.version": String(Platform.Version),
      }),
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(sampleRatio()) }),
      spanProcessors: [
        new BatchSpanProcessor({
          exporter: new OTLPTraceExporter({ url, headers: parseHeaders(EXPORT_HEADERS) }),
          scheduledDelayMillis: 5_000,
          maxExportBatchSize: 50,
          maxQueueSize: 500,
        }),
      ],
    });
    trace.setGlobalTracerProvider(provider);
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
    context.setGlobalContextManager(new StackContextManager().enable());

    // Mobile apps rarely "close"; send what's buffered whenever they leave the foreground.
    AppState.addEventListener("change", (state) => {
      if (state !== "active") void provider?.forceFlush().catch(() => undefined);
    });
  } catch (error) {
    provider = null;
    if (__DEV__) console.warn("OpenTelemetry disabled:", error);
  }
  return provider;
}
