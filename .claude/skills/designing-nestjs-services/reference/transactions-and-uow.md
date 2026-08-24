# Transactions & Unit-of-Work

## The problem

A use case that touches two aggregates needs atomic persistence:

```ts
// withdraw from `from` and deposit to `to` — must be all-or-nothing
```

Spreading `@Transaction()` decorators or calling `dataSource.transaction()`
from the controller breaks separation of concerns. The use case must
own the transactional boundary.

## The shape — a `UnitOfWork` port

```ts
// src/shared/contracts/unit-of-work.ts
export const UOW = Symbol('UnitOfWork');

export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
```

The use case asks the UoW to wrap its work — without ever importing
TypeORM/Mongoose/Postgres.

## TypeORM adapter

```ts
// src/shared/persistence/typeorm-unit-of-work.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AsyncLocalStorage } from 'node:async_hooks';

const txStore = new AsyncLocalStorage<EntityManager>();

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly ds: DataSource) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.ds.transaction(async (manager) => {
      return txStore.run(manager, work);
    });
  }
}

export function currentEntityManager(fallback: EntityManager): EntityManager {
  return txStore.getStore() ?? fallback;
}
```

Repositories use the current EM if a transaction is active, else the
default:

```ts
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectEntityManager() private readonly defaultEm: EntityManager,
    private readonly mapper: UserMapper,
  ) {}

  private em(): EntityManager { return currentEntityManager(this.defaultEm); }

  async save(user: User): Promise<void> {
    await this.em().getRepository(UserOrm).save(this.mapper.toOrm(user));
  }
  // findById / delete / ... all use this.em()
}
```

## Use case

```ts
@Injectable()
export class TransferMoney implements UseCase<TransferInput, Result<void, TransferError>> {
  constructor(
    @Inject(UOW) private readonly uow: UnitOfWork,
    @Inject(ACCOUNTS) private readonly accounts: AccountRepository,
    @Inject(EVENT_BUS) private readonly events: EventBus,
  ) {}

  async execute(input: TransferInput): Promise<Result<void, TransferError>> {
    return this.uow.run(async () => {
      const from = await this.accounts.findById(input.from);
      const to   = await this.accounts.findById(input.to);
      if (!from || !to)            return Result.err(new AccountNotFound());
      if (!from.canTransfer(input.amount)) return Result.err(new InsufficientFunds());

      from.withdraw(input.amount);
      to.deposit(input.amount);

      await this.accounts.save(from);
      await this.accounts.save(to);
      // Events published AFTER commit (see below)
      return Result.ok(undefined);
    });
  }
}
```

## Publishing events after commit

A common bug: send an email *inside* the transaction. If the transaction
rolls back, the email already went out.

Solution: collect events on the aggregate; publish them **after**
`uow.run` returns.

```ts
return this.uow.run(async () => {
  /* ... */
  await this.accounts.save(from);
  await this.accounts.save(to);
  return Result.ok({ events: [...from.pullEvents(), ...to.pullEvents()] });
}).then(async (result) => {
  if (result.ok) {
    for (const ev of result.value.events) await this.events.publish(ev);
    return Result.ok(undefined);
  }
  return result;
});
```

Or simpler — let the use case return the events and let the controller
or decorator publish them.

## Read-only transactions

For consistent reads (rare), pass an option:

```ts
this.uow.run(async () => { /* ... */ }, { readonly: true });
```

Implement on the adapter by setting the connection's transaction mode.

## Saga vs single transaction

A single DB transaction does not span services. For workflows across
services use a **saga**:

- Each step publishes an event.
- Each subscriber executes its step in its own transaction.
- Failures publish a compensating event.

This is essentially the **Outbox pattern**: persist the event in the
same DB transaction, then a relay process publishes from the outbox to
the broker.

```ts
return this.uow.run(async () => {
  await this.accounts.save(from);
  await this.accounts.save(to);
  await this.outbox.append(new MoneyTransferred(/* ... */));
});
```

## Anti-patterns

- ❌ Decorators like `@Transactional()` on every service method —
  hides where transactions start and how long they hold locks.
- ❌ Two `uow.run` calls in one use case — the boundary is the use
  case, not the method.
- ❌ Mixing TypeORM `@Transaction()`, manual `dataSource.transaction()`,
  and a UoW — pick one.
- ❌ HTTP / queue calls inside `uow.run` — they hold DB connections
  hostage and rollback inconsistencies.
