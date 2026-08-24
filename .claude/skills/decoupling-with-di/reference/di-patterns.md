# Dependency Injection Patterns — Complete Reference

## tsyringe Example

### Installation
```bash
npm install tsyringe reflect-metadata
```

### Port Definition
```typescript
// src/application/ports/user.repository.ts
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
```

### Adapter Implementation
```typescript
// src/infrastructure/repositories/typeorm-user.repository.ts
import { injectable } from 'tsyringe';

@injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private dataSource: DataSource) {}

  async findById(id: string): Promise<User | null> {
    const ormEntity = await this.dataSource.getRepository(UserOrmEntity).findOne({ where: { id } });
    return ormEntity ? this.toDomain(ormEntity) : null;
  }

  async save(user: User): Promise<User> {
    const ormEntity = this.toOrm(user);
    await this.dataSource.getRepository(UserOrmEntity).save(ormEntity);
    return user;
  }
}
```

### Use-Case (Consumer)
```typescript
// src/application/use-cases/create-user.use-case.ts
import { injectable, inject } from 'tsyringe';

@injectable()
export class CreateUserUseCase {
  constructor(
    @inject('UserRepository') private readonly userRepo: UserRepository,
    @inject('PasswordHasher') private readonly hasher: PasswordHasher
  ) {}

  async execute(dto: CreateUserDto): Promise<Result<User, AppError>> {
    // ...
  }
}
```

### Container Configuration
```typescript
// src/main.ts
import 'reflect-metadata';
import { container } from 'tsyringe';

container.register('UserRepository', { useClass: TypeOrmUserRepository });
container.register('PasswordHasher', { useClass: BcryptHasher });
container.register(CreateUserUseCase, { useClass: CreateUserUseCase });

const createUserUseCase = container.resolve(CreateUserUseCase);
```

## inversify Example

```typescript
import { Container, injectable, inject } from 'inversify';

const container = new Container();
container.bind<UserRepository>('UserRepository').to(TypeOrmUserRepository);
container.bind<CreateUserUseCase>(CreateUserUseCase).toSelf();

const useCase = container.get<CreateUserUseCase>(CreateUserUseCase);
```

## Manual DI (No Framework)

```typescript
// Simple manual wiring (good for small projects)
class AppContainer {
  private userRepo = new TypeOrmUserRepository(dataSource);
  private hasher = new BcryptHasher();
  private createUserUseCase = new CreateUserUseCase(this.userRepo, this.hasher);

  getCreateUserUseCase(): CreateUserUseCase {
    return this.createUserUseCase;
  }
}
```
