# NestJS Test Patterns — Complete Reference

## Hand-rolled Fake Repository
```typescript
// src/user/application/fakes/fake-user.repository.ts
import { UserRepository } from '../ports/user.repository';
import { User } from '../../domain/entities/user.entity';

export class FakeUserRepository implements UserRepository {
  private users: User[] = [];

  async findById(id: string): Promise<User | null> {
    return this.users.find(u => u['id'] === id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find(u => u.getEmail().value === email) || null;
  }

  async save(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }

  async deleteById(id: string): Promise<boolean> {
    const length = this.users.length;
    this.users = this.users.filter(u => u['id'] !== id);
    return this.users.length < length;
  }
}
```

## Integration Test (Use-Case)
```typescript
import { Test } from '@nestjs/testing';
import { CreateUserUseCase } from '../create-user.use-case';
import { FakeUserRepository } from '../fakes/fake-user.repository';
import { Email } from '../../domain/value-objects/email.vo';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let fakeRepo: FakeUserRepository;

  beforeEach(async () => {
    fakeRepo = new FakeUserRepository();
    const module = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        { provide: 'UserRepository', useValue: fakeRepo },
      ],
    }).compile();
    useCase = module.get(CreateUserUseCase);
  });

  it('creates user successfully', async () => {
    const result = await useCase.execute({
      id: '1',
      email: 'test@example.com',
      password: 'password123456',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.id).toBe('1');
    }
  });

  it('returns error for duplicate email', async () => {
    await fakeRepo.save(
      (await import('../../domain/entities/user.entity')).User.create('1', Email.create('test@example.com'))
    );

    const result = await useCase.execute({
      id: '2',
      email: 'test@example.com',
      password: 'password123456',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DUPLICATE_USER');
    }
  });
});
```

## E2E Test (Supertest)
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { FakeUserRepository } from '../../user/application/fakes/fake-user.repository';

describe('User E2E', () => {
  let app: INestApplication;
  let fakeRepo: FakeUserRepository;

  beforeAll(async () => {
    fakeRepo = new FakeUserRepository();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('UserRepository')
      .useValue(fakeRepo)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  it('POST /users creates user', async () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'test@example.com', password: 'password123456' })
      .expect(201)
      .expect(res => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.email).toBe('test@example.com');
      });
  });
});
```

## Unit Test (Domain Entity)
```typescript
import { User } from '../domain/entities/user.entity';
import { Email } from '../domain/value-objects/email.vo';

describe('User', () => {
  it('creates with valid email', () => {
    const email = Email.create('test@example.com');
    const user = User.create('1', email);
    expect(user['id']).toBe('1');
    expect(user.getEmail()).toBe(email);
  });

  it('deactivates user', () => {
    const user = User.create('1', Email.create('test@example.com'));
    user.deactivate();
    expect(user['isActive']).toBe(false);
  });

  it('throws on double deactivate', () => {
    const user = User.create('1', Email.create('test@example.com'));
    user.deactivate();
    expect(() => user.deactivate()).toThrow();
  });
});
```

## Test Configuration (Jest)
```typescript
// jest.config.ts
export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.test\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```
