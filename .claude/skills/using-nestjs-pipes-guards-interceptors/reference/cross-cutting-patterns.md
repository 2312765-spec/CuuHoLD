# NestJS Cross-Cutting Patterns — Complete Reference

## Pipes (Input Transformation/Validation)
```typescript
// Custom pipe: parse UUID param
@Injectable()
export class ParseUuidPipe implements PipeTransform {
  transform(value: string): string {
    if (!PATTERNS.UUID.test(value)) {
      throw new BadRequestException('Invalid UUID');
    }
    return value;
  }
}

// Usage
@Get(':id')
findOne(@Param('id', ParseUuidPipe) id: string) { ... }
```

## Guards (Auth & Authorization)
```typescript
// Auth guard using JWT
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return false;
    const payload = this.authService.verifyToken(token);
    if (!payload) return false;
    req.user = payload;
    return true;
  }
}

// Roles decorator + guard
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest();
    return roles.some(r => user.roles.includes(r));
  }
}
```

## Interceptors (Response Transform, Logging, Caching)
```typescript
// Logging interceptor
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    return next.handle();
  }
}

// Response transform interceptor (wrap in ApiResponse)
@Injectable()
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map(data => ({ success: true, data }))
    );
  }
}

// Cache interceptor (simplified)
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const key = `cache:${req.url}`;
    // Check cache, return if hit, else continue
    return next.handle();
  }
}
```

## Global Registration
```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
app.useGlobalGuards(new JwtAuthGuard());
app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseTransformInterceptor());
```

## Controller Usage
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  @Get('stats')
  @UseInterceptors(LoggingInterceptor)
  getStats() { ... }
}
```
