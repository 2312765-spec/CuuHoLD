# Clean Architecture (applied)

The dependency rule: **source code dependencies point inward only**.
Outer layers know about inner layers; inner layers know nothing about
outer layers.

```diagram
        ╭───────────────────────────────────────────╮
        │  Frameworks & drivers (HTTP, DB, queue)   │
        │  ╭───────────────────────────────────────╮ │
        │  │  Interface adapters (controllers,    │ │
        │  │  presenters, repositories)           │ │
        │  │  ╭─────────────────────────────────╮ │ │
        │  │  │  Application (use cases)        │ │ │
        │  │  │  ╭───────────────────────────╮  │ │ │
        │  │  │  │  Domain (entities, VOs)   │  │ │ │
        │  │  │  ╰───────────────────────────╯  │ │ │
        │  │  ╰─────────────────────────────────╯ │ │
        │  ╰───────────────────────────────────────╯ │
        ╰───────────────────────────────────────────╯
                  Dependencies point ───▶ inward
```

## Layer responsibilities

| Layer | Knows about | Lifecycle |
|-------|-------------|-----------|
| **Domain** | Itself only. Pure TypeScript. | Stable: changes only when business rules change. |
| **Application** | Domain. Defines ports. | Changes per use case. |
| **Interface adapters** | Application + domain. Implements ports. | Changes when the transport / persistence tech changes. |
| **Frameworks & drivers** | All inner layers. The "main" of NestJS / Fastify / Express. | Changes when the deployment platform changes. |

## What goes where

### Domain (`src/<feature>/domain/`)

- Entities, value objects, domain events, domain errors.
- Domain services (rules that span multiple entities, e.g.,
  `LimitChecker`).
- **Allowed imports**: only from this folder.

### Application (`src/<feature>/application/`)

- Use cases (one class per intent).
- Ports (interfaces): `UserRepository`, `EventBus`, `Clock`, etc.
- DTOs that are *internal to the use case* (input/output types).
- **Allowed imports**: domain.

### Interface adapters (`src/<feature>/infrastructure/`)

- HTTP controllers, gRPC handlers, GraphQL resolvers, CLI commands.
- ORM repositories, mappers.
- 3rd-party SDK adapters.
- Domain-event consumers (queue subscribers).
- **Allowed imports**: domain + application.

### Frameworks & drivers

- `main.ts`, `app.module.ts`, `bootstrap.ts`.
- Framework configuration (NestJS / Fastify / Express).
- **Allowed imports**: everything.

## The most important rule

```diagram
              "I am a use case."
                      │
                      ▼
   ┌────────────────────────────────────┐
   │ I cannot import from a controller. │
   │ I cannot import from a repository. │
   │ I cannot import from an SDK.       │
   └────────────────────────────────────┘
                      │
                      ▼
       I import only domain + ports.
```

If a use case imports `@nestjs/common`, `typeorm`, `axios`, `pg`,
`stripe`, etc., the architecture is broken.

## Mapping data across boundaries

Every layer has its own data shape:

| Layer | Data shape | Why separate |
|-------|------------|--------------|
| HTTP | Request/Response DTO | Driven by the API contract. |
| Application | Use case input/output | Driven by the intent. |
| Domain | Entity / Value Object | Driven by invariants. |
| Persistence | ORM entity (`UserOrm`) | Driven by the schema. |

Mappers translate at each step. Yes, that means types repeat. The
benefit: changing the DB schema does not force a change to the HTTP
shape.

## Anemic vs rich domain

| Anemic | Rich |
|--------|------|
| `User { id, email, status }` and a service that mutates status. | `User.activate()` enforces invariants on `User`. |
| Logic scattered across services. | Logic concentrated on the entity that owns the data. |

Aim for **rich domain**: entities expose intent, not state setters.

## When you can skip layers

Yes, sometimes:

- A read-only endpoint that returns precomputed data may go from
  controller straight to a query repository (no use case, no domain
  rule).
- Document this as **CQRS — Query side**. Don't allow it on writes.

## Smell list

- ❌ A controller that returns the ORM entity directly.
- ❌ A use case with `@Body()`, `@Req()`, or HTTP status codes inside.
- ❌ A domain entity with `@Entity` (TypeORM), `@Schema` (Mongoose),
  `@Injectable`, `@Column`, etc.
- ❌ The `application/` folder has files that import from
  `infrastructure/`.
- ❌ A "shared kernel" module that exports concrete classes between
  features.

## Lint to enforce

```js
'import/no-restricted-paths': ['error', {
  zones: [
    { target: 'src/*/domain', from: 'src/*/infrastructure' },
    { target: 'src/*/domain', from: 'src/*/application' },
    { target: 'src/*/application', from: 'src/*/infrastructure' },
  ],
}]
```
