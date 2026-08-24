# NestJS Exception Patterns — Complete Reference

## Global Exception Filter
```typescript
// src/infrastructure/http/filters/app-exception.filter.ts
import { ExceptionFilter, Catch, ArgumentsHost, Response } from '@nestjs/common';
import { AppError } from '@shared/errors/app-error';

@Catch(AppError)
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    const response = {
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        ...(exception instanceof ValidationError && { details: exception.details }),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        traceId: ctx.getRequest().traceId,
      },
    };

    res.status(exception.statusCode || 400).json(response);
  }
}
```

## Registering Global Filter
```typescript
// main.ts
import { AppExceptionFilter } from './infrastructure/http/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AppExceptionFilter());
  await app.listen(3000);
}
```

## Result to Response Helpers
```typescript
// src/shared/helpers/result-to-response.ts
import { Result, AppError } from '@shared';

export function toApiResponse<T>(result: Result<T, AppError>): ApiResponse<T> {
  return result.success
    ? { success: true, data: result.value }
    : { success: false, error: { code: result.error.code, message: result.error.message } };
}

export function throwIfError<T>(result: Result<T, AppError>): T {
  if (!result.success) throw result.error;
  return result.value;
}
```

## Controller Without Try/Catch
```typescript
@Controller('users')
export class UserController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly findUser: FindUserUseCase
  ) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    const result = await this.createUser.execute(dto);
    return toApiResponse(result); // Let filter handle errors
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
    const result = await this.findUser.execute(id);
    return toApiResponse(result);
  }
}
```

## Custom Error with Status Code
```typescript
// src/shared/errors/app-error.ts
export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} with id ${id} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(public details: { field: string; message: string }[]) {
    super('VALIDATION_ERROR', 'Validation failed', 400);
  }
}
```
