# API versioning & OpenAPI

## Versioning strategy

### URI-based (recommended)

```
/v1/users
/v2/users
```

- Easy to route, easy to log, cache-friendly.
- Different versions can be served by different controller classes.

```ts
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller { /* ... */ }

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller { /* ... */ }
```

App-level enable:

```ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

### Header-based / media-type — when?

Only when forced by an existing API contract; harder to debug, harder
to cache.

## When to bump versions

- **Major (v1 → v2)**: removing a field, renaming a field, changing a
  type, changing semantics.
- **No bump needed**: adding optional fields to responses, adding new
  endpoints.

Each version of an endpoint is a separate file. The use case underneath
may be shared, but the request/response DTOs and mapping live next to
the controller.

## Folder layout per version

```
src/users/infrastructure/http/
├── v1/
│   ├── users.v1.controller.ts
│   ├── dto/
│   │   ├── register-user.v1.request.ts
│   │   └── user.v1.response.ts
│   └── mappers/user.v1.mapper.ts
└── v2/
    ├── users.v2.controller.ts
    ├── dto/...
    └── mappers/...
```

## OpenAPI integration

Install `@nestjs/swagger`. Bootstrap:

```ts
const config = new DocumentBuilder()
  .setTitle('Users API')
  .setDescription('User accounts and authentication')
  .setVersion(appConfig.observability.serviceVersion)
  .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
  .addServer('https://api.example.com')
  .build();

const document = SwaggerModule.createDocument(app, config);

if (appConfig.nodeEnv !== 'production') {
  SwaggerModule.setup('docs', app, document);
} else {
  // expose only the JSON spec under auth in production
  app.use('/openapi.json', authMiddleware, (_req, res) => res.json(document));
}
```

## Annotating DTOs and endpoints

```ts
import { ApiProperty, ApiOperation, ApiOkResponse, ApiBadRequestResponse } from '@nestjs/swagger';

export class RegisterUserRequest {
  @ApiProperty({ example: 'a@b.com', maxLength: 254 })
  @IsEmail() @MaxLength(254) email!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}

export class RegisterUserResponse {
  @ApiProperty({ example: '8a7f...' }) id!: string;
}

@Controller({ path: 'users', version: '1' })
export class UsersController {
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiOkResponse({ type: RegisterUserResponse })
  @ApiBadRequestResponse({ description: 'Validation error' })
  register(@Body() body: RegisterUserRequest): Promise<RegisterUserResponse> { /* ... */ }
}
```

## Generic envelope in OpenAPI

Use a helper to render `ApiResponse<T>` once per data type:

```ts
export function ApiOkEnvelope<T extends Type<unknown>>(model: T) {
  return applyDecorators(
    ApiExtraModels(ApiSuccessEnvelope, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiSuccessEnvelope) },
          { properties: { data: { $ref: getSchemaPath(model) } } },
        ],
      },
    }),
  );
}
```

Where `ApiSuccessEnvelope` is a class with `success: true`, `meta:
ResponseMeta`, and a placeholder `data: unknown`.

## Idempotency

For `POST` operations safe to retry, accept `Idempotency-Key` header:

```ts
@Post()
register(
  @Headers('idempotency-key') idempotencyKey: string | undefined,
  @Body() body: RegisterUserRequest,
): Promise<RegisterUserResponse> {
  return unwrap(await this.useCase.execute({ ...body, idempotencyKey }));
}
```

Persist seen keys for 24h with the resulting response — replay returns
the same response on retry.

## Deprecation lifecycle

1. Mark old endpoint with `@ApiOperation({ deprecated: true, summary: 'Use /v2/...' })`.
2. Add `Deprecation` and `Sunset` HTTP headers per RFC 8594.
3. Communicate sunset date to consumers.
4. Remove after the announced sunset window.

## CI checks

- Generate the OpenAPI spec at build time and diff against the previous
  version. Breaking diffs require a major version bump.
- Lint with `spectral` (style) and `oasdiff` (semantic diffs).
