# DI containers in TypeScript

## Container options

| Container | Style | Suits |
|-----------|-------|-------|
| **NestJS module graph** | Decorator-based, framework-native. | NestJS apps (default). |
| **tsyringe** | Decorator-based, lightweight, Microsoft. | Plain Node.js services. |
| **inversify** | Decorator-based, mature, plenty of features. | Larger plain Node.js codebases. |
| **awilix** | Function-based, no decorators, no `reflect-metadata`. | Teams that avoid decorators. |
| **manual** | Hand-wired in `main.ts`. | < 10 services, demo apps. |

## Provider lifetimes

| Lifetime | Meaning | Use for |
|----------|---------|---------|
| **Singleton** (default) | One instance per container. | Stateless services, repositories, ports. |
| **Transient** | New instance every resolve. | Builders, command objects with internal state. |
| **Scoped / Request** | One instance per request/scope. | Request-bound state (correlation IDs, current user) — used sparingly. |

Default to **singleton**. Document why if you escalate.

## Composition root

The single place where concrete classes are bound to interfaces. Lives
at the top level (`src/composition/`) or, in NestJS, distributes
across `*.module.ts` files but should *not* spread into use cases.

```ts
// src/composition/container.ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { USER_REPOSITORY } from '@users/application/ports/user-repository.js';
import { SqlUserRepository } from '@users/infrastructure/persistence/sql-user-repository.js';
import { PASSWORD_HASHER } from '@users/application/ports/password-hasher.js';
import { Argon2PasswordHasher } from '@users/infrastructure/crypto/argon2-password-hasher.js';

export function configureContainer(): void {
  container.register(USER_REPOSITORY, { useClass: SqlUserRepository });
  container.register(PASSWORD_HASHER, { useClass: Argon2PasswordHasher });
  // ... per feature
}
```

## Decorating once, in infrastructure

The application/domain layers should be **container-agnostic**. Add the
container's decorator only at the adapter:

```ts
// adapter — has @injectable
import { injectable } from 'tsyringe';

@injectable()
export class SqlUserRepository implements UserRepository { /* ... */ }
```

```ts
// use case — also @injectable, but only because the container needs to
// resolve constructor params; the class itself remains pure.
@injectable()
export class RegisterUser { /* ... */ }
```

If you want the use case to be 100% framework-free, register it via a
factory:

```ts
container.register(RegisterUser, {
  useFactory: (c) => new RegisterUser(
    c.resolve(USER_REPOSITORY),
    c.resolve(PASSWORD_HASHER),
    /* ... */
  ),
});
```

## Decorating without `reflect-metadata`

Awilix-style functional registration:

```ts
import { createContainer, asClass, Lifetime } from 'awilix';

const container = createContainer({ injectionMode: 'CLASSIC' });
container.register({
  userRepository: asClass(SqlUserRepository).singleton(),
  passwordHasher: asClass(Argon2PasswordHasher).singleton(),
  registerUser: asClass(RegisterUser).singleton(),
});
```

The `RegisterUser` constructor parameters are matched **by name** to
container keys.

## Don't do these

- ❌ Resolve from the container inside a use case (Service Locator).
- ❌ Singleton holding mutable per-request state.
- ❌ Two containers in the same process.
- ❌ Use the container in tests — construct the SUT directly with
  hand-rolled fakes.

## Tests don't use the container

```ts
// ✅ direct construction in unit tests
const useCase = new RegisterUser(
  new InMemoryUserRepository(),
  new FakePasswordHasher(),
  new SequentialIdGenerator(),
  new InMemoryEventBus(),
);
```

This is one of the strongest signals that your DI is correctly applied:
unit tests don't need the framework.

## Breaking circular dependencies

If module A imports module B and vice versa, extract a third module C
that owns the shared port. A and B both depend on C; C depends on
neither.

```diagram
Before:               After:
A ◀────▶ B            A ─────▶ C ◀───── B
```
