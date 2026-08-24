# The test pyramid (applied)

```diagram
                       ╭─────────╮
                       │   E2E   │   few, slow, full stack
                     ╭─┴─────────┴─╮
                     │ Integration │   moderate, real adapters
                   ╭─┴─────────────┴─╮
                   │      Unit       │   many, fast, no I/O
                   ╰─────────────────╯
```

## Pyramid in numbers (rule of thumb)

| Layer | % of total | Speed | Owns |
|-------|------------|-------|------|
| Unit | 70–80% | < 50ms each | Domain rules, use cases. |
| Integration | 15–25% | 100ms–1s each | Adapters with their backing tech. |
| E2E | 5–10% | 1–10s each | Critical user journeys. |

## What each layer covers

### Unit

- Every domain entity invariant.
- Every use case happy path **and** every typed error path.
- Every value object factory edge case.
- No DB. No HTTP. No file system. No real `Date`. No real `Math.random`.

### Integration

- Every repository adapter against the real DB (Postgres in
  `testcontainers`, MongoDB equivalent, etc.).
- Every 3rd-party SDK adapter against a recorded mock or local stub.
- Every queue subscriber/publisher against a real broker.

### E2E

- Boot the full app in-process.
- Hit it with `supertest` (HTTP) or call its handler directly.
- Replace truly external systems (payments, email) with in-memory
  fakes, but keep DB and queue real if possible.
- Cover one or two critical paths per feature, not every endpoint.

## Test naming

Each test name reads as a sentence describing observable behavior:

```ts
it('rejects registration when email is already taken', async () => { /* ... */ });
it('emits OrderConfirmed exactly once when order is confirmed', async () => { /* ... */ });
it('returns 409 when registering with a duplicate email', async () => { /* ... */ }); // e2e
```

Avoid:
```ts
it('test register', () => { /* ... */ });
it('it should work', () => { /* ... */ });
it('handles error', () => { /* ... */ });
```

## File and folder layout

```
src/users/
├── domain/
│   ├── user.ts
│   ├── user.spec.ts                 # unit, lives next to code
│   ├── email.ts
│   └── email.spec.ts
├── application/
│   └── use-cases/
│       ├── register-user.ts
│       └── register-user.spec.ts    # unit
└── infrastructure/
    └── persistence/
        ├── sql-user-repository.ts
        └── sql-user-repository.integration.spec.ts

tests/
└── e2e/
    ├── users.register.e2e-spec.ts
    └── orders.checkout.e2e-spec.ts
```

## Determinism ports

Inject the things tests must control:

```ts
export interface Clock { now(): Date; }
export interface IdGenerator { next(): string; }
export interface Random { int(min: number, max: number): number; uuid(): string; }
```

Test fakes:

```ts
export class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date { return new Date(this.fixed); }
}

export class SequentialIdGenerator implements IdGenerator {
  private n = 0;
  next(): string { this.n += 1; return `id-${this.n}`; }
}
```

## CI configuration

Run each layer as a separate job:

```yaml
jobs:
  unit:
    steps: [npm ci, npm run test]
  integration:
    services: [postgres, redis]
    steps: [npm ci, npm run test:integration]
  e2e:
    services: [postgres]
    steps: [npm ci, npm run test:e2e]
```

Failures in any layer block the merge.

## Anti-patterns

- ❌ Booting the whole framework for unit tests.
- ❌ A single mega "test all" command that hides which layer is slow.
- ❌ Sharing mutable state between tests.
- ❌ `if (process.env.CI)` branches inside tests.
- ❌ Testing logging output as the primary assertion.
- ❌ Tests that pass once and then fail on rerun (state pollution).
- ❌ `it.skip` left in main.

## Coverage as a smell

Coverage is a debugging tool, not a goal. Aim for:

- Domain & application: **100% branch coverage** — easy because there
  is no I/O.
- Infrastructure: drive coverage via integration tests, not hand-written
  branch tests.

Below 90% on a use case usually means a typed error path is untested.

## Testing the public surface, not the implementation

Drive tests from the use case's input/output, not from internal helpers.
This way refactors that don't change behavior don't break tests.
