---
name: structuring-project-layout
description: Specifies folder structure, module boundaries, barrels, and path aliases for a Node.js TypeScript project. Use when starting a new repo, adding a new feature module, or refactoring tangled imports.
license: MIT
---

# Structuring Project Layout

## When to use
- Starting a new Node.js TypeScript repo
- Adding a new feature module
- Refactoring tangled imports and unclear boundaries

## Core rules
1. Three-layer layout: `src/domain/`, `src/application/`, `src/infrastructure/`
2. Feature modules inside `src/features/<feature-name>/` with own layers
3. Shared kernel in `src/shared/` (types, errors, contracts, constants)
4. Barrel files (`index.ts`) in every folder for clean imports
5. Path aliases: `@domain/*`, `@application/*`, `@infrastructure/*`, `@shared/*`
6. No cross-feature imports; use `@shared/contracts`

## Reference shape (TypeScript)

```
src/
├── domain/           # Pure business rules, no framework
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   └── index.ts
├── application/      # Use-cases, ports, orchestration
│   ├── use-cases/
│   ├── ports/
│   └── index.ts
├── infrastructure/   # Adapters: HTTP, DB, 3rd-party
│   ├── repositories/
│   ├── http/
│   └── index.ts
├── shared/           # Kernel: types, errors, contracts
│   ├── types/
│   ├── errors/
│   ├── contracts/
│   └── index.ts
├── features/         # Feature modules (each with own layers)
│   └── user/
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── index.ts
└── main.ts           # Entry point
```

## Examples — Do
```typescript
// Barrel re-exports
// src/domain/entities/index.ts
export { User } from './user.entity';
export { Order } from './order.entity';

// Clean import with path alias
import { User } from '@domain/entities';
import { UserRepository } from '@application/ports';
```

## Examples — Don't
```typescript
// ❌ Deep relative imports
import { User } from '../../../../domain/entities/user.entity';

// ❌ Cross-feature import
import { OtherFeatureService } from '../other-feature/application/service';
```

## Checklist
- [ ] Three-layer structure created
- [ ] `shared/` kernel with types, errors, contracts
- [ ] Barrel files in all folders
- [ ] Path aliases configured in `tsconfig.json`
- [ ] No deep relative imports

See [reference/layout-patterns.md](./reference/layout-patterns.md) for full patterns.
