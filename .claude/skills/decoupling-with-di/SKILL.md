---
name: decoupling-with-di
description: Decouples modules using ports, adapters, and a DI container (tsyringe / inversify / NestJS). Use when wiring services, removing direct imports of concrete classes, or breaking circular dependencies.
license: MIT
---

# Decoupling with DI

## When to use
- Wiring services and repositories
- Removing direct imports of concrete classes
- Breaking circular dependencies
- Switching DI containers

## Core rules
1. Domain/application declare **ports** (interfaces), infrastructure implements them
2. Classes receive collaborators via **constructor injection**
3. No direct imports of concrete classes across layers
4. Use DI container (tsyringe, inversify, or NestJS built-in)
5. Layer dependency: `infrastructure → application → domain`

## Reference shape (TypeScript)

### Port (Interface in Application Layer)
```typescript
// src/application/ports/user.repository.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

### Adapter (Implementation in Infrastructure)
```typescript
// src/infrastructure/repositories/typeorm-user.repository.ts
@injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private ormRepo: Repository<UserOrmEntity>) {}

  async findById(id: string): Promise<User | null> { /* ... */ }
  async save(user: User): Promise<User> { /* ... */ }
}
```

### Consumer (Use-Case)
```typescript
// src/application/use-cases/create-user.use-case.ts
@injectable()
export class CreateUserUseCase {
  constructor(@inject('UserRepository') private readonly repo: UserRepository) {}
}
```

## Examples — Do
```typescript
// Decoupled: depends on interface
class OrderService {
  constructor(private readonly repo: OrderRepository) {}
}
```

## Examples — Don't
```typescript
// ❌ Direct import of concrete class
import { TypeOrmOrderRepository } from '../infrastructure/typeorm-order.repository';
class OrderService {
  private repo = new TypeOrmOrderRepository(); // Hard-wired
}
```

## Checklist
- [ ] Ports (interfaces) defined in application/domain
- [ ] Adapters implement ports in infrastructure
- [ ] All dependencies injected via constructor
- [ ] No concrete imports across layers
- [ ] DI container configured

See [reference/di-patterns.md](./reference/di-patterns.md) for full patterns.
