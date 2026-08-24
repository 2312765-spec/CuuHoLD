# Configuration — the twelve-factor way

## Principles

1. **Strict separation of config from code.** No environment-specific
   values committed to source.
2. **Config from the environment.** Process env, secret managers, mounted
   files — never code constants.
3. **Validate once, at boot.** Fail fast with a clear listing of every
   problem.
4. **Type the validated result.** Code consumes a typed `AppConfig`,
   never `process.env.X`.
5. **No defaults for secrets.** Defaults are allowed for non-sensitive,
   non-environment-specific values.
6. **One environment per deployment.** No "if env === 'staging'" code
   paths in business logic — they create silent prod/staging drift.

## Sources, in priority order

```diagram
1. Process flags / argv      (highest, only for ops switches)
2. Process environment        (the standard mechanism)
3. Mounted secrets files      (e.g., /run/secrets/<name>)
4. .env file in development   (loaded by `dotenv` only when NODE_ENV=development)
                                                                         (lowest)
```

`.env` is **never** loaded in staging or production. Real environments
inject env vars via the orchestrator (Kubernetes, ECS, Nomad).

## Schema with Zod

```ts
import { z } from 'zod';

export const AppConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'staging', 'production']),

  http: z.object({
    port: z.coerce.number().int().min(1).max(65_535),
    host: z.string().default('0.0.0.0'),
    corsOrigins: z.string().transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
    bodyLimitBytes: z.coerce.number().int().positive().default(1_048_576), // 1 MiB
    requestTimeoutMs: z.coerce.number().int().positive().default(30_000),
  }),

  database: z.object({
    url: z.string().url(),
    poolMin: z.coerce.number().int().nonnegative().default(0),
    poolMax: z.coerce.number().int().positive().default(10),
    statementTimeoutMs: z.coerce.number().int().positive().default(15_000),
    ssl: z.coerce.boolean().default(false),
  }),

  cache: z.object({
    redisUrl: z.string().url().optional(),
  }),

  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtIssuer: z.string().min(1),
    jwtAudience: z.string().min(1),
    jwtTtl: z.string().default('15m'),
  }),

  observability: z.object({
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    serviceName: z.string().min(1),
    serviceVersion: z.string().default('0.0.0'),
    otelExporterEndpoint: z.string().url().optional(),
  }),

  security: z.object({
    rateLimitPerMinute: z.coerce.number().int().positive().default(60),
    bcryptRounds: z.coerce.number().int().min(10).max(15).default(12),
  }),
});

export type AppConfig = Readonly<z.infer<typeof AppConfigSchema>>;
```

## Loader

```ts
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = AppConfigSchema.safeParse({
    nodeEnv: env.NODE_ENV,
    http: {
      port: env.HTTP_PORT,
      host: env.HTTP_HOST,
      corsOrigins: env.HTTP_CORS_ORIGINS ?? '',
      bodyLimitBytes: env.HTTP_BODY_LIMIT_BYTES,
      requestTimeoutMs: env.HTTP_REQUEST_TIMEOUT_MS,
    },
    database: {
      url: env.DATABASE_URL,
      poolMin: env.DATABASE_POOL_MIN,
      poolMax: env.DATABASE_POOL_MAX,
      statementTimeoutMs: env.DATABASE_STATEMENT_TIMEOUT_MS,
      ssl: env.DATABASE_SSL,
    },
    cache: { redisUrl: env.REDIS_URL },
    auth: {
      jwtSecret: env.AUTH_JWT_SECRET,
      jwtIssuer: env.AUTH_JWT_ISSUER,
      jwtAudience: env.AUTH_JWT_AUDIENCE,
      jwtTtl: env.AUTH_JWT_TTL,
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      serviceName: env.SERVICE_NAME,
      serviceVersion: env.SERVICE_VERSION,
      otelExporterEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
    },
    security: {
      rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
      bcryptRounds: env.BCRYPT_ROUNDS,
    },
  });

  if (!result.success) {
    throw new InvalidConfigError(result.error.flatten());
  }
  return Object.freeze(result.data);
}
```

## Secret handling

- **Never** put real secrets in `.env` committed to git.
- **Never** log the config object — even at debug level — without a
  redactor:
  ```ts
  function safeForLog(c: AppConfig): unknown {
    return { ...c, auth: { ...c.auth, jwtSecret: '***' }, database: { ...c.database, url: redactDbUrl(c.database.url) } };
  }
  ```
- Rotate secrets on a schedule. The app must support reading new values
  without recompilation — that comes for free if you read env at boot.

## Per-environment files (developer ergonomics only)

```
.env.example       (committed)
.env.development   (gitignored, dev defaults)
.env.test          (committed, test defaults — no real secrets)
```

Production reads from the orchestrator's secret store.

## Forbidden

- `process.env.X` outside the loader.
- Defaults for `JWT_SECRET`, `DATABASE_URL`, `STRIPE_KEY`, etc.
- Branching on `NODE_ENV` to change business logic.
- Loading config asynchronously after the app has started serving traffic.

## Reload

For long-running services, prefer **redeploy** for config changes. If
you truly need hot reload, expose a local-only `/admin/reload` endpoint
that re-runs the loader and atomically swaps the frozen `AppConfig`
reference — and make absolutely sure validation passes before the swap.
