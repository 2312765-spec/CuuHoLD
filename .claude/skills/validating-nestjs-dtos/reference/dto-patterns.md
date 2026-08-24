# NestJS DTO Patterns — Complete Reference

## Global Validation Pipe Setup
```typescript
// main.ts
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw on unknown properties
      transform: true, // Transform payload to DTO instance
      transformOptions: { enableImplicitConversion: true },
    })
  );

  await app.listen(3000);
}
```

## Basic DTO
```typescript
// src/application/dtos/create-user.dto.ts
import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;
}
```

## DTO with Nested Objects
```typescript
import { ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;
}

export class CreateOrderDto {
  @IsString()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
```

## Partial Update DTO
```typescript
import { PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  name?: string;
}
```

## Query DTO (for GET params)
```typescript
export class FindUsersQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  role?: string;
}
```

## Controller Usage
```typescript
@Controller('users')
export class UserController {
  @Post()
  async create(@Body() dto: CreateUserDto): Promise<ApiResponse<User>> {
    return toApiResponse(await this.createUserUseCase.execute(dto));
  }

  @Get()
  async findAll(@Query() query: FindUsersQueryDto): Promise<ApiResponse<Paginated<User>>> {
    return toApiResponse(await this.findUsersUseCase.execute(query));
  }
}
```
