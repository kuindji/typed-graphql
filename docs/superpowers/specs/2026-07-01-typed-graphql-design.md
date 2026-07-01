# typed-graphql design

Status: approved design, ready for implementation planning.
Scope: full detailed plan across all four phases from [GOALS.md](../../../GOALS.md).

This document turns `GOALS.md` into an implementable architecture and a
task-level breakdown. It is grounded in three local sources: TheFloorr's
type-level GraphQL modules (`tokenizer.ts`, `parser.ts`, `matcher.ts`,
`aggregate.ts`, `api.ts`), and the sibling package `@kuindji/typed-sql`, whose
structure and tooling this package mirrors.

## 1. Architecture & module layout

The type-level engine is a pipeline — **tokenize → parse → validate/infer** —
with a separate **runtime builder** layer. Each stage is an isolated unit with a
`.test.ts` beside it, gated by the same perf-budget harness as `typed-sql`
(`instantiations` / `types` / `symbols` vs a recorded baseline).

```
src/
  index.ts              Public API surface (ValidateGraphQL, GetReturnType, GetVariables, …)
  schema.ts             GraphQLSchema contract + GraphQLInput<Wire, App> helper, scalar map
  diagnostics.ts        Branded structured error types + stable codes
  parsing/
    ast.ts              Kind enum + AST node interfaces (shared vocabulary)
    tokenize.ts         Ported tokenizer, hardened to fail explicitly (no `void` leakage)
    parser.ts           Ported parser: document + selection, full-input-consumption check
  validation/
    resolve-schema.ts   defaultSchema / "content.User" root resolution
    validate.ts         Schema-aware validation dispatch → true | Diagnostic
    infer.ts            Result-shape inference (aliases, lists, nullability, fragments, @skip/@include)
    arguments.ts        Argument + variable-type checking; runtime variables inference
  partial.ts            ValidateSelection / GetSelectionType entry points (explicit root type)
  builder/              Runtime query building — engine-neutral helpers + Hasura builder
```

### Three deliberate departures from the reference

1. **Parse failures are first-class.** The ported tokenizer emits `void`
   mid-array and the parser discards unconsumed tokens, so a malformed suffix is
   silently accepted. Both become explicit: the tokenizer yields a diagnostic
   node; the parser requires the token stream to be fully consumed or returns a
   structured parse error. Satisfies GOALS Goal 1.3 ("reject malformed syntax
   rather than silently accepting a parsed prefix").
2. **Diagnostics are branded, not bare `Error`.** The matcher's `Error`
   sentinel becomes a branded `GraphQLError` with a stable code, message, and
   optional path; `IsValidGraphQL` collapses it to boolean.
3. **Schema decoupling.** All `@common/db/...` and `type-fest` imports are
   removed. The schema is the consumer-supplied `GraphQLSchema` type; small
   local utility types replace `type-fest`. The core has no runtime or
   framework dependency.

## 2. Schema contract & diagnostics model

These two shared vocabularies underpin every later phase.

### GraphQLSchema contract (`schema.ts`)

Formalizes the shape in GOALS Goal 3:

- `defaultSchema: string` and
  `schemas: { [ns]: { [typeName]: { [field]: TsType } } }` — scalar and
  nullability information carried in the TS property type, `typed-sql`-style.
- `relations: { [ns]: { [typeName]: { [field]: { type; nullable?; multiple?; itemNullable? } } } }`
  — object-valued fields. Defaults: singular, non-null, non-null items. Optional
  `multiple`, `nullable`, `itemNullable` express other GraphQL wrapping
  combinations.
- `arguments: { [ns]: { [typeName]: { [field]: { [arg]: GraphQLInput<Wire, App> } } } }`
  — a general map, because scalar and object-valued fields can both accept
  arguments.
- Optional additive maps: `rootTypes?`, `inputs?`, `scalars?`, `enums?`,
  `interfaces?`, `unions?`, `directives?`. Full documents start from
  conventional `Query`/`Mutation`/`Subscription`; `rootTypes` supports alternate
  root type names.

### GraphQLInput<Wire, App> — the wire/app split

`Wire` (e.g. `"ID!"`) drives GraphQL-side validation and coercion. `App` is the
TypeScript value the consumer must supply, defaulting from the built-in or
custom scalar map when omitted. This keeps branded identifiers (e.g. `UserId`)
required at call sites even when their wire representation is a standard scalar.
An inline GraphQL literal cannot prove a narrower application type, so strict
validation requires a typed **variable** for such an argument.

### Root resolution (`validation/resolve-schema.ts`)

One resolver used by both full-document operation roots and partial-selection
roots: an unqualified name resolves through `defaultSchema`; a qualified name
such as `"content.User"` selects another namespace.

### Diagnostics model (`diagnostics.ts`)

```ts
interface GraphQLError<Code extends string, Msg extends string, Path = undefined> {
    readonly __graphqlError: true;
    code: Code;      // stable, e.g. "UNKNOWN_FIELD"
    message: Msg;
    path?: Path;     // field path to the failure, when known
}
```

- `ValidateGraphQL` → `true | GraphQLError<…>`; `IsValidGraphQL` collapses to
  `true | false`.
- **First error only.** On a document with multiple errors, `ValidateGraphQL`
  returns the first diagnostic encountered and short-circuits. Cheapest at the
  type level and consistent with `typed-sql`. (Decision recorded during
  brainstorming.)
- Stable codes: `SYNTAX_ERROR`, `UNEXPECTED_TOKEN`, `INCOMPLETE_INPUT`,
  `UNKNOWN_FIELD`, `MISSING_SELECTION`, `UNEXPECTED_SELECTION`,
  `UNKNOWN_ARGUMENT`, `DUPLICATE_ARGUMENT`, `MISSING_REQUIRED_ARGUMENT`,
  `INVALID_ARGUMENT_VALUE`, `INVALID_VARIABLE_TYPE`, `UNKNOWN_OPERATION_ROOT`,
  `UNKNOWN_DIRECTIVE`, `UNSUPPORTED_SYNTAX`.
- **Inference is lenient by design.** `GetReturnType` still infers a best-effort
  shape for an invalid query; strictness lives in `ValidateGraphQL`. This mirrors
  how the reference matcher degrades, but with a structured error instead of a
  bare `Error`.

## 3. Phase 1 & 2 — core pipeline

### Phase 1: establish the core (`parsing/`)

1. **`ast.ts`** — port the `Kind` enum and node interfaces from `parser.ts` as
   the shared AST vocabulary (no logic). Freeze node shapes here so later
   hardening changes only failure paths, not node shapes.
2. **`tokenize.ts`** — port the tail-recursive tokenizer. Harden: replace every
   `void` fall-through with a distinct tokenize-error sentinel carrying the
   unconsumed remainder, so a bad character fails instead of silently truncating
   the stream. Comments, commas, and BOM remain ignored tokens.
3. **`parser.ts`** — port the continuation-passing recursive descent
   (`parseDocument`, `parseSelection`, and the `take*` combinators). Two
   hardening changes:
   - **Full-consumption check.** `_takeDocumentRec` currently returns leftover
     input that callers ignore; wrap so a non-empty trailing token stream yields
     an `INCOMPLETE_INPUT` / `UNEXPECTED_TOKEN` diagnostic. Same for
     `parseSelection`.
   - **Propagate tokenizer failure** into a parse diagnostic instead of feeding a
     malformed array into the parser.
4. **Entry points.** `ParseGraphQL<Q>` (document) and the partial
   `parseSelection` path are both exposed. Partial parsing already synthesizes
   the closing brace; keep that, but route failures through diagnostics.
5. **Tests** (`tests/parsing/`) — valid documents (anonymous shorthand, named
   operations, variables, arguments, aliases, directives, fragments,
   list/object/null values) plus a **negative corpus** asserting each malformed
   input yields the right diagnostic code. This locks in "reject prefix, don't
   silently accept."

### Phase 2: schema validation & inference (`validation/`)

The largest phase. The reference matcher is 76 lines and covers a fraction of
this.

6. **`validate.ts`** — dispatch over the parsed document/selection: resolve the
   operation root (or explicit partial root) via `resolve-schema.ts`; walk
   selections against `schemas` + `relations`; emit the first diagnostic or
   `true`. Covers unknown field, missing selection on an object field, selection
   on a scalar, and invalid operation root.
7. **`infer.ts`** — `GetReturnType` / `GetSelectionType`. Generalizes the matcher
   to handle **aliases** (key by alias), **lists** (`multiple`), **nullability**
   (`nullable` / `itemNullable`), **named and inline fragments** (merge
   selections; honor inline-fragment type conditions), and **`@skip` / `@include`**
   (literal condition → exact shape; variable condition → the field is optional
   in the inferred result).
8. **`arguments.ts`** — validate arguments against the `arguments` map: reject
   unknown, duplicate, and missing-required arguments; validate literal values
   against `Wire`; validate variable declarations and uses; reject incompatible
   variable types. Then **`GetVariables<Q, S>`** infers the runtime variables
   object from `App` types — where branded ids stay required and an inline
   literal for a branded argument is rejected in favor of a typed variable.
9. **Public API in `index.ts`** — `ParseGraphQL`, `ValidateGraphQL`,
   `IsValidGraphQL`, `GetReturnType`, `GetVariables`, and partial
   `ValidateSelection` / `GetSelectionType`. Names per GOALS, refinable during
   implementation.
10. **Tests** (`tests/validation/`) — an inference matrix (aliases,
    single/multiple/nullable relations, fragments, directives), an
    argument/variable validation matrix, and diagnostic-code assertions.

**Sequencing note.** Inference (Task 7) can proceed against parsed ASTs before
validation (Task 6) is complete: inference is lenient, validation is strict, and
they share only a schema-walk helper. Factor that shared selection-walk into a
helper both consume.

## 4. Phase 3 & 4 — migration & runtime builder

### Phase 3: prove migration compatibility

11. **Compatibility corpus** (`tests/migration/`) — recreate representative
    TheFloorr selections as package tests: the `defaultGraphs` shapes exercising
    relations, nullable single relations, multiple relations, aggregates, and
    known-invalid field selections. Assert inferred results are the **same or
    stricter** than TheFloorr's today.
12. **Schema fixtures** — translate a slice of TheFloorr's `defaultGraphTypes` /
    `Relations` into a `GraphQLSchema` fixture. Validates the schema contract
    against real data and serves as the migration reference.
13. **Cutover shim** (documented, not executed here) — show that `parseSelection`
    / `extractFields` / tokenizer imports in TheFloorr can be replaced by package
    exports without weakening type safety. Deliverable is the package-side
    exports plus a mapping note; the actual edit to TheFloorr is out of scope for
    this repo.

### Phase 4: runtime query building (`builder/`)

Grounded in the `api.ts` analysis: an immutable fluent `ApiConstructor` whose
methods spread state into a new instance, with a `mode` field
(`list` / `single` / `aggregate` / `insert` / `update` / `remove`) that dispatches
final assembly, and a `dataKey` result-extraction path.

14. **Engine-neutral core** (`builder/state.ts`, `builder/request.ts`,
    `builder/execute.ts`):
    - Immutable builder state threaded by spread-into-new-instance, with result
      types carried through generics.
    - A **transport-neutral typed request**:
      `{ document; variables; operationName?; dataKey? }`, where `dataKey` is the
      string / `string[]` result-extraction path (the `extractDataFromResponse` +
      `removeTypename` logic, generalized).
    - An **injected executor** — a `(request) => Promise<Result>` seam. Apollo /
      `gql`, auth/JWT refresh, retry, caching, Sentry, and ws transport stay
      consumer-side as injection points (the `setContextFn` / `setGetClientFn` /
      etc. seams become constructor/config injections, not bundled code).
15. **Selection & operation assembly** (`builder/assemble.ts`,
    `builder/variables.ts`) — compose selection strings; assemble operation and
    variable definitions; collect and serialize variables; generate operation
    names (`List${T}s`, `Insert${T}`, …).
16. **Hasura builder** (`builder/hasura/`) — the complete fluent API
    (`where` / `eq` / `gt` / `like` / `isNull` / `id`, `order` / `distinctOn` /
    `offset` / `limit`, `select` / `customSelect`, `all` / `one` / `insert` /
    `onConflict` / `update` / `remove` / `aggregate` / `count`, `then` /
    `subscribe`). Owns Hasura naming (`_bool_exp`, `_set_input`, `_on_conflict`,
    `insert_` / `update_` / `delete_` / `_aggregate` roots) and ports
    `aggregate.ts` (`TableAggregateInput` / `TableAggregateOutput` +
    `generateAggregate`), split cleanly into type-level input/output vs runtime
    string builder.
17. **No universal adapter interface yet** — per GOALS, the Hasura builder only
    establishes the helper boundary. A public adapter contract is extracted only
    after a second engine demonstrates which abstractions are genuinely shared.
18. **Tests** (`tests/builder/`) — document-string snapshots for
    list/single/insert/update/delete/aggregate/subscription, variable-object
    assertions, `dataKey` extraction, and result-type threading through the
    fluent chain.

**Explicitly out of scope** (stays in TheFloorr): Apollo client ownership,
Cognito/JWT refresh, retry / transient-error policy, response caching, Sentry
reporting, ws subscription transport, and the app-specific `@common/db/*`
modules.

## 5. Testing, tooling, sequencing & risks

### Testing strategy (mirrors typed-sql)

- Type-level assertions are ordinary `.test.ts` files checked by `tsc`: a
  positive matrix (expected inferred shapes / `true`) and a negative corpus (each
  malformed input or invalid selection asserts a specific diagnostic code).
  Runtime builder behavior runs under `bun test`.
- Grouped: `tests/parsing/`, `tests/validation/`, `tests/migration/`,
  `tests/builder/`.
- The existing `npm test` chain is kept: `tsc --noEmit` → `typecheck:snc`
  (`strictNullChecks` off) → `bun test`.

### Tooling to add (port from typed-sql)

- `scripts/perf-budget.mjs` + `scripts/perf-baseline.json` — gate
  `instantiations` / `types` / `symbols` against baseline + 10% headroom.
  Re-baseline deliberately at the end of each phase. This is the early warning
  for type-level instantiation blowups.

### Cross-phase sequencing

- Phase 1 → 2 is a hard dependency (ASTs are needed before validation). Within
  Phase 2, inference (Task 7) and validation (Task 6) parallelize over a shared
  selection-walk helper.
- Phase 3 depends on Phase 2 being complete. Phase 4 depends only on Phase 1's
  parser types for inference and can start once the public inference API from
  Phase 2 is stable.

### Primary risks & mitigations

1. **TS recursion-depth / instantiation blowup** — the parser is deeply
   recursive. Keep the tail-recursive `_state` / `_match` continuation style from
   the reference (do not rewrite into naive recursion), perf-gate every phase,
   and use the chunked-driver pattern if a test matrix explodes.
2. **Hardening changes the AST contract** — full-consumption checks could ripple
   into inference. Freeze node shapes in `ast.ts` first; hardening changes only
   failure paths, not node shapes.
3. **Wire/App argument split is novel** (no analog in the reference matcher) and
   is the highest-uncertainty type-level work. Build `GraphQLInput` +
   `GetVariables` against a focused fixture early in Phase 2, before wiring into
   the full argument validator.
4. **Migration equivalence is assertable, not assumed** — Phase 3's corpus is the
   proof that TheFloorr can cut over without losing type safety.

### Success criteria (from GOALS.md, unchanged)

The goals are achieved when:

- TheFloorr no longer owns its GraphQL tokenizer, parser, or matcher.
- Equivalent partial selections infer the same or stricter result types.
- Full GraphQL documents can be parsed, validated, and inferred against a
  documented schema type.
- Invalid syntax and invalid schema selections produce stable, testable
  compile-time failures.
- Full-document arguments and variables are validated, and the runtime variable
  object preserves application types such as branded identifiers.
- The core has no runtime or application-framework dependency.
- Runtime construction lives inside `typed-graphql`, and the Hasura builder
  produces requests equivalent to TheFloorr's existing API without owning its
  transport or application lifecycle.
