# Structured logging cookbook

## Why structured

Plain text logs require regex grep to extract a field. Structured (JSON)
logs let your aggregator (Loki, ELK, Datadog, CloudWatch Insights) treat
fields as queryable columns. Every project should ship JSON logs in
non-development environments.

## Pino setup (recommended)

```ts
import pino from 'pino';

export function createLogger(config: AppConfig['observability']): pino.Logger {
  return pino({
    level: config.logLevel,
    base: {
      service: config.serviceName,
      version: config.serviceVersion,
      env: process.env.NODE_ENV,
      pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        'password', '*.password',
        'authorization', '*.authorization',
        'token', '*.token', '*.accessToken', '*.refreshToken',
        'cookie', 'headers.cookie',
        '*.creditCard', '*.cardNumber', '*.cvv',
        'email', // depending on your privacy stance
      ],
      censor: '***',
    },
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss.l' } }
      : undefined,
  });
}
```

## Log levels — stable meaning

| Level | Use for |
|-------|---------|
| `trace` | Step-by-step debugging in dev. Off in prod. |
| `debug` | Rich detail useful when investigating. Off in prod by default. |
| `info` | A meaningful state change (`user.registered`, `order.confirmed`). Default level in prod. |
| `warn` | Recoverable degradation (retry succeeded, fallback used). |
| `error` | The current operation failed and was not recovered. Pages on rate. |
| `fatal` | The process is going down (last log before exit). |

Per-line **discipline**:

- `trace`/`debug` may be voluminous, but redaction still applies.
- `info` is for *events*, not *steps*. "user.registered" yes,
  "entered registerUser function" no.
- `error` should be paged when its rate exceeds a threshold. If a code
  path emits `error` for normal flows, the level is wrong.

## Log line shape

```jsonc
{
  "level": "info",
  "time": "2026-05-03T10:00:00.123Z",
  "service": "checkout-api",
  "version": "1.4.2",
  "env": "production",
  "pid": 17,
  "requestId": "01HMKJ4G7T...",
  "traceId": "5b8aa5a2d2c872e8321cf37308d69df2",
  "spanId": "051581bf3cb55c13",
  "userId": "u_123",
  "msg": "order.confirmed",
  "orderId": "o_789",
  "totalCents": 4900,
  "currency": "USD"
}
```

The agent must not log payload contents that include PII or secrets.

## Correlation flow

```diagram
client ──▶ proxy ──▶ service A ──▶ service B
            X-Request-Id    X-Request-Id (forwarded)
                            traceparent (W3C, forwarded)
```

Middleware:

```ts
export function correlation(): RequestHandler {
  return (req, res, next) => {
    const requestId = req.header('x-request-id') ?? crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as RequestWithContext).context = { requestId };
    next();
  };
}
```

In handlers:

```ts
const log = this.logger.child({ requestId: req.context.requestId, route: req.path });
log.info('order.confirm.received', { orderId });
```

Outbound HTTP calls forward the `x-request-id` (and `traceparent` when
using OpenTelemetry).

## What to log around an operation

```ts
log.info('users.register.received', { email: redactEmail(email) });
const t0 = process.hrtime.bigint();
try {
  const result = await this.useCase.execute(input);
  if (!result.ok) {
    log.info('users.register.rejected', { code: result.error.code });
    return result;
  }
  log.info('users.register.completed', {
    userId: result.value.id,
    durationMs: Number(process.hrtime.bigint() - t0) / 1e6,
  });
  return result;
} catch (e: unknown) {
  log.error('users.register.failed', {
    error: serializeError(e),
    durationMs: Number(process.hrtime.bigint() - t0) / 1e6,
  });
  throw e;
}
```

The pattern: `received` → `completed` | `rejected` (typed business
failure) | `failed` (unexpected).

## Anti-patterns

- ❌ String interpolation: `logger.info('user ' + user.id + ' created')`.
- ❌ Logging full request bodies (PII).
- ❌ Logging tokens, secrets, API keys.
- ❌ Logging the same event at multiple layers (controller AND use case
  AND repository).
- ❌ `log.error` for expected business outcomes.
- ❌ `console.log` anywhere in `src/`.

## Lints

```js
'no-console': ['error', { allow: ['warn', 'error'] }] // and even those only in last-resort handlers
```

## Sampling

For high-cardinality `debug` events in production:

- Use the framework's sampling (`pino` doesn't have built-in sampling;
  use a `pino-pretty` alternative or filter at the SDK).
- Or emit a custom counter and only log every Nth occurrence.

## Audit logs vs application logs

For events that have legal meaning (login, permission change,
financial), emit a separate **audit log** stream:

- Stricter retention (years).
- Append-only sink.
- Schema-enforced fields (actor, action, target, timestamp).

Don't conflate audit logs with operational logs.
