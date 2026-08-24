---
name: designing-nestjs-services
description: Designs NestJS application services as use-case classes that orchestrate domain logic and ports without leaking the framework. Use when creating new use cases, refactoring services that mix HTTP/DB/domain, or moving from anemic services to OOP.
license: MIT
---

# Designing NestJS Services

## When to use
- Creating new use cases
- Refactoring services that mix HTTP/DB/domain
- Moving from anemic services to OOP

## Core rules
1. Application services are **use-case classes**, one per business intent
2. Services orchestrate domain + ports, no framework imports (no `@Injectable()` in domain)
3. Return `Result<T,E>` from use-cases, don't throw for expected failures
4. Dependencies injected via constructor
5. No HTTP/ORM imports in application services

## Reference shape (TypeScript)

### Use-Case Class
```typescript
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('UserRepository') private readonly repo: UserRepository,
    private readonly hasher: PasswordHasher
  ) {}

  async execute(dto: CreateUserDto): Promise<Result<User, AppError>> {
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) return err(new ConflictError(`User ${dto.email} already exists`));

    const user = User.create(dto.id, Email.create(dto.email));
    await this.repo.save(user);
    return ok(user);
  }
}
```

## Examples — Do
```typescript
// Single responsibility use-case
@Injectable()
export class SubmitOrderUseCase {
  constructor(
    @Inject('OrderRepository') private repo: OrderRepository,
    private paymentService: PaymentService
  ) {}
  async execute(orderId: string): Promise<Result<Order, AppError>> { ... }
}
```

## Examples — Don't
```typescript
// ❌ Anemic service with many methods
@Injectable()
export class UserService {
  create() { ... }
  update() { ... }
  delete() { ... }
  // Mixed responsibilities
}
// ❌ Framework leaking into application
import { InjectRepository } from '@nestjs/typeorm'; // Should be in infra
```

## Checklist
- [ ] Use-cases are single-responsibility classes
- [ ] Return `Result<T,E>`
- [ ] No framework imports in application layer
- [ ] Dependencies injected via constructor

See [reference/service-patterns.md](./reference/service-patterns.md) for full patterns.
