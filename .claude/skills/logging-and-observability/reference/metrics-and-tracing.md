# Metrics and tracing

Logs alone are not enough. A production-ready service emits **three
signals**: logs, metrics, traces. OpenTelemetry is the standard.

## OpenTelemetry setup

```ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export function bootstrapTelemetry(config: AppConfig['observability']): NodeSDK {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'unknown',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${config.otelExporterEndpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${config.otelExporterEndpoint}/v1/metrics` }),
      exportIntervalMillis: 30_000,
    }),
    instrumentations: [getNodeAutoInstrumentations({
      // disable noisy auto-instrumentations
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  sdk.start();
  return sdk;
}
```

Call `bootstrapTelemetry(config)` **before** importing the framework
(NestJS, Fastify) so auto-instrumentation can patch require/import
hooks.

## Required metrics

Every service must export at minimum:

| Metric | Type | Labels |
|--------|------|--------|
| `http_server_requests_total` | counter | `method`, `route`, `status` |
| `http_server_request_duration_seconds` | histogram | `method`, `route`, `status` |
| `db_query_duration_seconds` | histogram | `op` (`select`/`insert`/...), `table` |
| `db_pool_in_use` | gauge | (none) |
| `db_pool_idle` | gauge | (none) |
| `outbound_request_duration_seconds` | histogram | `host`, `status` |
| `event_handler_duration_seconds` | histogram | `event` |
| `event_handler_failures_total` | counter | `event` |
| `process_uptime_seconds` | gauge | (none) |

## Custom metrics

```ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('checkout-api');

const orderConfirmed = meter.createCounter('orders_confirmed_total', {
  description: 'Number of orders confirmed',
});
const orderTotal = meter.createHistogram('orders_total_cents', {
  description: 'Order total in cents',
  unit: 'cents',
});

orderConfirmed.add(1, { currency: 'USD' });
orderTotal.record(4900, { currency: 'USD' });
```

## Tracing manual spans

For business-meaningful operations, add explicit spans:

```ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('checkout-api');

await tracer.startActiveSpan('checkout.confirm', async (span) => {
  try {
    span.setAttribute('order.id', orderId.toString());
    const result = await this.useCase.execute(input);
    span.setStatus({ code: result.ok ? 1 : 2 });
    return result;
  } catch (e) {
    span.recordException(e as Error);
    span.setStatus({ code: 2 });
    throw e;
  } finally {
    span.end();
  }
});
```

## Connecting logs to traces

When a span is active, include `traceId` and `spanId` in every log
line. With Pino:

```ts
import { trace } from '@opentelemetry/api';

const log = baseLogger.child({});
log.info({
  ...withTrace(),
  msg: 'order.confirmed',
});

function withTrace(): Record<string, unknown> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}
```

This lets the aggregator pivot from a log line to the full trace.

## SLOs

Define service level objectives in code/config so dashboards and alerts
agree:

```yaml
# slo.yaml
service: checkout-api
slos:
  - name: "Availability"
    target: 99.9
    window: 30d
    sli: "(http_requests_total{status!~'5..'} / http_requests_total)"
  - name: "Latency p99 < 500ms"
    target: 99.0
    window: 30d
    sli: "histogram_quantile(0.99, sum by (le) (rate(http_server_request_duration_seconds_bucket[5m])))"
```

## Health vs metrics

Don't conflate them:

| Endpoint | Purpose | Caller |
|----------|---------|--------|
| `/health/live` | Process is up. | Orchestrator. |
| `/health/ready` | Process can serve traffic (DB, cache reachable). | Orchestrator. |
| `/metrics` | Prometheus scrape. | Monitoring. Often gated by IP. |

`/metrics` is **not** an authentication-free public endpoint in
production. Bind it to an internal interface or require an auth header.

## Common mistakes

- ❌ Auto-instrumenting `fs`/`crypto` — extreme cardinality.
- ❌ Using `requestId` as a metric label — every value is unique.
- ❌ Recording histogram values in seconds for sub-millisecond
  operations — buckets won't fit. Use seconds with appropriate buckets
  or use units of milliseconds with a custom histogram view.
- ❌ Forgetting to call `sdk.shutdown()` on `SIGTERM`.
