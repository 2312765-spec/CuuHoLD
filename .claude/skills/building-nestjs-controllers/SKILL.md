---
name: building-nestjs-controllers
description: Builds thin NestJS controllers that parse input, invoke a single use case, and map the Result to ApiResponse<T>. Use when adding HTTP endpoints, refactoring fat controllers, or applying API versioning.
license: MIT
---

# Building NestJS Controllers

## When to use
- Adding HTTP endpoints
- Refactoring fat controllers
- Applying API versioning

## Core rules
1. Controllers are **thin**: only parse input, call one use-case, map Result to response
2. No business logic in controllers
3. Use `@Body()` DTO validation with `ValidationPipe`
4. Map `Result<T,E>` to `ApiResponse<T>` via helper
5. Use `@ApiTags()`, `@ApiOperation()` for Swagger

## Reference shape (TypeScript)

### Thin Controller
```typescript
@Controller('users')
@ApiTags('users')
export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    const result = await this.createUserUseCase.execute(dto);
    return result.success
      ? { success: true, data: result.value }
      : { success: false, error: { code: result.error.code, message: result.error.message } };
  }
}
```

## Examples — Do
```typescript
// Controller delegates to use-case
@Get(':id')
async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
  const result = await this.useCase.execute(id);
  return result.success ? { success: true, data: result.value } : { success: false, error: ... };
}
```

## Examples — Don't
```typescript
// ❌ Business logic in controller
@Post('order')
createOrder(@Body() body: any) {
  if (body.items.length === 0) return { error: 'Empty' }; // No!
  return this.db.save(body);
}
```

## Checklist
- [ ] Controller only parses input, calls use-case, maps response
- [ ] No business logic in controller
- [ ] DTO validation with ValidationPipe
- [ ] Result mapped to ApiResponse

See [reference/controller-patterns.md](./reference/controller-patterns.md) for full patterns.
