# typed-graphql design

Status: updated design after the AST-less rewrite.
Scope: core type-level compiler; runtime builder remains future work.

## Decision

`typed-graphql` does not expose or internally depend on a full GraphQL AST.
The compiler walks source strings directly and stores only shallow source slices
needed for later stages:

- operation kind/name/variable-definition source;
- operation selection body;
- fragment type condition and selection body;
- argument/directive source slices while validating a field.

This follows the `typed-sql` performance lesson: token arrays and AST object
trees create unnecessary tuple/object churn and increase the chance of hitting
TypeScript recursion-depth limits.

## Module layout

```
src/
  index.ts                 Public API
  diagnostics.ts           GraphQLError
  schema.ts                GraphQLSchema, GraphQLInput, relation metadata
  compiler/
    scanner.ts             ignored-character skipping and balanced slice taking
    document.ts            direct document indexing
    selection.ts           schema-aware selection compilation
    arguments.ts           argument validation and variable-use collection
    variables.ts           operation variable-definition resolution
    compile.ts             full-document orchestration
```

## Pipeline

1. `IndexGraphQL<S>` scans the document and returns a shallow index of operation
   and fragment entries.
2. `SelectOperation` picks the target operation and enforces the named-operation
   rules.
3. `RunSelection` compiles the selected operation body against the schema root.
4. Fields validate against `schemas`, `relations`, and `arguments`.
5. Fragments compile lazily in the current type context.
6. Argument validation collects variable uses.
7. Built-in directive arguments collect variable uses and affect optionality.
8. Concrete fragment type conditions must apply to the current concrete object
   type.
9. Duplicate response keys are checked for conflicts.
10. `ResolveVariables` validates variable declarations and materializes the
   runtime variables object.

## Public API

- `ValidateGraphQL<Query, Schema, OperationName?>`
- `IsValidGraphQL<Query, Schema, OperationName?>`
- `GetReturnType<Query, Schema, OperationName?>`
- `GetVariables<Query, Schema, OperationName?>`
- `ValidateSelection<Selection, Schema, Root>`
- `GetSelectionType<Selection, Schema, Root>`

Invalid input returns a branded `GraphQLError` from validation APIs and `never`
from inference APIs.

## Performance rules

- No token arrays.
- No nested AST tree.
- Chunk long structural walks and selection compilation.
- Accumulate fields as flat unions and materialize output objects through
  mapped types.
- Prefer structural delimiter jumps over per-character work when possible.
- Return explicit diagnostics for unsupported or too-complex input.
- Gate deterministic TypeScript counters with `npm run perf`.

## Current limitations

The first compiler is intentionally smaller than the full GraphQL spec. Known
remaining work includes deeper input-object validation, interfaces/unions,
abstract fragment overlap rules, and full directive metadata validation for
custom directives.
