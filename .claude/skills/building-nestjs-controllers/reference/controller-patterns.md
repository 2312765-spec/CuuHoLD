# NestJS Controller Patterns — Complete Reference

## Thin Controller Example
```typescript
@Controller('users')
@ApiTags('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findUserUseCase: FindUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiCreatedResponse({ type: User })
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    const result = await this.createUserUseCase.execute(dto);
    if (result.success) {
      return { success: true, data: result.value };
    }
    return {
      success: false,
      error: { code: result.error.code, message: result.error.message },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find user by ID' })
  async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
    const result = await this.findUserUseCase.execute(id);
    return result.success
      ? { success: true, data: result.value }
      : { success: false, error: { code: result.error.code, message: result.error.message } };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.deleteUserUseCase.execute(id);
    if (!result.success) {
      throw new HttpException({ code: result.error.code, message: result.error.message }, result.error.statusCode);
    }
  }
}
```

## Result to ApiResponse Helper
```typescript
// src/shared/helpers/result-to-response.ts
import { ApiResponse } from '../types/api.types';

export function toApiResponse<T>(result: Result<T, AppError>): ApiResponse<T> {
  return result.success
    ? { success: true, data: result.value }
    : { success: false, error: { code: result.error.code, message: result.error.message } };
}

// Usage in controller
@Get(':id')
async findOne(@Param('id') id: string): Promise<ApiResponse<User>> {
  const result = await this.findUserUseCase.execute(id);
  return toApiResponse(result);
}
```

## API Versioning
```typescript
// main.ts
app.enableVersioning({ type: VersioningType.URI });

// Controller with version
@Controller({ path: 'users', version: '1' })
export class UserV1Controller {}

@Controller({ path: 'users', version: '2' })
export class UserV2Controller {}
```

## DTO with class-validator
```typescript
// src/application/dtos/create-user.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  password: string;
}
```
