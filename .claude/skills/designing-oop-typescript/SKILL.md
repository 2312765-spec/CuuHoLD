---
name: designing-oop-typescript
description: Designs classes and class hierarchies in TypeScript using SOLID, encapsulation, and immutability. Use when creating new domain entities, application services, or refactoring procedural code into OOP.
license: MIT
---

# Designing OOP TypeScript

## When to use
- Creating new domain entities or value objects
- Refactoring procedural code into OOP
- Designing class hierarchies with SOLID principles

## Core rules
1. Classes over functions: all behavior encapsulated in classes
2. Explicit access modifiers: `public`, `protected`, `private` always written
3. SRP: one responsibility per class, split when growing
4. Encapsulation: no public mutable fields, expose intent via methods
5. Immutability: value objects are readonly, entities use private state
6. SOLID: Single responsibility, Open/closed, Liskov, Interface segregation, Dependency inversion

## Reference shape (TypeScript)

### Domain Entity
```typescript
export class User {
  private constructor(
    private readonly _id: string,
    private _email: string,
    private _isActive: boolean
  ) {}

  static create(id: string, email: string): User {
    return new User(id, email, true);
  }

  get id(): string { return this._id; }
  get email(): string { return this._email; }

  deactivate(): void {
    if (!this._isActive) throw new BusinessError('ALREADY_INACTIVE', 'User already inactive');
    this._isActive = false;
  }
}
```

### Value Object
```typescript
export class Email {
  private constructor(private readonly value: string) {}

  static create(email: string): Email {
    if (!PATTERNS.EMAIL.test(email)) throw new ValidationError([{ field: 'email', message: 'Invalid' }]);
    return new Email(email.toLowerCase());
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
```

## Examples — Do
```typescript
class Order {
  private items: OrderItem[] = [];
  addItem(item: OrderItem): void { this.items.push(item); }
  get total(): number { return this.items.reduce((sum, i) => sum + i.price, 0); }
}
```

## Examples — Don't
```typescript
// ❌ Function module, no encapsulation
export function createUser(id: string, email: string) { return { id, email }; }
// ❌ Public mutable fields
class User { id: string; email: string; }
```

## Checklist
- [ ] Classes with explicit access modifiers
- [ ] No public mutable fields
- [ ] Value objects are immutable
- [ ] Entities encapsulate behavior
- [ ] SOLID principles applied

See [reference/oop-patterns.md](./reference/oop-patterns.md) for full patterns.
