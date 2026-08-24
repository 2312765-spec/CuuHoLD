---
name: logging-and-observability
description: Adds structured JSON logging, correlation/trace IDs, metrics, and health endpoints. Use when wiring observability for a new service, debugging cross-service requests, or removing console.log.
license: MIT
---

# Logging and Observability

## When to use
- Wiring observability for a new service
- Debugging cross-service requests
- Removing `console.log` from production code

## Core rules
1. Structured JSON logs in production, pretty in development
2. Every log entry has `timestamp`, `level`, `message`, `traceId`
3. No `console.log` in production code
4. Correlation/trace ID passed through async context
5. Health endpoint (`/health`) and readiness endpoint (`/ready`)

## Reference shape (TypeScript)

### Logger Interface (Port)
```typescript
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
```

### JSON Logger Implementation
```typescript
export class JsonLogger implements Logger {
  constructor(private traceId?: string) {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      traceId: this.traceId,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  }
}
```

## Examples — Do
```typescript
this.logger.info('User created', { userId: user.id, email: user.email.value });
```

## Examples — Don't
```typescript
// ❌ Console.log in production code
console.log('User created:', user);
// ❌ No trace ID
logger.info('Request processed');
```

## Checklist
- [ ] Structured JSON logger implemented
- [ ] Trace/correlation ID in every log entry
- [ ] Health and readiness endpoints created
- [ ] No `console.log` in production code

See [reference/logging-patterns.md](./reference/logging-patterns.md) for full patterns.
