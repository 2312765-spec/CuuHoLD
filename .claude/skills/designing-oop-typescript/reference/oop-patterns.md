# OOP Patterns in TypeScript — Complete Reference

## SOLID Principles

### Single Responsibility (SRP)
Each class has one reason to change.
```typescript
// ❌ Wrong: multiple responsibilities
class User {
  save() { /* persistence */ }
  sendEmail() { /* notification */ }
}
// ✅ Right: split responsibilities
class User { /* domain logic only */ }
class UserRepository { save(user: User) { /* persistence */ } }
class UserNotifier { sendEmail(user: User) { /* notification */ } }
```

### Open/Closed (OCP)
Open for extension, closed for modification.
```typescript
interface PricingStrategy { calculate(base: number): number; }
class RegularPricing implements PricingStrategy {
  calculate(base: number): number { return base; }
}
class DiscountPricing implements PricingStrategy {
  constructor(private discount: number) {}
  calculate(base: number): number { return base - this.discount; }
}
```

### Liskov Substitution (LSP)
Subtypes must be substitutable for base types.
```typescript
abstract class Shape {
  abstract area(): number;
}
class Rectangle extends Shape {
  constructor(private width: number, private height: number) { super(); }
  area(): number { return this.width * this.height; }
}
```

### Interface Segregation (ISP)
Many specific interfaces > one general interface.
```typescript
// ❌ Wrong: fat interface
interface Worker { work(): void; eat(): void; sleep(): void; }
// ✅ Right: segregated
interface Workable { work(): void; }
interface Eatable { eat(): void; }
```

### Dependency Inversion (DIP)
Depend on abstractions, not concretions.
```typescript
// ✅ Right: depends on interface
class UserService {
  constructor(private readonly repo: UserRepository) {}
}
```

## Encapsulation Patterns

### Private Fields with Getters
```typescript
class BankAccount {
  private _balance: number = 0;
  get balance(): number { return this._balance; }
  deposit(amount: number): void {
    if (amount <= 0) throw new Error('Invalid amount');
    this._balance += amount;
  }
}
```

### Immutable Value Objects
```typescript
export class Money {
  private constructor(private readonly amount: number, private readonly currency: string) {}
  static create(amount: number, currency: string): Money {
    if (amount < 0) throw new Error('Negative amount');
    return new Money(amount, currency.toUpperCase());
  }
  add(other: Money): Money {
    if (this.currency !== other.currency) throw new Error('Currency mismatch');
    return Money.create(this.amount + other.amount, this.currency);
  }
}
```

## Factory Methods
```typescript
class Order {
  private constructor(private items: OrderItem[]) {}
  static createEmpty(): Order { return new Order([]); }
  static fromItems(items: OrderItem[]): Order { return new Order(items); }
}
```
