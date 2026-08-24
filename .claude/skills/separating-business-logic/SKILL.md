---
name: separating-business-logic
description: Separates code into domain, application, and infrastructure layers so business rules stay framework-free and testable. Use when designing a new feature, splitting a god service, or moving rules out of controllers.
license: MIT
---

# Separating Business Logic

## When to use
- Designing a new feature from scratch
- Splitting a god service into layers
- Moving business rules out of controllers or infrastructure

## Core rules
1. **Domain layer**: Pure business rules, no framework, no I/O, no `console.log`
2. **Application layer**: Use-cases orchestrate domain + ports, no HTTP/DB direct
3. **Infrastructure layer**: Adapters for HTTP, DB, 3rd-party, implements ports
4. Controllers/handlers: only parse input, call one use-case, map Result to response
5. Domain entities contain invariants (rules that must always hold) and behavior

## Reference shape (TypeScript)

### Domain Entity
```typescript
export class Order {
  private constructor(
    private readonly _id: string,
    private _items: OrderItem[],
    private _status: OrderStatus
  ) {}

  addItem(item: OrderItem): void {
    if (this._status !== 'draft') throw new BusinessError('INVALID_STATE', 'Cannot modify non-draft order');
    this._items.push(item);
  }

  submit(): void {
    if (this._items.length === 0) throw new BusinessError('EMPTY_ORDER', 'Cannot submit empty order');
    this._status = 'submitted';
  }
}
```

### Application Use-Case
```typescript
export class SubmitOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentService: PaymentService
  ) {}

  async execute(orderId: string): Promise<Result<Order, AppError>> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) return err(new NotFoundError('Order', orderId));
    try {
      order.submit();
      await this.orderRepo.save(order);
      return ok(order);
    } catch (e) {
      return err(e as AppError);
    }
  }
}
```

## Examples — Don't
```typescript
// ❌ Controller with business logic
@Post('order')
createOrder(@Body() body: any) {
  if (body.items.length === 0) return { error: 'Empty' }; // Business rule in controller!
  return this.db.save(body);
}
```

## Checklist
- [ ] Domain has no imports from infra or framework
- [ ] Use-cases return `Result<T,E>`
- [ ] Controllers only parse, call use-case, map response
- [ ] Infrastructure implements ports, not vice versa

See [reference/layer-examples.md](./reference/layer-examples.md) for full examples.
