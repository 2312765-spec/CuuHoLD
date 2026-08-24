# NestJS Module Patterns — Complete Reference

## Feature Module Structure
```
src/user/
├── user.module.ts
├── domain/
│   └── entities/
├── application/
│   ├── use-cases/
│   └── ports/
├── infrastructure/
│   ├── repositories/
│   └── controllers/
└── index.ts
```

## Basic Feature Module
```typescript
// src/user/user.module.ts
@Module({
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    UpdateUserUseCase,
    { provide: 'UserRepository', useClass: TypeOrmUserRepository },
  ],
  exports: [CreateUserUseCase, UpdateUserUseCase],
})
export class UserModule {}
```

## AppModule (Root)
```typescript
// src/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateConfig }),
    DatabaseModule.register(),
    UserModule,
    OrderModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

## Dynamic Module (Database)
```typescript
// src/infrastructure/database/database.module.ts
@Module({})
export class DatabaseModule {
  static register(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: DataSource,
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => {
            const dataSource = new DataSource({
              type: 'postgres',
              url: config.get('DATABASE_URL'),
              entities: [__dirname + '/../**/*.orm-entity{.ts,.js}'],
              synchronize: false,
            });
            return dataSource.initialize();
          },
        },
      ],
      exports: [DataSource],
    };
  }
}
```

## Global Module (Shared Kernel)
```typescript
// src/shared/shared.module.ts
@Global()
@Module({
  providers: [
    { provide: 'Logger', useClass: JsonLogger },
    { provide: 'AuditLogger', useClass: AuditLoggerAdapter },
  ],
  exports: ['Logger', 'AuditLogger'],
})
export class SharedModule {}
```

## Provider Scopes
```typescript
// Singleton (default) — one instance for entire app
@Injectable()
export class UserService {}

// Request-scoped — new instance per request
@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  constructor(@Req() private request: Request) {}
}

// Transient — new instance every injection
@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {}
```

## Module Re-exports Pattern
```typescript
@Module({
  imports: [SharedModule],
  exports: [SharedModule], // Re-export for other modules
})
export class FeatureModule {}
```
