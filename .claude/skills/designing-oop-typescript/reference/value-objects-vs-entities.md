# Value Objects vs Entities

The single most useful classification when modeling a domain. Get this
right and most other decisions follow.

## Definitions

| | Value Object | Entity |
|--|--------------|--------|
| Identity | None — equality by value. | Stable identity (`id`) for its lifetime. |
| Mutability | **Immutable**. Any change yields a new instance. | Mutable through guarded methods. |
| Lifecycle | None — created on demand, GC'd freely. | Created → modified → archived/deleted. |
| Equality | `equals(other)` compares fields. | `equals(other)` compares `id`. |
| Examples | `Email`, `Money`, `Address`, `DateRange`, `Color`, `Coordinates`. | `User`, `Order`, `Invoice`, `Subscription`. |

## How to choose

Ask: *"If I had two of these with the same field values, would I treat
them as the same thing?"*

- Yes → **Value Object**.
- No, they have a history / identity → **Entity**.

`$10` is `$10`. Two ten-dollar bills with different serial numbers are
the same `Money(10, 'USD')` for accounting purposes. So `Money` is a
value object. But the `Account` they live in is an entity.

## Value Object — canonical shape

```ts
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: Currency,
  ) {}

  static of(amount: number, currency: Currency): Money {
    if (!Number.isFinite(amount)) throw new InvalidMoneyError('not finite');
    if (Math.round(amount * 100) !== amount * 100) {
      throw new InvalidMoneyError('more than 2 decimals');
    }
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
    return Money.of(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
}
```

Notes:

- `private constructor` + named factory `of()` enforces invariants.
- All fields `readonly`. `add()` returns a **new** `Money`, never mutates.
- `equals()` compares fields.

## Entity — canonical shape

```ts
export class Order {
  private constructor(
    public readonly id: OrderId,
    private readonly buyer: UserId,
    private readonly lines: OrderLine[],
    private status: OrderStatus,
    private readonly placedAt: Date,
  ) {}

  static draft(id: OrderId, buyer: UserId, lines: OrderLine[]): Order {
    if (lines.length === 0) throw new EmptyOrderError(id);
    return new Order(id, buyer, [...lines], OrderStatus.Draft, new Date());
  }

  // Behavior — not setters
  confirm(): void {
    if (this.status !== OrderStatus.Draft) {
      throw new OrderAlreadyConfirmedError(this.id);
    }
    this.status = OrderStatus.Confirmed;
  }

  cancel(reason: CancelReason): void {
    if (this.status === OrderStatus.Shipped) {
      throw new OrderAlreadyShippedError(this.id);
    }
    this.status = OrderStatus.Cancelled;
  }

  total(): Money {
    return this.lines.reduce(
      (sum, l) => sum.add(l.subtotal()),
      Money.of(0, this.lines[0]!.currency()),
    );
  }

  equals(other: Order): boolean {
    return this.id.equals(other.id);
  }
}
```

Notes:

- Identity via `id`; equality by `id`.
- State changes only through verbs (`confirm`, `cancel`), each guarded.
- No public setters. The outside world cannot put the order into an
  invalid state.

## Aggregate root rule

When entities cluster (e.g., `Order` owns many `OrderLine`s):

- Pick **one root** (`Order`). Outsiders only ever reference the root.
- `OrderLine` has identity within the order, but is not retrieved
  independently. The repository persists the whole aggregate.
- Invariants spanning lines (e.g., total ≤ credit limit) live on the
  root.

## Persistence implications

- **Value Objects** are stored as columns or embedded fields, never as
  separate rows with their own ID.
- **Entities** map to rows; aggregate roots have a primary table, child
  entities have FK tables loaded with the root.
- **Mappers** translate domain ↔ ORM. Domain class never carries ORM
  decorators (see the persistence skill).

## Common mistakes

- ❌ Mutating value object fields (`money.amount = 5`).
- ❌ Comparing entities by all fields instead of `id`.
- ❌ Letting an entity be created in an invalid state and "fixed" later.
- ❌ Letting child entities reach into siblings; route through the root.
