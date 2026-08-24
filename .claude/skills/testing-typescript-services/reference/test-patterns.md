# Test Patterns — Complete Reference

## Hand-rolled Fakes

### Fake Repository
```typescript
export class FakeUserRepository implements UserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.email.value === email) || null;
  }

  async save(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }

  async deleteById(id: string): Promise<boolean> {
    const initialLength = this.users.length;
    this.users = this.users.filter(u => u.id !== id);
    return this.users.length < initialLength;
  }
}
```

### Fake Logger
```typescript
export class FakeLogger implements Logger {
  public logs: { level: string; message: string; meta?: Record<string, unknown> }[] = [];

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'error', message, meta });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: 'debug', message, meta });
  }
}
```

## Unit Test Example (Vitest)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { User } from '../domain/entities/user.entity';
import { Email } from '../domain/value-objects/email.vo';
import { CreateUserUseCase } from './create-user.use-case';
import { FakeUserRepository } from './fakes/fake-user.repository';

describe('CreateUserUseCase', () => {
  let repo: FakeUserRepository;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    repo = new FakeUserRepository();
    useCase = new CreateUserUseCase(repo);
  });

  it('creates user successfully', async () => {
    const result = await useCase.execute({
      id: '1',
      email: 'test@example.com',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe('1');
      expect(result.value.email.value).toBe('test@example.com');
    }
  });

  it('returns error for duplicate email', async () => {
    await repo.save(User.create('1', Email.create('test@example.com')));

    const result = await useCase.execute({
      id: '2',
      email: 'test@example.com',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DUPLICATE_USER');
    }
  });
});
```

## Contract Test (Ensure Adapter Satisfies Port)
```typescript
import { describe, it, expect } from 'vitest';
import { UserRepository } from '../application/ports/user.repository';
import { TypeOrmUserRepository } from '../infrastructure/repositories/typeorm-user.repository';

function runRepositoryContractTests(createRepo: () => UserRepository) {
  describe('Repository contract', () => {
    it('saves and finds by id', async () => {
      const repo = createRepo();
      const user = User.create('1', Email.create('test@example.com'));
      await repo.save(user);

      const found = await repo.findById('1');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('1');
    });
  });
}

// Run with real adapter
runRepositoryContractTests(() => new TypeOrmUserRepository(testDataSource));
```

## Integration Test (Infrastructure)
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { TypeOrmUserRepository } from './typeorm-user.repository';

describe('TypeOrmUserRepository', () => {
  let dataSource: DataSource;
  let repo: TypeOrmUserRepository;

  beforeAll(async () => {
    dataSource = new DataSource({ /* test db config */ });
    await dataSource.initialize();
    repo = new TypeOrmUserRepository(dataSource);
  });

  afterAll(async () => await dataSource.destroy());

  it('saves and retrieves user', async () => {
    const user = User.create('1', Email.create('test@example.com'));
    await repo.save(user);

    const found = await repo.findById('1');
    expect(found).not.toBeNull();
  });
});
```

## Test Configuration (Vitest)
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    globals: true,
    environment: 'node',
  },
});
```
