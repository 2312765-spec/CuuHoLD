# Layer Examples — Complete Reference

## Domain Layer (Pure Business Rules)

```typescript
// src/domain/entities/user.entity.ts
export class User {
  private constructor(
    private readonly _id: string,
    private _email: Email,
    private _isActive: boolean,
    private _roles: Role[]
  ) {}

  static create(id: string, email: Email): User {
    return new User(id, email, true, ['user']);
  }

  assignRole(role: Role): void {
    if (this._roles.includes(role)) throw new BusinessError('ROLE_EXISTS', `User already has role ${role}`);
    this._roles.push(role);
  }

  deactivate(): void {
    if (!this._isActive) throw new BusinessError('ALREADY_INACTIVE', 'User already inactive');
    this._isActive = false;
  }

  get id(): string { return this._id; }
  get email(): Email { return this._email; }
  get isActive(): boolean { return this._isActive; }
  get roles(): readonly Role[] { return Object.freeze([...this._roles]); }
}
```

## Application Layer (Use-Cases)

```typescript
// src/application/use-cases/create-user.use-case.ts
export class CreateUserUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly notifier: NotificationService
  ) {}

  async execute(input: CreateUserDto): Promise<Result<User, AppError>> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) return err(new DuplicateUserError(input.email));

    const email = Email.create(input.email);
    const user = User.create(input.id, email);
    const hashedPassword = await this.hasher.hash(input.password);

    await this.userRepo.save(user);
    await this.notifier.send(input.email, 'Welcome!', `Your account ${input.email} was created.`);

    return ok(user);
  }
}
```

## Infrastructure Layer (Adapters)

```typescript
// src/infrastructure/repositories/typeorm-user.repository.ts
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findById(id: string): Promise<User | null> {
    const ormEntity = await this.dataSource.getRepository(UserOrmEntity).findOne({ where: { id } });
    return ormEntity ? this.toDomain(ormEntity) : null;
  }

  async save(user: User): Promise<User> {
    const ormEntity = this.toOrm(user);
    await this.dataSource.getRepository(UserOrmEntity).save(ormEntity);
    return user;
  }

  private toDomain(orm: UserOrmEntity): User {
    return User.create(orm.id, Email.create(orm.email));
  }

  private toOrm(domain: User): UserOrmEntity {
    const entity = new UserOrmEntity();
    entity.id = domain.id;
    entity.email = domain.email.value;
    return entity;
  }
}
```

## Controller (Thin — No Business Logic)

```typescript
// src/infrastructure/http/controllers/user.controller.ts
export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  async createUser(req: Request, res: Response): Promise<Response> {
    const dto = CreateUserDto.fromRequest(req.body);
    const result = await this.createUserUseCase.execute(dto);

    if (!result.success) {
      return res.status(400).json({ success: false, error: { code: result.error.code, message: result.error.message } });
    }

    return res.status(201).json({ success: true, data: result.value });
  }
}
```
