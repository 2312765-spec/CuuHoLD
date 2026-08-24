---
name: architecting-nestjs-modules
description: Designs NestJS feature modules with clean dependency boundaries, provider scopes, and dynamic modules. Use when adding a new feature module, splitting a monolithic AppModule, or fixing tangled imports between modules.
license: MIT
---

# Architecting NestJS Modules

## When to use
- Adding a new feature module
- Splitting a monolithic `AppModule`
- Fixing tangled imports between modules

## Core rules
1. Feature modules own their domain, application, infrastructure layers
2. Providers default to `Scope.DEFAULT` (singleton), use `Scope.REQUEST` only when needed
3. Export only what other modules need (don't export everything)
4. Dynamic modules for configurable features (database, cache)
5. No cross-feature imports; use shared contracts

## Reference shape (TypeScript)

### Feature Module
```typescript
@Module({
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    { provide: 'UserRepository', useClass: TypeOrmUserRepository },
  ],
  exports: [CreateUserUseCase],
})
export class UserModule {}
```

### Dynamic Module Example
```typescript
@Module({})
export class DatabaseModule {
  static register(config: DatabaseConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        { provide: 'DATABASE_CONFIG', useValue: config },
        { provide: DataSource, useFactory: () => new DataSource(config).initialize() },
      ],
      exports: [DataSource],
    };
  }
}
```

## Examples — Do
```typescript
// Clean module boundary
@Module({ controllers: [OrderController], providers: [OrderService], exports: [OrderService] })
export class OrderModule {}
```

## Examples — Don't
```typescript
// ❌ Monolithic AppModule
@Module({ controllers: [UserController, OrderController, ProductController], providers: [...] })
export class AppModule {}
```

## Checklist
- [ ] Feature modules with own layers
- [ ] Providers with appropriate scopes
- [ ] Only necessary exports
- [ ] No cross-feature imports

See [reference/module-patterns.md](./reference/module-patterns.md) for full patterns.
