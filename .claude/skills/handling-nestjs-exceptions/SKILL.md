---
name: handling-nestjs-exceptions
description: Maps internal AppError hierarchy to HTTP responses through a single global exception filter and a Result-to-HttpException helper. Use when adding new error types, fixing inconsistent error responses, or removing scattered try/catch in controllers.
license: MIT
---

# Handling NestJS Exceptions

## When to use
- Adding new error types
- Fixing inconsistent error responses
- Removing scattered try/catch in controllers

## Core rules
1. Single **global exception filter** catches all `AppError` subclasses
2. `Result<T,E>` mapped to HTTP via helper, not scattered try/catch
3. All errors extend `AppError` with `statusCode`
4. No `try/catch` in controllers; let exceptions bubble to filter

## Reference shape (TypeScript)

### Global Exception Filter
```typescript
@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    res.status(exception.statusCode || 400).json({
      success: false,
      error: { code: exception.code, message: exception.message },
    });
  }
}
```

### Result to HttpException Helper
```typescript
export function resultToHttp<T>(result: Result<T, AppError>): T {
  if (!result.success) throw result.error; // Let filter handle
  return result.value;
}
```

## Examples — Do
```typescript
// Controller: no try/catch, use helper
@Get(':id')
async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
  const result = await this.useCase.execute(id);
  return toApiResponse(result); // Helper handles mapping
}
```

## Examples — Don't
```typescript
// ❌ Scattered try/catch in controllers
try { ... } catch (e) { return res.status(400).json({ error: e.message }); }
```

## Checklist
- [ ] Global exception filter catches `AppError`
- [ ] `Result<T,E>` mapped via helper
- [ ] No try/catch in controllers
- [ ] All errors have `statusCode`

See [reference/exception-patterns.md](./reference/exception-patterns.md) for full patterns.
