---
name: testing-nestjs-applications
description: Tests NestJS applications at unit, integration, and e2e levels using Test.createTestingModule and Supertest with hand-rolled fakes. Use when writing tests for use cases, controllers, or full HTTP flows.
license: MIT
---

# Testing NestJS Applications

## When to use
- Writing tests for use cases, controllers, or full HTTP flows
- Setting up test strategy for a NestJS feature
- Replacing mocks with hand-rolled fakes

## Core rules
1. Unit tests: domain entities with pure assertions (no NestJS testing module)
2. Use-cases tested with **hand-rolled fakes** (not jest.mock)
3. Integration tests: `Test.createTestingModule` with real or fake providers
4. E2E tests: Supertest against bootstrapped app
5. No `jest.mock` for internal modules; only for third-party if needed

## Reference shape (TypeScript)

### Unit Test (Domain Entity)
```typescript
import { User } from './user.entity';

describe('User', () => {
  it('creates with valid email', () => {
    const email = Email.create('test@example.com');
    const user = User.create('1', email);
    expect(user.id).toBe('1');
  });
});
```

### Integration Test (Use-Case with Fake)
```typescript
import { Test } from '@nestjs/testing';
import { CreateUserUseCase } from './create-user.use-case';
import { FakeUserRepository } from './fakes/fake-user.repository';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        { provide: 'UserRepository', useClass: FakeUserRepository },
      ],
    }).compile();
    useCase = module.get(CreateUserUseCase);
  });

  it('creates user', async () => {
    const result = await useCase.execute({ id: '1', email: 'test@example.com' });
    expect(result.success).toBe(true);
  });
});
```

## Examples — Do
```typescript
const module = await Test.createTestingModule({
  controllers: [UserController],
  providers: [CreateUserUseCase, { provide: 'UserRepository', useClass: FakeUserRepository }],
}).compile();
```

## Examples — Don't
```typescript
// ❌ jest.mock for internal modules
jest.mock('../../application/user.repository');
```

## Checklist
- [ ] Domain entities have unit tests
- [ ] Use-cases tested with hand-rolled fakes
- [ ] Integration tests with `Test.createTestingModule`
- [ ] E2E tests with Supertest

See [reference/test-patterns.md](./reference/test-patterns.md) for full patterns.
