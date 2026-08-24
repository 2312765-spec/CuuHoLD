# Project Layout Patterns — Complete Reference

## Standard Three-Layer Architecture

```
my-project/
├── src/
│   ├── domain/              # Enterprise/business rules
│   │   ├── entities/        # Domain entities with behavior
│   │   ├── value-objects/   # Immutable value objects
│   │   ├── services/        # Domain services (stateless business logic)
│   │   ├── events/          # Domain events
│   │   └── index.ts         # Barrel export
│   │
│   ├── application/         # Application use-cases
│   │   ├── use-cases/       # One class per business intent
│   │   ├── ports/           # Interfaces for infrastructure
│   │   ├── dtos/            # Input/output shapes
│   │   └── index.ts
│   │
│   ├── infrastructure/      # Frameworks, drivers, adapters
│   │   ├── repositories/    # ORM implementations of ports
│   │   ├── http/            # Controllers, middleware (if not NestJS)
│   │   ├── config/          # Configuration loading
│   │   ├── logging/         # Logger adapter
│   │   └── index.ts
│   │
│   ├── shared/              # Cross-cutting concerns
│   │   ├── types/           # ApiResponse<T>, Result<T,E>
│   │   ├── errors/          # AppError hierarchy
│   │   ├── contracts/       # Cross-feature interfaces
│   │   ├── constants/       # Global constants
│   │   └── index.ts
│   │
│   ├── features/            # Feature modules (large projects)
│   │   ├── user/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── index.ts
│   │   └── order/
│   │       └── (same structure)
│   │
│   └── main.ts              # Entry point, bootstrapping
```

## tsconfig.json Path Aliases

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"],
      "@application/*": ["src/application/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@shared/*": ["src/shared/*"],
      "@features/*": ["src/features/*"]
    }
  }
}
```

## Barrel File Pattern

Every folder has an `index.ts`:
```typescript
// src/domain/entities/index.ts
export { User } from './user.entity';
export { Order } from './order.entity';
export { Product } from './product.entity';
```

## Feature Module Pattern

```typescript
// src/features/user/index.ts
export { User } from './domain/entities/user.entity';
export { CreateUserUseCase } from './application/use-cases/create-user.use-case';
export { UserRepository } from './application/ports/user.repository';
```

## Import Rules

| From → To | Allowed? | Method |
|-----------|----------|--------|
| domain → * | ❌ No | Domain depends on nothing |
| application → domain | ✅ Yes | Direct import |
| application → infrastructure | ❌ No | Use ports (interfaces) |
| infrastructure → application | ✅ Yes | Implements ports |
| infrastructure → domain | ✅ Yes | Uses domain entities |
| feature A → feature B | ❌ No | Use `@shared/contracts` |
| any → shared | ✅ Yes | Direct import |
