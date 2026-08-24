# class-validator cookbook

The full set of patterns the agent should recognize and apply when
adding/refactoring DTOs.

## Always-on global pipe

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors) => new ValidationError({ details: flatten(errors) }),
  }),
);
```

Map `ValidationError` to HTTP 400 in the global filter (see exceptions
skill).

## Common validators

```ts
import {
  IsBoolean, IsDate, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsObject,
  IsOptional, IsString, IsUrl, IsUUID,
  Length, Matches, Max, MaxLength, Min, MinLength,
  ArrayMaxSize, ArrayMinSize, ArrayUnique,
  ValidateIf, ValidateNested,
  IsLatitude, IsLongitude, IsPhoneNumber, IsISO8601,
} from 'class-validator';
import { Type, Transform, Expose } from 'class-transformer';
```

## Strings

```ts
@IsString() @MinLength(2) @MaxLength(120)
name!: string;

@IsString() @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case' })
slug!: string;

@IsEmail({ allow_display_name: false }) @MaxLength(254)
email!: string;

@IsUrl({ require_protocol: true, protocols: ['https'] })
homepage!: string;
```

## Numbers

```ts
@Type(() => Number)
@IsInt() @Min(1) @Max(100)
pageSize!: number;

@Type(() => Number)
@IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
amount!: number;
```

`@Type(() => Number)` is required when the value arrives as a string
(query parameters, headers).

## Booleans

```ts
@Transform(({ value }) => value === 'true' || value === true)
@IsBoolean()
includeArchived!: boolean;
```

## Dates

```ts
@Type(() => Date) @IsDate()
since!: Date;

@IsISO8601()       // pure string check, no transform
sinceIso!: string;
```

## Enums

```ts
export enum OrderStatus { Draft = 'draft', Confirmed = 'confirmed', Shipped = 'shipped' }

@IsEnum(OrderStatus)
status!: OrderStatus;
```

## Optional / nullable

```ts
@IsOptional()
@IsString() @MaxLength(120)
description?: string;
```

`@IsOptional()` short-circuits when the value is `null` or `undefined`.

For "must be present, may be null":

```ts
@ValidateIf((_o, v) => v !== null)
@IsString()
nickname!: string | null;
```

## Nested objects

```ts
export class AddressDto {
  @IsString() @MaxLength(120) street!: string;
  @IsString() @MaxLength(60)  city!: string;
  @IsString() @Length(2, 2)   countryCode!: string;
}

export class UserAddressUpdateDto {
  @ValidateNested() @Type(() => AddressDto)
  address!: AddressDto;
}
```

`@Type(() => Class)` is mandatory; without it `class-transformer` does
not instantiate the nested class and decorators don't run.

## Arrays

```ts
@IsString({ each: true })
@ArrayMinSize(1) @ArrayMaxSize(50)
@ArrayUnique()
tags!: string[];

@ValidateNested({ each: true })
@Type(() => OrderLineDto)
lines!: OrderLineDto[];
```

## Cross-field validation

```ts
import { ValidateIf } from 'class-validator';

export class DateRangeDto {
  @Type(() => Date) @IsDate()
  from!: Date;

  @Type(() => Date) @IsDate()
  @ValidateIf((o: DateRangeDto) => o.from !== undefined)
  @IsAfter('from', { message: 'to must be after from' })
  to!: Date;
}
```

For more complex rules, write a custom decorator (`@ValidatorConstraint`)
or validate in the use case (preferred when the rule is business).

## Custom decorator

```ts
import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsAfter(property: string, options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName: propertyName.toString(),
      constraints: [property],
      options,
      validator: {
        validate(value, args) {
          const other = (args.object as Record<string, unknown>)[args.constraints[0] as string];
          return value instanceof Date && other instanceof Date && value.getTime() > other.getTime();
        },
        defaultMessage(args) {
          return `${args.property} must be after ${args.constraints[0]}`;
        },
      },
    });
  };
}
```

## Mapped types

```ts
import { PartialType, PickType, OmitType, IntersectionType } from '@nestjs/mapped-types';

export class UpdateUserRequest extends PartialType(
  OmitType(RegisterUserRequest, ['password'] as const),
) {}

export class AdminCreateUserRequest extends IntersectionType(
  RegisterUserRequest,
  AdminFieldsDto,
) {}
```

## Response DTOs (Expose / Exclude)

If you reuse a class for a response, use `class-transformer` to project
only safe fields:

```ts
import { Expose, Exclude, plainToInstance } from 'class-transformer';

@Exclude()
export class UserResponse {
  @Expose() id!: string;
  @Expose() email!: string;
  @Expose() status!: 'pending' | 'active' | 'blocked';
  @Expose() @Type(() => Date) createdAt!: Date;
  // hashedPassword is NOT @Expose'd — never leaks
}

const safe = plainToInstance(UserResponse, ormRow, { excludeExtraneousValues: true });
```

Better: keep request DTOs and response DTOs as separate classes and
build response objects explicitly with a mapper.

## Error mapping

The pipe throws on the first failure with all errors collected. The
global filter formats them:

```ts
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "path": "email", "constraints": ["isEmail"] },
      { "path": "password", "constraints": ["minLength"] }
    ]
  }
}
```

## Anti-patterns

- ❌ Validating in the controller body manually.
- ❌ Mixing validation with business rules ("email must not exist" —
  belongs in the use case).
- ❌ Using `@IsOptional()` on every field then expecting them at runtime.
- ❌ Forgetting `@Type` on nested objects/dates/numbers.
- ❌ Using request DTO as response DTO.
