---
name: _conventions
description: "Defines the rule base every skill in this pack obeys: file layout, frontmatter, vocabulary, OOP/typing/decoupling axioms, and anti-patterns. Load FIRST before authoring or applying any other skill in this pack."
license: MIT
---

# Conventions — Rule Base For This Skill Pack

This document is the **single source of truth** for every other skill in this
pack. It defines:

- the **structure** every `SKILL.md` must follow,
- the **vocabulary** the agent must use when reasoning about the codebase,
- the **non-negotiable axioms** (OOP, typing, decoupling, business separation),
- the **anti-patterns** that must be rejected in any generated or reviewed
  code.

If a skill ever contradicts this document, **this document wins**.

---

## 1. Skill file structure

Every skill in this pack uses this exact skeleton:

```markdown
---
name: <gerund-skill-name>
description: <one sentence: what + when to use>
license: MIT
---

# <Title>

## When to use
## Core rules
## Reference shape (TypeScript)
## Examples — Do
## Examples — Don't
## Checklist
```

Rules:

- `name` is **gerund form** (`designing-...`, `building-...`,
  `handling-...`) and equals the parent folder name.
- `description` includes both **what the skill does** and **when to load it**.
- Keep `SKILL.md` **under 500 lines**. Move long references to
  `reference/*.md`.
- Code examples are always **TypeScript**, never plain JavaScript.

---

## 2. Vocabulary the agent must use

| Term            | Meaning in this pack                                                             |
| --------------- | -------------------------------------------------------------------------------- |
| **Domain**      | Pure business rules. No framework, no I/O, no `console.log`.                     |
| **Application** | Use-cases / orchestrators. Calls domain, calls ports.                            |
| **Infrastructure** | Adapters: HTTP, DB, queue, cache, mailer, 3rd-party SDKs.                     |
| **Port**        | A TypeScript `interface` declared by the domain/application layer.               |
| **Adapter**     | A concrete class implementing a port, lives in infrastructure.                   |
| **DTO**         | Data Transfer Object — shape that crosses a process boundary.                    |
| **Entity**      | Object with identity and lifecycle. Lives in domain.                             |
| **Value Object**| Immutable, equality-by-value. Lives in domain.                                   |
| **Use case**    | One application service method = one business intent.                            |
| **Result<T,E>** | Typed success/error union returned by use cases.                                 |
| **ApiResponse<T>** | The single envelope shape returned by every HTTP endpoint.                    |

The agent must **use these exact terms** in code, comments, commit messages,
and PR descriptions.

---

## 3. Non-negotiable axioms

### 3.1 OOP-first
- Every unit of behavior is a **class**, never a loose function module
  exposing many functions.
- Classes have **one responsibility** (SRP). Split rather than grow.
- Public surface is **explicit** (`public`/`protected`/`private` always
  written, never relying on default).
- State is **encapsulated**: no public mutable fields; expose intent via
  methods.

### 3.2 Strong typing with generics
- Every function/method has **explicit parameter and return types**. No
  implicit `any`.
- Cross-boundary shapes use generics:
  - `ApiResponse<T>` for HTTP responses,
  - `Paginated<T>` for list responses,
  - `Result<T, E>` for use-case outputs,
  - `Repository<T, ID>` for persistence ports.
- `unknown` is preferred over `any`. `any` is **forbidden** unless commented
  with a justification.
- Public types live in `*.types.ts` or `*.contracts.ts` and are
  **re-exported** via a barrel.

### 3.3 Decoupling (low coupling, high cohesion)
- Layers depend **inward only**:
  `infrastructure → application → domain`. Domain depends on **nothing**.
- A class **never imports a concrete class from another layer**. It imports an
  **interface** (port) and receives the implementation through the
  constructor (Dependency Injection).
- Cross-feature dependencies go through **published contracts**, never reach
  into another feature's internals.
- No circular imports. Use `madge --circular` or `dpdm` in CI.

### 3.4 Business logic separation
- Controllers/handlers contain **no business rules**. They:
  1. parse and validate input,
  2. call **one** use case,
  3. map the `Result<T,E>` to the transport response.
- Domain entities contain **invariants** (rules that must always hold) and
  **behavior**, not just data bags.
- Persistence concerns (ORM decorators, SQL, query builders) **never leak**
  into domain or application layers.

### 3.5 Errors are typed
- Define a base `AppError` class. All thrown errors extend it.
- Use cases return `Result<T, E extends AppError>` instead of throwing for
  expected business failures.
- Throw only for **unexpected** failures (programmer errors, infra outages).

### 3.6 Configuration is validated
- Read `process.env` exactly **once**, at boot, through a typed schema
  (Zod / class-validator). The rest of the code consumes a typed
  `AppConfig` object.

### 3.7 Production-ready defaults
- Structured JSON logs with correlation/trace IDs.
- Health and readiness endpoints.
- Graceful shutdown on `SIGTERM`/`SIGINT`.
- No secrets in code, in logs, or in error messages.

---

## 4. Required design patterns

The agent must recognize and apply these patterns by name:

| Pattern             | Where it appears                                                |
| ------------------- | --------------------------------------------------------------- |
| **Dependency Injection** | Every class receives its collaborators through constructor. |
| **Repository**      | All persistence access. Domain defines port; infra implements.  |
| **Factory**         | Constructing aggregates with invariants.                        |
| **Strategy**        | Pluggable algorithms (pricing, retry, hashing).                 |
| **Adapter**         | Wrapping 3rd-party SDKs into project ports.                     |
| **Decorator**       | Cross-cutting concerns (logging, caching, retry).               |
| **Facade**          | Simplified entrypoint over a complex subsystem.                 |
| **Observer / Pub-Sub** | Domain events, async side-effects.                           |
| **Command / Use Case** | Each application method = one command/query.                 |
| **Specification**   | Composable business rules / query predicates.                   |

Each is documented in `applying-design-patterns/`.

---

## 5. Anti-patterns the agent must reject

- ❌ Service classes with `static` methods used as utility singletons.
- ❌ Functions returning `Promise<any>` or `Promise<object>`.
- ❌ Controllers that talk directly to the ORM or to a 3rd-party SDK.
- ❌ Domain entities that import `@nestjs/*`, `typeorm`, `axios`, etc.
- ❌ `try { ... } catch (e) { console.log(e) }` — swallowing errors.
- ❌ Magic strings/numbers — must be `const enum` or named constant.
- ❌ Reaching into another module's `dist/`, `src/internal/`, or non-exported
  files.
- ❌ Mixing snake_case and camelCase. The codebase is camelCase, DB columns
  are snake_case and mapped explicitly.
- ❌ `as any`, `// @ts-ignore`, `// @ts-expect-error` without a written
  justification.

---

## 6. How the agent should apply a skill

When asked to load a skill from this pack, the agent should:

1. Read this `_conventions` document first (only once per session).
2. Read the requested skill's `SKILL.md`.
3. Map the user's request to the skill's **Checklist**.
4. Generate or modify code that satisfies the checklist **and** the axioms in
   §3.
5. Self-review against the **Anti-patterns** in §5 before returning.

---

## 7. Checklist (meta)

- [ ] Skill file matches the skeleton in §1.
- [ ] Description states *what* and *when*.
- [ ] All examples are TypeScript and OOP.
- [ ] All cross-boundary types are generic.
- [ ] No anti-pattern from §5 appears in any example.
- [ ] Skill stays under 500 lines.
