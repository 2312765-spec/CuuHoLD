# Ports and Adapters (Hexagonal)

The structural model behind every skill in this pack. Once internalized,
DI, repositories, testing, and layering all follow.

## The metaphor

The application is a **hexagon**. Inside lives the domain and the use
cases. The outside world (HTTP, DB, queues, mailers, time, randomness)
plugs in through:

- **Ports** — interfaces *owned by the inside*, declaring what the
  application needs from the outside.
- **Adapters** — concrete classes *living outside* that implement a
  port using a specific technology.

```diagram
        ╭───────────────────────────────╮
HTTP ───▶│  Driving (inbound) adapters   │
        ╰──────────────┬────────────────╯
                       │  ports.in
                       ▼
        ╭───────────────────────────────╮
        │   Application (use cases)     │
        │ ╭───────────────────────────╮ │
        │ │       Domain              │ │
        │ ╰───────────────────────────╯ │
        ╰──────────────┬────────────────╯
                       │  ports.out
                       ▼
        ╭───────────────────────────────╮
        │ Driven (outbound) adapters    │──▶ DB, Queue, SDK, FS
        ╰───────────────────────────────╯
```

## Two flavors of port

| Direction | Examples | Interface declared by |
|-----------|----------|------------------------|
| **Driving (inbound)** | HTTP controller calls `RegisterUser`. CLI calls a use case. | The use case (its input/output types). |
| **Driven (outbound)** | Use case persists via `UserRepository`. | The use case / domain. |

## Folder layout per feature

```
src/users/
├── domain/              # entities, VOs, domain events, domain errors
├── application/
│   ├── ports/           # outbound interfaces only
│   │   ├── user-repository.ts
│   │   ├── password-hasher.ts
│   │   └── event-bus.ts
│   └── use-cases/       # one class per intent
│       ├── register-user.ts
│       └── activate-user.ts
└── infrastructure/
    ├── http/            # inbound adapter (NestJS controller, Express handler, ...)
    ├── persistence/     # outbound: SqlUserRepository
    ├── crypto/          # outbound: Argon2PasswordHasher
    └── events/          # outbound: NatsEventBus
```

## Port file convention

```ts
// users/application/ports/user-repository.ts
import type { Repository } from '@shared/contracts';
import type { User, UserId, Email } from '../../domain/index.js';

export interface UserRepository extends Repository<User, UserId> {
  findByEmail(email: Email): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
```

- One interface = one port.
- Every port file exports a `Symbol` token alongside the interface — the
  DI container binds against the symbol, not the interface.

## Driving adapter (HTTP)

```ts
// users/infrastructure/http/users.controller.ts
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly registerUser: RegisterUser) {}

  @Post()
  async register(@Body() body: RegisterUserRequest): Promise<UserResponse> {
    return unwrap(await this.registerUser.execute(body));
  }
}
```

The controller speaks HTTP and calls the use case. It does not know about
the DB, the hasher, or the event bus.

## Driven adapter (DB)

```ts
// users/infrastructure/persistence/sql-user-repository.ts
@Injectable()
export class SqlUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrm) private readonly repo: Repository<UserOrm>,
    private readonly mapper: UserMapper,
  ) {}
  /* implementation */
}
```

The adapter speaks SQL, the use case never imports it.

## Composition root binds them

```ts
@Module({
  controllers: [UsersController],
  providers: [
    RegisterUser,
    { provide: USER_REPOSITORY, useClass: SqlUserRepository },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: EVENT_BUS, useClass: NatsEventBus },
  ],
  exports: [RegisterUser],
})
export class UsersModule {}
```

## Why this shape pays off

- **Tests**: replace `SqlUserRepository` with `InMemoryUserRepository`
  in unit tests; replace `NatsEventBus` with `InMemoryEventBus`.
- **Vendor lock-in**: replace Stripe with Adyen by writing a new
  adapter; the use case is unchanged.
- **Refactors**: changing the DB schema does not bleed into business
  rules.
- **Onboarding**: a new dev can read `application/use-cases/` and
  understand business intent without reading SQL or Stripe SDK code.

## Smell list

- ❌ Use case imports anything from `infrastructure/`.
- ❌ Domain imports anything from `application/` or `infrastructure/`.
- ❌ Adapter holds business rules ("if order is over $100…").
- ❌ Two adapters need to talk to each other directly — they should go
  through a use case.
- ❌ A "shared kernel" with concrete classes; share **interfaces**, not
  implementations.

## Migration recipe (legacy → ports & adapters)

1. Pick one feature.
2. Identify the use cases (verbs the API exposes).
3. Extract a domain entity from existing data shapes.
4. For each external dependency the use case touches, declare a port.
5. Move the existing concrete code into an adapter implementing that
   port.
6. Wire it up at the composition root.
7. Add a unit test using in-memory adapters; delete the old
   integration-only test if covered.
8. Repeat for the next feature.
