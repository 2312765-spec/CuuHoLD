---
name: testing-typescript-services
description: Writes unit, integration, and contract tests for TypeScript services using Vitest/Jest with hand-rolled fakes. Use when adding tests, refactoring untestable code, or designing the test strategy for a feature.
license: MIT
---

# Testing TypeScript Services

## When to use
- Adding tests for services or use-cases
- Refactoring untestable code
- Designing the test strategy for a feature

## Core rules
1. Unit tests for domain entities and value objects (no mocks, pure assertions)
2. Use-cases tested with **hand-rolled fakes** (not jest.mock)
3. Integration tests for infrastructure adapters (real or test DB)
4. Contract tests for ports (ensure adapters satisfy interface)
5. No test logic in production code; no `if (process.env.NODE_ENV === 'test')`

## Reference shape (TypeScript)

### Fake Repository (Hand-rolled)
```typescript
class FakeUserRepository implements UserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find(u => u.id === id) || null;
  }

  async save(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }
}
```

### Unit Test (Vitest)
```typescript
import { describe, it, expect } from 'vitest';
import { User } from './user.entity';

describe('User', () => {
  it('creates user with valid email', () => {
    const email = Email.create('test@example.com');
    const user = User.create('1', email);
    expect(user.id).toBe('1');
    expect(user.email.value).toBe('test@example.com');
  });
});
```

## Examples — Do
```typescript
// Use-case test with fake
const fakeRepo = new FakeUserRepository();
const useCase = new CreateUserUseCase(fakeRepo);
```

## Examples — Don't
```typescript
// ❌ jest.mock for internal modules
jest.mock('../../infrastructure/user.repository');
// ❌ Test logic in production code
if (process.env.NODE_ENV === 'test') { ... }
```

## Checklist
- [ ] Domain entities have unit tests
- [ ] Use-cases tested with hand-rolled fakes
- [ ] Integration tests for infrastructure
- [ ] Contract tests for ports

See [reference/test-patterns.md](./reference/test-patterns.md) for full patterns.
