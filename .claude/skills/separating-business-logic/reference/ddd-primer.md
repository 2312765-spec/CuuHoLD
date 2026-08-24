# DDD primer (tactical)

Just the patterns you need for day-to-day work. Skip *strategic DDD*
(bounded contexts, context maps) until you have multiple teams.

## Building blocks

| Block | Purpose | Example |
|-------|---------|---------|
| **Entity** | Identity + lifecycle. | `User`, `Order`. |
| **Value Object** | Immutable, equality by value. | `Email`, `Money`. |
| **Aggregate** | A cluster of entities with one root, one transaction boundary. | `Order` + its `OrderLine`s. |
| **Aggregate Root** | The single entry point to the aggregate. | `Order`. |
| **Domain Service** | Behavior that does not belong on a single entity. | `LimitChecker`. |
| **Domain Event** | Something noteworthy that happened in the past tense. | `UserRegistered`. |
| **Repository** | Collection-like interface for an aggregate root. | `UserRepository`. |
| **Factory** | Builds an aggregate enforcing invariants. | `Order.draft(...)`. |
| **Specification** | Reusable predicate / query rule. | `IsPremiumCustomer`. |

## Aggregate rules

1. **One root per aggregate.** Outsiders only reference the root by id.
2. **One transaction per aggregate.** A use case modifying multiple
   aggregates must publish events and let other aggregates react
   (eventual consistency), unless they share a real DB transaction
   needed for invariants.
3. **Children loaded with the root.** No partial loads of the
   aggregate.
4. **Invariants enforced on the root.** Children expose behavior the
   root delegates to.

## Aggregate example

```ts
// domain/order.ts
export class Order {
  private constructor(
    public readonly id: OrderId,
    private readonly buyer: UserId,
    private readonly lines: OrderLine[],
    private status: OrderStatus,
    private readonly events: DomainEvent[] = [],
  ) {}

  static draft(id: OrderId, buyer: UserId, lines: OrderLine[]): Order {
    if (lines.length === 0) throw new EmptyOrderError(id);
    if (lines.length > 100) throw new OrderTooLargeError(id);
    return new Order(id, buyer, [...lines], OrderStatus.Draft);
  }

  addLine(line: OrderLine): void {
    if (this.status !== OrderStatus.Draft) {
      throw new OrderNotEditableError(this.id);
    }
    if (this.lines.length >= 100) throw new OrderTooLargeError(this.id);
    this.lines.push(line);
  }

  confirm(): void {
    if (this.status !== OrderStatus.Draft) {
      throw new OrderAlreadyConfirmedError(this.id);
    }
    this.status = OrderStatus.Confirmed;
    this.events.push(new OrderConfirmed(this.id, this.total()));
  }

  total(): Money { /* ... */ }

  pullEvents(): readonly DomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}
```

The use case is responsible for `pullEvents()` and publishing them
**after** the repository commits.

## Domain service

When behavior depends on multiple aggregates and doesn't naturally fit
on one of them:

```ts
export class CreditCheck {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly clock: Clock,
  ) {}

  async canWithdraw(accountId: AccountId, amount: Money): Promise<boolean> {
    const account = await this.accounts.findById(accountId);
    if (!account) return false;
    return account.availableAt(this.clock.now()).greaterThanOrEqual(amount);
  }
}
```

Domain services live in `domain/` (they don't depend on application or
infrastructure types — only domain types and ports declared in domain).

## Domain events

Past-tense facts. They are published *after* the transaction commits so
side-effects don't roll back with failures.

```ts
export class OrderConfirmed implements DomainEvent {
  readonly name = 'order.confirmed';
  readonly occurredAt = new Date();
  constructor(public readonly orderId: OrderId, public readonly total: Money) {}
}
```

Subscribers (in `infrastructure/events/`) react by sending email,
updating read models, calling 3rd parties — none of which the use case
should know about.

## Repository contract

```ts
export interface OrderRepository extends Repository<Order, OrderId> {
  findByBuyer(buyerId: UserId, page: Page): Promise<Paginated<Order>>;
}
```

Methods are **collection-oriented** (`findById`, `save`, `delete`),
not row-oriented. Avoid leaking SQL/Mongo concepts into the port.

## Common pitfalls

- ❌ Aggregate root reaches into another aggregate's internals.
- ❌ A "save all" call mutating multiple aggregates in one transaction
  for non-invariant reasons.
- ❌ Domain event handlers running synchronously inside the same
  transaction (rolls back business outcomes when email fails).
- ❌ Querying for read concerns through the write-side aggregate
  (use a separate query model — see CQRS).

## Reading list

- *Domain-Driven Design Distilled* — Vaughn Vernon (short, applied).
- *Implementing DDD* — Vernon (deeper).
- *Patterns, Principles and Practices of DDD* — Millett (TypeScript-friendly mindset).
