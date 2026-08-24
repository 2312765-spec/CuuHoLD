# TypeORM Patterns — Complete Reference

## ORM Model (Infrastructure Layer)
```typescript
// src/user/infrastructure/orm-entities/user.orm-entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid') id: string;

  @Column({ unique: true }) email: string;

  @Column() passwordHash: string;

  @Column('simple-array') roles: string[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

## Domain Entity (No ORM)
```typescript
// src/user/domain/entities/user.entity.ts
export class User {
  private constructor(
    private readonly id: string,
    private email: Email,
    private passwordHash: string,
    private roles: string[]
  ) {}

  static create(id: string, email: Email, passwordHash: string): User {
    return new User(id, email, passwordHash, ['user']);
  }

  getEmail(): Email { return this.email; }
  getRoles(): readonly string[] { return [...this.roles]; }

  addRole(role: string): void {
    if (!this.roles.includes(role)) this.roles.push(role);
  }
}
```

## Repository Port (Application Layer)
```typescript
// src/user/application/ports/user.repository.ts
import { Repository } from '@shared/types/repository.types';

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
}
```

## Repository Implementation (Infrastructure)
```typescript
// src/user/infrastructure/repositories/typeorm-user.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from '../../application/ports/user.repository';
import { User } from '../../domain/entities/user.entity';
import { UserOrmEntity } from '../orm-entities/user.orm-entity';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repo: Repository<UserOrmEntity>
  ) {}

  async findById(id: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const entity = await this.repo.findOne({ where: { email } });
    return entity ? this.toDomain(entity) : null;
  }

  async save(user: User): Promise<User> {
    const entity = this.toOrm(user);
    await this.repo.save(entity);
    return user;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return result.affected > 0;
  }

  private toDomain(entity: UserOrmEntity): User {
    return User.create(entity.id, Email.create(entity.email), entity.passwordHash);
  }

  private toOrm(domain: User): UserOrmEntity {
    const entity = new UserOrmEntity();
    entity.id = domain['id'];
    entity.email = domain.getEmail().value;
    entity.passwordHash = domain['passwordHash'];
    entity.roles = [...domain.getRoles()];
    return entity;
  }
}
```

## Transactions
```typescript
// Using QueryRunner for explicit transactions
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Inject('OrderRepository') private orderRepo: OrderRepository
  ) {}

  async execute(dto: CreateOrderDto): Promise<Result<Order, AppError>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = Order.create(dto.userId, dto.items);
      await queryRunner.manager.save(order);
      await queryRunner.commitTransaction();
      return ok(order);
    } catch (e) {
      await queryRunner.rollbackTransaction();
      return err(e as AppError);
    } finally {
      await queryRunner.release();
    }
  }
}
```

## Module Registration
```typescript
// user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity])],
  providers: [
    CreateUserUseCase,
    { provide: 'UserRepository', useClass: TypeOrmUserRepository },
  ],
  exports: ['UserRepository'],
})
export class UserModule {}
```
