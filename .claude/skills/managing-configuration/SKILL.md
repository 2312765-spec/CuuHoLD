---
name: managing-configuration
description: Loads and validates configuration once at boot through a typed schema (Zod / class-validator), preventing scattered process.env access and runtime surprises. Use when adding env vars, debugging config-related crashes, or onboarding a new environment.
license: MIT
---

# Managing Configuration

## When to use
- Adding new environment variables
- Debugging config-related crashes
- Onboarding a new environment
- Removing scattered `process.env` access

## Core rules
1. Read `process.env` **exactly once** at boot
2. Validate with Zod (preferred) or class-validator
3. Export typed `AppConfig` object for the rest of the code
4. No `process.env` outside the config module
5. Secrets never logged or returned in responses

## Reference shape (TypeScript)

### Zod Schema (Preferred)
```typescript
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export type AppConfig = z.infer<typeof configSchema>;

let _config: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (_config) return _config;
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Config validation failed:', parsed.error.format());
    process.exit(1);
  }
  _config = parsed.data;
  return _config;
}
```

## Examples — Do
```typescript
// config.ts
export const config = loadConfig();
// Elsewhere
import { config } from '@shared/config';
const port = config.PORT;
```

## Examples — Don't
```typescript
// ❌ Scattered process.env access
if (process.env.NODE_ENV === 'production') { ... }
const dbUrl = process.env.DATABASE_URL;
```

## Checklist
- [ ] Zod schema validates all env vars
- [ ] `loadConfig()` called once at boot
- [ ] No `process.env` outside config module
- [ ] Secrets not logged or returned

See [reference/config-patterns.md](./reference/config-patterns.md) for full patterns.
