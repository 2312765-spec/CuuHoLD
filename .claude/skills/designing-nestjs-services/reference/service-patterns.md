# NestJS Service Patterns — Complete Reference

## Use-Case Class (Application Service)
```typescript
// src/user/application/use-cases/create-user.use-case.ts
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('UserRepository') private readonly userRepo: UserRepository,
    @Inject('PasswordHasher') private readonly hasher: PasswordHasher,
    @Inject('NotificationService') private readonly notifier: NotificationService
  ) {}

  async execute(dto: CreateUserDto): Promise<Result<User, AppError>> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) return err(new DuplicateUserError(dto.email));

    const email = Email.create(dto.email);
    const hashedPassword = await this.hasher.hash(dto.password);
    const user = User.create(dto.id, email, hashedPassword);

    await this.userRepo.save(user);
    await this.notifier.send(dto.email, 'Welcome!', `Account created.`);

    return ok(user);
  }
}
```

## Multiple Use-Cases for Same Entity
```typescript
// Each use-case has single responsibility
export class UpdateUserUseCase { ... }
export class DeleteUserUseCase { ... }
export class ChangeUserPasswordUseCase { ... }
export class AssignUserRoleUseCase { ... }
```

## Orchestrating Domain + Ports
```typescript
@Injectable()
export class SubmitOrderUseCase {
  constructor(
    @Inject('OrderRepository') private orderRepo: OrderRepository,
    @Inject('PaymentService') private paymentService: PaymentService,
    @Inject('InventoryService') private inventoryService: InventoryService
  ) {}

  async execute(orderId: string): Promise<Result<Order, AppError>> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) return err(new NotFoundError('Order', orderId));

    try {
      // Domain behavior
      order.submit();

      // Call ports
      await this.paymentService.charge(order.total, order.paymentToken);
      await this.inventoryService.reserve(order.items);

      // Persist
      await this.orderRepo.save(order);
      return ok(order);
    } catch (e) {
      return err(e as AppError);
    }
  }
}
```

## Application Service vs Domain Service
```typescript
// Domain service: stateless business logic in domain layer
export class PricingService {
  static calculateDiscount(base: number, discountPercent: number): number {
    return base * (1 - discountPercent / 100);
  }
}

// Application service: orchestration, depends on ports
@Injectable()
export class PriceOrderUseCase {
  execute(order: Order): void {
    const discounted = PricingService.calculateDiscount(order.total, 10);
    order.applyDiscount(discounted);
  }
}
```

## Module Registration
```typescript
// user.module.ts
@Module({
  providers: [
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    { provide: 'UserRepository', useClass: TypeOrmUserRepository },
    { provide: 'PasswordHasher', useClass: BcryptHasher },
  ],
  exports: [CreateUserUseCase, UpdateUserUseCase, DeleteUserUseCase],
})
export class UserModule {}
```
