# Error Patterns — Complete Reference

## Full Error Hierarchy

```typescript
// src/shared/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BusinessError extends AppError {
  constructor(code: string, message: string, statusCode = 400) {
    super(code, message, statusCode);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(
    public readonly details: { field: string; message: string }[],
    message = 'Validation failed'
  ) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class InfrastructureError extends AppError {
  constructor(message: string, cause?: Error) {
    super('INFRASTRUCTURE_ERROR', message, 500, cause);
  }
}
```

## Mapping Errors to HTTP (Controller Layer)

```typescript
function mapErrorToResponse(error: AppError): ApiResponse {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error instanceof ValidationError && { details: error.details }),
    },
  };
}

// Usage in controller
const result = await useCase.execute(input);
if (!result.success) {
  return res.status(result.error.statusCode || 400).json(mapErrorToResponse(result.error));
}
```

## Try/Catch Best Practices

```typescript
// ✅ Right: distinguish expected vs unexpected
try {
  return await this.repo.save(entity);
} catch (e) {
  if (e instanceof AppError) return err(e); // Expected
  throw new InfrastructureError('DB save failed', e as Error); // Unexpected
}

// ❌ Wrong: catching everything blindly
try { ... } catch (e) { return err(e); } // Might swallow programmer errors
```

## Result vs Throw Decision Tree

| Situation | Use |
|-----------|-----|
| Business rule violation | Return `err(new BusinessError(...))` |
| Entity not found (expected) | Return `err(new NotFoundError(...))` |
| Invalid input (validation) | Return `err(new ValidationError(...))` |
| DB connection lost | Throw `InfrastructureError` |
| Null pointer / TypeError | Let it crash (don't catch) |
| Third-party API down | Throw `InfrastructureError` |
