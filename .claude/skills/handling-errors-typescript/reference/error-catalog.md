# Error catalog

The full taxonomy used across this pack. Every project should publish
its own version of this table as the source of truth for client-facing
error codes.

## Hierarchy

```diagram
Error
└── AppError                        (abstract)
    ├── DomainError                 (4xx, business)
    │   ├── ValidationError
    │   ├── EntityNotFoundError
    │   ├── ConflictError
    │   └── ...feature-specific
    ├── ApplicationError            (4xx, use-case orchestration)
    │   ├── PreconditionFailedError
    │   └── UnauthorizedError
    └── InfrastructureError         (5xx, infra)
        ├── DatabaseUnavailableError
        ├── ExternalServiceError
        ├── TimeoutError
        └── ...
```

## Base classes

```ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    options?: { cause?: unknown; details?: Readonly<Record<string, unknown>> },
  ) {
    super(message);
    this.name = new.target.name;
    this.cause = options?.cause;
    this.details = options?.details;
  }
}

export abstract class DomainError extends AppError {}
export abstract class ApplicationError extends AppError {}
export abstract class InfrastructureError extends AppError {}
```

## Standard catalog

| Class | code | httpStatus | When |
|-------|------|------------|------|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Boundary input invalid. |
| `UnauthenticatedError` | `UNAUTHENTICATED` | 401 | Missing or invalid auth. |
| `ForbiddenError` | `FORBIDDEN` | 403 | Authenticated but not authorized. |
| `EntityNotFoundError` | `ENTITY_NOT_FOUND` | 404 | A specific entity (subclasses give a stable code per entity). |
| `ConflictError` | `CONFLICT` | 409 | State conflict (subclass for specific cases). |
| `RateLimitedError` | `RATE_LIMITED` | 429 | Caller exceeded quota. |
| `PreconditionFailedError` | `PRECONDITION_FAILED` | 412 | A guard condition failed. |
| `UnprocessableError` | `UNPROCESSABLE` | 422 | Request well-formed but cannot be acted upon. |
| `InternalError` | `INTERNAL_ERROR` | 500 | Unhandled. |
| `ExternalServiceError` | `EXTERNAL_SERVICE_ERROR` | 502 | Upstream failed. |
| `ServiceUnavailableError` | `SERVICE_UNAVAILABLE` | 503 | Process degraded. |
| `TimeoutError` | `TIMEOUT` | 504 | Outbound call timed out. |

## Feature-specific error template

```ts
export class UserNotFoundError extends EntityNotFoundError {
  readonly code = 'USER_NOT_FOUND';
  constructor(public readonly userId: UserId) {
    super(`User not found`, { details: { userId: userId.toString() } });
  }
}

export class EmailAlreadyTakenError extends ConflictError {
  readonly code = 'EMAIL_ALREADY_TAKEN';
  constructor(public readonly email: Email) {
    super(`Email already taken`, { details: { email: email.toString() } });
  }
}
```

## Throw vs return

| Situation | Mechanism |
|-----------|-----------|
| Expected business outcome (404, 409, 422). | Return `Result.err(new XxxError())`. |
| Programmer mistake (impossible state, missing data after invariant guard). | `throw` — propagates to global filter. |
| Infrastructure outage. | `throw` an `InfrastructureError` subclass; gets logged, mapped to 5xx. |

## Wrapping causes

Always preserve the underlying cause:

```ts
try {
  await this.stripe.paymentIntents.create(/* ... */);
} catch (e: unknown) {
  if (e instanceof Stripe.errors.StripeRateLimitError) {
    throw new RateLimitedError('Stripe rate limit', { cause: e });
  }
  throw new ExternalServiceError('Stripe failed', { cause: e });
}
```

The global filter logs the chain (`error → cause → cause...`), so root
causes are not lost.

## Serialization

```ts
export function serializeError(e: unknown): Record<string, unknown> {
  if (e instanceof AppError) {
    return {
      name: e.name,
      code: e.code,
      message: e.message,
      details: e.details,
      cause: e.cause ? serializeError(e.cause) : undefined,
    };
  }
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { value: String(e) };
}
```

## Public-facing rules

- `code` is a stable string. Renaming it is a breaking change.
- `message` is plain English, safe for end users (no SQL, no SDK names,
  no PII).
- `details` is structured and may include validation field paths.
- Never echo back the user's password, tokens, or secrets.
- Never include `stack` in API responses, only in logs.

## Logging policy

| Status | Log level |
|--------|-----------|
| 4xx (client errors) | `info` for known client mistakes; `warn` if it indicates a misuse pattern (e.g., repeated 401s). |
| 5xx (server errors) | `error` — page on rate. |

## i18n

When messages must be localized:

- Pass `code` to the client; client looks up the translation.
- Or pass an additional `messageKey` string; the server keeps a default
  English `message` for fallbacks.
