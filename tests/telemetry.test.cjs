/* global __dirname */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const { context, propagation, trace } = require("@opentelemetry/api");
const { W3CTraceContextPropagator } = require("@opentelemetry/core");
const { InMemorySpanExporter, SimpleSpanProcessor, TracerProvider } = require("@opentelemetry/sdk-trace");

const exporter = new InMemorySpanExporter();
trace.setGlobalTracerProvider(new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] }));
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

function load(fetchImpl) {
  const root = path.join(__dirname, "..");
  const modules = new Map();
  function loadFile(file) {
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      exports,
      require: (name) => (name.startsWith(".") ? loadFile(path.resolve(path.dirname(file), `${name}.ts`)) : require(name)),
      process: { env: { EXPO_PUBLIC_API_URL: "https://api.example.test", EXPO_PUBLIC_OTEL_SLOW_REQUEST_MS: "30" } },
      fetch: fetchImpl, Headers, URL, AbortController, setTimeout, clearTimeout, Date, Error,
    });
    return exports;
  }
  return loadFile(path.join(root, "lib/http.ts"));
}

test("own API calls get a client span and a traceparent header", async () => {
  exporter.reset();
  let sent;
  const { fetchWithTimeout } = load(async (url, init) => { sent = init.headers; return { ok: true, status: 200 }; });
  await fetchWithTimeout("https://api.example.test/api/tokens?q=secret-search", { method: "GET" });
  const [span] = exporter.getFinishedSpans();
  assert.equal(span.name, "GET api.example.test");
  assert.equal(span.attributes["http.response.status_code"], 200);
  assert.equal(span.attributes["url.path"], "/api/tokens");
  assert.ok(!JSON.stringify(span.attributes).includes("secret-search"), "query string must not be recorded");
  assert.match(sent.get("traceparent"), new RegExp(`^00-${span.spanContext().traceId}-${span.spanContext().spanId}-01$`));
});

test("third-party calls are traced without trace headers", async () => {
  exporter.reset();
  let sent;
  const { fetchWithTimeout } = load(async (url, init) => { sent = init.headers; return { ok: false, status: 503 }; });
  await fetchWithTimeout("https://api.dexscreener.com/tokens/v1/solana/x", {});
  const [span] = exporter.getFinishedSpans();
  assert.equal(sent, undefined);
  assert.equal(span.attributes["error.type"], "503");
  assert.equal(span.status.code, 2);
});

test("timeouts and slow requests are marked on the span", async () => {
  exporter.reset();
  const { fetchWithTimeout } = load((url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  }));
  await assert.rejects(fetchWithTimeout("https://api.example.test/slow", {}, 40), { name: "TimeoutError" });
  const [span] = exporter.getFinishedSpans();
  assert.equal(span.attributes["error.type"], "timeout");
  assert.equal(span.attributes["app.request.slow"], true);
  assert.ok(span.events.some((event) => event.name === "slow_request"));
  assert.ok(span.events.some((event) => event.name === "exception"));
});

test("without a registered SDK nothing is recorded or injected", async () => {
  // Sanity check that the API stays a no-op when initTelemetry() never ran.
  trace.disable(); propagation.disable(); context.disable();
  let sent;
  const { fetchWithTimeout } = load(async (url, init) => { sent = init.headers; return { ok: true, status: 200 }; });
  await fetchWithTimeout("https://api.example.test/api/tokens", {});
  assert.equal(sent, undefined);
});
