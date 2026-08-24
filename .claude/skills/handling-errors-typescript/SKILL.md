---
name: handling-errors-typescript
description: Defines a typed error hierarchy, distinguishes expected business failures from unexpected programmer errors, and forbids swallowing errors. Use when creating new error types, mapping errors to HTTP, or reviewing try/catch usage.
license: MIT
---

# Handling Errors TypeScript

## When to use
- Creating new error types for a feature
- Mapping internal errors to HTTP responses
- Reviewing try/catch usage to eliminate swallowed errors

## Core rules
1. All errors extend `AppError` base class
2. Expected business failures: return `Result<T,E>` (don't throw)
3. Unexpected errors (programmer errors, infra outages): throw only these
4. Never swallow errors: no empty `catch`, no `console.log(e)`
5. All `catch` blocks must handle or rethrow explicitly
6. Error types: `BusinessError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `InfrastructureError`

## Reference shape (TypeScript)

### AppError Hierarchy
```typescript
export class AppError extends Error {
  constructor(public readonly code: string, public readonly message: string, public readonly statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
  }
}
```

### Result Pattern (Expected Failures)
```typescript
// Use-case returns Result, doesn't throw for business failures
async execute(id: string): Promise<Result<User, NotFoundError>> {
  const user = await this.repo.findById(id);
  return user ? ok(user) : err(new NotFoundError('User', id));
}
```

## Examples — Do
```typescript
try {
  await this.paymentService.charge(order);
} catch (e) {
  if (e instanceof InfrastructureError) throw e; // Unexpected, rethrow
  return err(e as AppError); // Expected business failure
}
```

## Examples — Don't
```typescript
// ❌ Swallowing errors
try { ... } catch (e) { console.log(e); }
// ❌ Throwing for expected business failures
if (!user) throw new NotFoundError('User', id);
```

## Checklist
- [ ] All errors extend `AppError`
- [ ] Use-cases return `Result<T,E>` for expected failures
- [ ] No swallowed errors
- [ ] `catch` blocks handle or rethrow explicitly

See [reference/error-patterns.md](./reference/error-patterns.md) for full patterns.
