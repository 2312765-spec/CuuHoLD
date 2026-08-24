# Inheritance vs Composition

## Default: composition

Reach for **composition** first. Use inheritance only when:

1. There is a true **"is-a"** relationship that holds for every
   conceivable subclass.
2. The supertype defines a **template** (Template Method pattern) where
   the skeleton is fixed and only specific steps vary.
3. The framework requires it (e.g., `extends BaseException` in a
   particular runtime).

Otherwise, prefer **interfaces + delegation**.

## Why composition wins

- **Flexibility**: collaborators can be swapped at runtime via DI.
- **Testability**: each piece is mockable independently.
- **No fragile base class problem**: changing a method signature
  doesn't ripple through every subclass.
- **No diamond / multiple-inheritance issues**.
- **Better encapsulation**: subclasses share fewer secrets than children
  of a base class.

## When inheritance is OK

### 1. Sealed hierarchy of variants (Tagged Union via classes)

```ts
export abstract class DomainEvent {
  abstract readonly name: string;
  readonly occurredAt = new Date();
}
export class UserRegistered extends DomainEvent {
  readonly name = 'user.registered';
  constructor(public readonly userId: UserId) { super(); }
}
export class UserActivated extends DomainEvent {
  readonly name = 'user.activated';
  constructor(public readonly userId: UserId) { super(); }
}
```

The base class is a real abstraction (every event has `name` and
`occurredAt`). Subclasses don't override behavior — they extend data.

### 2. Template Method

When the algorithm is fixed and only steps vary.

```ts
export abstract class ImportJob<TRow> {
  async run(rows: AsyncIterable<TRow>): Promise<ImportSummary> {
    const summary = ImportSummary.empty();
    for await (const row of rows) {
      try {
        const dto = this.parse(row);
        await this.validate(dto);
        await this.persist(dto);
        summary.success++;
      } catch (e: unknown) {
        summary.failures.push(this.toFailure(row, e));
      }
    }
    return summary;
  }

  protected abstract parse(row: TRow): unknown;
  protected abstract validate(dto: unknown): Promise<void>;
  protected abstract persist(dto: unknown): Promise<void>;
  protected abstract toFailure(row: TRow, error: unknown): ImportFailure;
}
```

### 3. Domain `AppError` hierarchy

```ts
export abstract class AppError extends Error { /* ... */ }
export abstract class DomainError extends AppError {}
export class UserNotFoundError extends DomainError { /* ... */ }
```

Every layer in the chain adds meaningful capability.

## When inheritance is wrong

### "Reuse" anti-pattern

```ts
// ❌
abstract class BaseService {
  protected logger = new Logger();
  protected db = new Database();
  // Subclasses inherit logger and db. Tight coupling, hidden deps.
}
class UserService extends BaseService { /* ... */ }
class OrderService extends BaseService { /* ... */ }
```

Fix: inject `Logger` and `Database` (or their interfaces) via the
constructor of each service.

### Method override soup

If the same method is overridden 3+ levels deep with `super.method()`
chains, the algorithm is hidden across files. Refactor with Strategy
or Chain of Responsibility.

### Inheriting from framework base classes for boilerplate

```ts
// ❌ Reaches into framework internals; couples the domain to the framework.
class User extends TypeOrmEntity { /* ... */ }
```

Keep domain free; framework decorators belong in infrastructure.

## Mixins

TypeScript mixins (functions returning a class with extra methods)
solve some inheritance problems but introduce others (type inference
becomes brittle, mixed mixin order matters). Use sparingly. Prefer
composition with delegate methods.

## Decision flowchart

```diagram
                Need to share behavior?
                        │
              ┌─────────┴─────────┐
             yes                  no
              │                    └── leave classes independent
              ▼
   Is it a true "is-a"?
              │
       ┌──────┴──────┐
      yes             no
       │              └── compose: inject collaborator, delegate calls
       ▼
   Will every subclass
   honor the contract?
       │
   ┌───┴───┐
  yes      no
   │       └── interfaces + composition (LSP would be violated)
   ▼
 Inheritance is OK.
 Keep the hierarchy
 shallow (≤ 2 levels).
```

## Heuristic limits

- ≤ 2 levels deep (base → concrete).
- ≤ 5 methods on the base.
- No public mutable state on the base.
- Always `abstract` for partial implementations — never instantiable.
