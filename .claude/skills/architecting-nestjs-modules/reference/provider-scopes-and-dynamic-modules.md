# Provider scopes & dynamic modules

## Provider scopes

NestJS supports three scopes:

| Scope | When | Use for |
|-------|------|---------|
| `DEFAULT` (singleton) | Created once at boot. | Stateless services, ports, repositories — **the default**. |
| `REQUEST` | New instance per incoming request. | Per-request state (current actor, transaction). Avoid; prefer `AsyncLocalStorage`. |
| `TRANSIENT` | New instance per consumer. | Builders, command-style classes. Rare. |

Setting scope:

```ts
@Injectable({ scope: Scope.REQUEST })
export class CurrentUserContext { /* ... */ }
```

### Caveats of `REQUEST` scope

- Any singleton that depends (transitively) on a `REQUEST`-scoped
  provider becomes `REQUEST`-scoped — performance overhead.
- Forces the entire dependency chain to be created per request.
- Often a smell: prefer `AsyncLocalStorage` to propagate request
  context without scope contagion.

```ts
import { AsyncLocalStorage } from 'node:async_hooks';

const requestContext = new AsyncLocalStorage<RequestContext>();

// Middleware
app.use((req, _res, next) => {
  requestContext.run({ requestId: req.context.requestId, actor: req.context.actor }, next);
});

// Anywhere in the call chain
const ctx = requestContext.getStore();
```

## Dynamic modules

When a module needs configuration at registration time (e.g., a
database URL, a feature flag, a service token), use a **dynamic
module** with `forRoot` / `forRootAsync` and optionally `forFeature`.

### `forRoot` — module-wide config

```ts
@Module({})
export class StripeModule {
  static forRoot(options: StripeModuleOptions): DynamicModule {
    return {
      module: StripeModule,
      providers: [
        { provide: STRIPE_OPTIONS, useValue: options },
        { provide: STRIPE_CLIENT, useFactory: (o: StripeModuleOptions) => new Stripe(o.apiKey, o.config), inject: [STRIPE_OPTIONS] },
      ],
      exports: [STRIPE_CLIENT],
      global: false,
    };
  }
}
```

Consume:

```ts
@Module({
  imports: [
    StripeModule.forRoot({
      apiKey: config.stripe.apiKey,
      config: { apiVersion: '2024-06-20', maxNetworkRetries: 2 },
    }),
  ],
})
export class AppModule {}
```

### `forRootAsync` — config from another provider

```ts
StripeModule.forRootAsync({
  imports: [ConfigModule],
  inject: ['AppConfig'],
  useFactory: (config: AppConfig): StripeModuleOptions => ({
    apiKey: config.payments.stripeApiKey,
    config: { apiVersion: '2024-06-20' },
  }),
})
```

This pattern decouples module wiring from how config is loaded.

### `forFeature` — per-entity registration

Used by TypeORM/Mongoose:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([UserOrm])],
  providers: [/* ... */],
})
export class UsersModule {}
```

`forFeature` registers entity-scoped repositories that the module's
providers can inject.

## Global modules

Mark a module `global: true` so its exports are available without
re-importing — useful for things consumed everywhere (logger, config).

```ts
@Module({})
@Global()
export class LoggerModule {
  static forRoot(opts: LoggerOptions): DynamicModule {
    return { module: LoggerModule, providers: [/* ... */], exports: [LOGGER], global: true };
  }
}
```

Use sparingly. Globals defeat module boundaries.

## Token convention

Always inject by `Symbol`, never by string:

```ts
export const STRIPE_CLIENT = Symbol('StripeClient');

constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}
```

Symbols prevent accidental collisions and make refactoring safer.

## Circular module imports

Two modules need each other → a third module owns the contract.

```diagram
Before:
UsersModule ◀──▶ OrdersModule

After:
UsersModule ─┐                  ┌─▶ OrdersModule
             ▼                  │
       SharedKernel (interfaces, events)
             ▲                  │
             └──────────────────┘
```

Or use **events** — `OrdersModule` publishes `OrderConfirmed`;
`UsersModule` subscribes. Neither imports the other.

## When you would `forwardRef`

Almost never. If you reach for `forwardRef`, the module graph is
broken. Refactor to remove the cycle.

## Testing dynamic modules

```ts
const moduleRef = await Test.createTestingModule({
  imports: [
    StripeModule.forRoot({ apiKey: 'sk_test_xxx', config: { apiVersion: '2024-06-20' } }),
  ],
}).compile();
```

Override the underlying client to a fake:

```ts
.overrideProvider(STRIPE_CLIENT).useValue(new FakeStripe())
```
