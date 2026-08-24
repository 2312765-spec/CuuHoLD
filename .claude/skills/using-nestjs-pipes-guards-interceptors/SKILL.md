---
name: using-nestjs-pipes-guards-interceptors
description: Applies pipes, guards, and interceptors for cross-cutting concerns in NestJS — validation, auth, transformation, logging, caching. Use when implementing auth, response shaping, observability, or any concern that should not live in controllers.
license: MIT
---

# Using NestJS Pipes, Guards, Interceptors

## When to use
- Implementing authentication/authorization
- Adding logging, caching, response shaping
- Cross-cutting concerns that shouldn't live in controllers

## Core rules
1. **Pipes**: transform/validate input (use `ValidationPipe` globally)
2. **Guards**: authenticate/authorize requests (`AuthGuard`, `RolesGuard`)
3. **Interceptors**: transform responses, log, cache, timeout (`ClassSerializerInterceptor`)
4. Implement as `@Injectable()` classes, register globally or at controller/route level
5. No logic in controllers that belongs in these cross-cutting components

## Reference shape (TypeScript)

### Auth Guard
```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return !!req.user; // Simplified
  }
}
```

### Roles Guard
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some(role => user.roles.includes(role));
  }
}
```

## Examples — Do
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Get('admin')
@Roles('admin')
getAdminData() { ... }
```

## Examples — Don't
```typescript
// ❌ Auth logic in controller
@Get('profile')
getProfile(@Req() req) {
  if (!req.user) throw new UnauthorizedException(); // Move to guard
}
```

## Checklist
- [ ] Pipes for validation/transformation
- [ ] Guards for auth/roles
- [ ] Interceptors for cross-cutting (logging, caching)
- [ ] Registered globally or per-controller

See [reference/cross-cutting-patterns.md](./reference/cross-cutting-patterns.md) for full patterns.
