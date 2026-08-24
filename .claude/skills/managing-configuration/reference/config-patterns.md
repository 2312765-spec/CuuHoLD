# Configuration Patterns — Complete Reference

## Zod (Recommended)

### Full Config Schema
```typescript
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  HOST: z.string().default('localhost'),

  DATABASE_URL: z.string().url(),
  DATABASE_POOL_SIZE: z.coerce.number().min(1).max(100).default(10),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1h'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  REDIS_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;

  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Configuration validation failed:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  _config = Object.freeze(parsed.data) as AppConfig;
  return _config;
}

export const config = loadConfig();
```

### Usage in Code
```typescript
import { config } from '@shared/config';

const server = new Server(config.HOST, config.PORT);
const jwtSecret = config.JWT_SECRET; // typed as string
```

## class-validator Alternative

```typescript
import { validateSync } from 'class-validator';
import { IsEnum, IsNumber, IsString, MinLength, IsOptional } from 'class-validator';

class AppConfig {
  @IsEnum(['development', 'staging', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsNumber()
  PORT: number = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  REDIS_URL?: string;
}

export function loadConfig(): AppConfig {
  const config = new AppConfig();
  Object.assign(config, process.env);

  const errors = validateSync(config);
  if (errors.length > 0) {
    console.error('Config validation failed:', errors);
    process.exit(1);
  }

  return Object.freeze(config) as AppConfig;
}
```

## .env.example
```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-32-character-secret-here
LOG_LEVEL=info
REDIS_URL=redis://localhost:6379
```

## Bootstrap Sequence
```typescript
// src/main.ts
import 'reflect-metadata';
import { config } from './shared/config';
import { startServer } from './server';

async function bootstrap() {
  const appConfig = config; // triggers validation
  await startServer(appConfig);
}

bootstrap().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
```
