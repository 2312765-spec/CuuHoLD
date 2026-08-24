# Logging Patterns — Complete Reference

## Logger Interface (Port)
```typescript
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}
```

## JSON Logger Implementation
```typescript
export class JsonLogger implements Logger {
  constructor(private traceId?: string) {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') return;
    this.log('debug', message, meta);
  }

  child(meta: Record<string, unknown>): Logger {
    return {
      info: (msg, m) => this.log('info', msg, { ...meta, ...m }),
      warn: (msg, m) => this.log('warn', msg, { ...meta, ...m }),
      error: (msg, m) => this.log('error', msg, { ...meta, ...m }),
      debug: (msg, m) => this.log('debug', msg, { ...meta, ...m }),
      child: (m) => this.child({ ...meta, ...m }),
    };
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

## Trace ID Middleware (Express)
```typescript
import { v4 as uuidv4 } from 'uuid';

export function traceIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = req.headers['x-correlation-id'] as string || uuidv4();
  res.setHeader('X-Correlation-Id', traceId);

  // AsyncLocalStorage for context propagation
  return loggerContext.run({ traceId }, () => next());
}
```

## Health Endpoint
```typescript
export class HealthController {
  constructor(
    private db: DataSource,
    private redis?: Redis
  ) {}

  async check(): Promise<ApiResponse<HealthStatus>> {
    const checks = {
      database: await this.checkDb(),
      redis: this.redis ? await this.checkRedis() : 'skipped',
    };

    const healthy = Object.values(checks).every(s => s === 'ok' || s === 'skipped');
    return ok({ status: healthy ? 'healthy' : 'degraded', checks });
  }

  private async checkDb(): Promise<string> {
    try { await this.db.query('SELECT 1'); return 'ok'; } catch { return 'error'; }
  }

  private async checkRedis(): Promise<string> {
    try { await this.redis.ping(); return 'ok'; } catch { return 'error'; }
  }
}

interface HealthStatus {
  status: 'healthy' | 'degraded';
  checks: Record<string, string>;
}
```

## Usage in Code
```typescript
class CreateUserUseCase {
  constructor(
    private repo: UserRepository,
    private logger: Logger
  ) {}

  async execute(dto: CreateUserDto): Promise<Result<User, AppError>> {
    this.logger.info('Creating user', { email: dto.email });
    try {
      const user = User.create(dto.id, Email.create(dto.email));
      await this.repo.save(user);
      this.logger.info('User created', { userId: user.id });
      return ok(user);
    } catch (e) {
      this.logger.error('Failed to create user', { error: (e as Error).message });
      return err(e as AppError);
    }
  }
}
```
