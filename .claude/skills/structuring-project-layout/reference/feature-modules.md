# Feature modules — the canonical layout

## Directory tree (per feature)

```
src/<feature>/
├── domain/
│   ├── <entity>.ts                 # entity classes
│   ├── <value-object>.ts           # value objects
│   ├── <feature>.errors.ts         # domain errors (extend DomainError)
│   ├── events/
│   │   └── <past-tense-event>.ts
│   ├── services/                   # domain services (rules across entities)
│   │   └── <service>.ts
│   └── index.ts                    # barrel: only public domain types
├── application/
│   ├── ports/
│   │   ├── <port>.ts               # interface + Symbol token
│   │   └── ...
│   ├── use-cases/
│   │   ├── <verb>-<entity>.ts      # one class per use case
│   │   ├── <verb>-<entity>.input.ts
│   │   ├── <verb>-<entity>.output.ts
│   │   └── ...
│   ├── dto/                        # internal DTOs the use case returns
│   │   └── <entity>.dto.ts
│   └── index.ts                    # barrel: use cases + DTOs (no ports)
├── infrastructure/
│   ├── http/
│   │   ├── <feature>.controller.ts
│   │   ├── dto/
│   │   │   ├── <verb>-<entity>.request.ts
│   │   │   └── <verb>-<entity>.response.ts
│   │   └── mappers/
│   │       └── <entity>.http-mapper.ts
│   ├── persistence/
│   │   ├── <entity>.orm-entity.ts
│   │   ├── <entity>.mapper.ts
│   │   ├── <orm>-<entity>.repository.ts
│   │   └── migrations/
│   │       └── <timestamp>-<name>.ts
│   ├── events/
│   │   └── <subscriber>.ts         # listens to domain events
│   ├── crypto/
│   ├── http-clients/
│   └── ...                         # one folder per infra concern
├── <feature>.module.ts             # NestJS module (or composition file)
└── index.ts                        # public barrel of the feature
```

## Naming conventions

- **Files**: `kebab-case.ts`. One default-exported class per file.
- **Classes**: `PascalCase`.
- **Methods**: `camelCase`.
- **Constants**: `SCREAMING_SNAKE_CASE` only for environment-style
  constants. DI tokens use `Symbol('PortName')`.
- **DTOs**: `<Verb><Entity>Request`, `<Verb><Entity>Response`.
- **Use cases**: name = the verb (`RegisterUser`, `ConfirmOrder`,
  `CancelSubscription`). Class has exactly one method: `execute`.
- **Ports**: name = role (`UserRepository`, `PasswordHasher`,
  `EventBus`).
- **Adapters**: name = `<Tech><Port>` (`SqlUserRepository`,
  `Argon2PasswordHasher`, `NatsEventBus`).
- **Errors**: `<Concern>Error`. Domain → `DomainError`,
  application → `ApplicationError`, infra → `InfrastructureError`.

## Public API per feature

The feature's `index.ts` re-exports only what other features need:

```ts
// src/users/index.ts
export { RegisterUser } from './application/use-cases/register-user.js';
export { GetUser }      from './application/use-cases/get-user.js';
export { UserId }       from './domain/user-id.js';
export type { UserDto } from './application/dto/user.dto.js';
```

Other features import only from the barrel:

```ts
import { GetUser, type UserDto } from '@users';
```

Reaching into `@users/infrastructure/...` from another feature is
**forbidden** (boundary lint).

## Shared module (`src/shared/`)

Only **truly cross-cutting** code:

- `contracts/` — `ApiResponse<T>`, `Result<T,E>`, `Paginated<T>`, etc.
- `errors/` — `AppError` base hierarchy.
- `logging/` — `Logger` port + implementations.
- `config/` — `AppConfig` schema + loader.
- `clock/`, `random/`, `id/` — determinism ports.
- `http/` — `unwrap`, response interceptor, exception filter.

Rule: nothing in `src/shared/` may import from a feature module.

## Sizing heuristics

- A feature with 10+ use cases? Split it. The boundary is "nouns that
  share a single transactional consistency need".
- A use case file > 250 lines? Extract a **domain service** — the rule
  belongs on the entity or domain service, not in orchestration.
- A controller file > 200 lines? Split by verb groups
  (`UsersReadController`, `UsersWriteController`).

## When to introduce sub-features

If `users/` becomes a behemoth covering identity, profile, billing,
preferences:

```
src/identity/
src/profile/
src/billing/
src/preferences/
```

Each is its own bounded context, with its own `domain/`, `application/`,
`infrastructure/`. Cross-context communication happens via published
domain events or explicit anti-corruption-layer adapters.

## Monorepo extension

If the project becomes multiple deployable services:

```
apps/
  api/
  worker/
  admin/
packages/
  contracts/        # shared TypeScript types (ApiResponse<T>, ...)
  domain-users/     # the users domain layer, framework-free
  ...
tools/
  eslint-config/
  tsconfig/
```

Each app composes its own root, importing whichever domain packages it
needs. The packages remain framework-free.
