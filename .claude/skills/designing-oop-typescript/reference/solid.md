# SOLID in TypeScript

## S — Single Responsibility Principle

A class has **one reason to change**.

**Red flags**

- The class name contains "And", "Manager", "Helper", "Util".
- The class has more than one *axis* of public methods (e.g., persistence
  + email + validation).
- A change in one feature forces changes in unrelated methods of the same
  class.

**Fix**: extract collaborators that own each axis. The original class
becomes a coordinator (or disappears).

```ts
// ❌
export class UserService {
  register(...) { /* validates, hashes, persists, emails */ }
}

// ✅
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly events: EventBus,
  ) {}
  async execute(input: RegisterUserInput): Promise<Result<UserId, AppError>> { /* ... */ }
}
```

## O — Open/Closed Principle

Classes are **open for extension, closed for modification**. New behavior
arrives as a new class, not as more `if`/`switch` branches.

```ts
// ❌
class PriceCalculator {
  price(order: Order): Money {
    if (order.type === 'standard') return /* ... */;
    if (order.type === 'b2b')      return /* ... */;
    if (order.type === 'partner')  return /* ... */;
    throw new Error('unknown');
  }
}

// ✅
interface PricingStrategy { price(o: Order): Money; }
class StandardPricing implements PricingStrategy { /* ... */ }
class B2bPricing implements PricingStrategy { /* ... */ }
class PartnerPricing implements PricingStrategy { /* ... */ }
```

The DI container picks the strategy; the calculator never changes when a
new pricing variant is added.

## L — Liskov Substitution Principle

Subtypes must be **usable wherever the supertype is** without breaking
caller expectations.

**Red flags**

- A subclass overrides a method to throw `NotImplementedError`.
- A subclass tightens preconditions (rejects more inputs).
- A subclass loosens postconditions (returns less than promised).

**Fix**: the supertype is wrong. Either widen its contract or make it
narrower (split with composition).

```ts
// ❌ classic LSP violation
class Bird { fly(): void { /* ... */ } }
class Penguin extends Bird { fly(): void { throw new Error('cannot fly'); } }

// ✅
interface Animal { /* ... */ }
interface Flying { fly(): void; }
class Sparrow implements Animal, Flying { /* ... */ }
class Penguin implements Animal { /* no fly */ }
```

## I — Interface Segregation Principle

Clients should not depend on methods they don't use.

**Red flags**

- Big "fat" interface where most consumers implement only a subset.
- A test fake has to stub 12 methods to test one.

**Fix**: split into role interfaces. A class can implement many.

```ts
// ❌
interface UserRepository {
  findById(...): Promise<User | null>;
  save(...): Promise<void>;
  delete(...): Promise<void>;
  countByCountry(...): Promise<number>;
  exportCsv(...): Promise<Buffer>;
}

// ✅
interface UserReader { findById(...): Promise<User | null>; }
interface UserWriter { save(u: User): Promise<void>; delete(id: UserId): Promise<void>; }
interface UserAnalytics { countByCountry(c: Country): Promise<number>; }
interface UserExporter { exportCsv(filter: UserFilter): Promise<Buffer>; }
```

## D — Dependency Inversion Principle

High-level modules should not depend on low-level modules. Both should
depend on **abstractions**.

This is the foundation of the entire pack — see the
`decoupling-with-di` skill for the full story.

```ts
// ❌
class CheckoutUseCase {
  private gateway = new StripeGateway();   // hard dep on a low-level class
}

// ✅
class CheckoutUseCase {
  constructor(private readonly gateway: PaymentGateway) {}
}
```

## Summary table

| Letter | Question to ask | Smell |
|--------|------------------|-------|
| S | Why would this class change? | Multiple unrelated reasons. |
| O | Can I add a new variant without editing existing code? | New `if` branch in old class. |
| L | Can I replace this with any subclass safely? | `throw NotImplemented`. |
| I | Does every client need every method? | Fat interface. |
| D | Does this depend on a thing or an abstraction? | `new ConcreteClass()` inside a service. |
