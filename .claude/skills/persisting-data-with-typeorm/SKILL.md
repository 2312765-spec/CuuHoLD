---
name: persisting-data-with-typeorm
description: Implements the Repository pattern with TypeORM in NestJS so domain entities stay framework-free, ORM models live in infrastructure, and transactions are explicit. Use when adding persistence, refactoring leaky ORM usage, or handling transactions across aggregates.
license: MIT
---

# Persisting Data with TypeORM

## When to use
- Adding persistence to a feature
- Refactoring leaky ORM usage (entities with `@Entity()` in domain)
- Handling transactions across aggregates

## Core rules
1. Domain entities: **no ORM decorators**, live in `domain/`
2. ORM models (with `@Entity()`) live in `infrastructure/`
3. Repository port in `application/ports/`, TypeORM implementation in `infrastructure/`
4. Transactions explicit via `QueryRunner` or `@Transaction()` decorator
5. Map between domain entity ↔ ORM model in repository

## Reference shape (TypeScript)

### Domain Entity (No ORM)
```typescript
export class User {
  private constructor(private id: string, private email: Email) {}
  static create(id: string, email: Email): User { return new User(id, email); }
  getEmail(): Email { return this.email; }
}
```

### ORM Model (Infrastructure)
```typescript
@Entity('users')
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() email: string;

  @CreateDateColumn() createdAt: Date;
}
```

### Repository Implementation
```typescript
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(@InjectRepository(UserOrmEntity) private repo: Repository<UserOrmEntity>) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  private toDomain(entity: UserOrmEntity): User {
    return User.create(entity.id, Email.create(entity.email));
  }
}
```

## Examples — Don't
```typescript
// ❌ ORM in domain
@Entity() export class User { @PrimaryColumn() id: string; } // Wrong!
```

## Checklist
- [ ] Domain entities have no ORM decorators
- [ ] ORM models in infrastructure only
- [ ] Repository port in application, implementation in infra
- [ ] Mapping between domain ↔ ORM in repository

See [reference/typeorm-patterns.md](./reference/typeorm-patterns.md) for full patterns.
