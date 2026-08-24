---
name: validating-nestjs-dtos
description: Validates NestJS request payloads with class-validator and class-transformer using a global ValidationPipe. Use when adding/refactoring DTOs, hardening boundary input, or removing manual validation from controllers.
license: MIT
---

# Validating NestJS DTOs

## When to use
- Adding or refactoring DTOs
- Hardening boundary input
- Removing manual validation from controllers

## Core rules
1. Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`
2. DTOs use `class-validator` decorators: `@IsEmail()`, `@IsString()`, `@MinLength()`
3. Use `@Type()` from class-transformer for type conversion
4. No manual validation in controllers
5. DTOs in `application/dtos/` folder

## Reference shape (TypeScript)

### DTO with class-validator
```typescript
import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;

  @IsEnum(['user', 'admin'])
  role: string;
}
```

### Global ValidationPipe
```typescript
// main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  })
);
```

## Examples — Do
```typescript
@Post()
async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
  return toApiResponse(await this.useCase.execute(dto)); // No manual validation
}
```

## Examples — Don't
```typescript
// ❌ Manual validation in controller
@Post()
create(@Body() body: any) {
  if (!body.email) return { error: 'Email required' }; // No!
}
```

## Checklist
- [ ] Global ValidationPipe configured
- [ ] DTOs with class-validator decorators
- [ ] No manual validation in controllers
- [ ] DTOs in application/dtos folder

See [reference/dto-patterns.md](./reference/dto-patterns.md) for full patterns.
