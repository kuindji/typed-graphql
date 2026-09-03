# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-09-03

### Fixed

- **Compiler:** a string literal for a custom scalar argument was rejected
  ("literal is incompatible with timestamptz") unless the schema listed the
  scalar under `scalars`, even when the argument declared its app type
  (`GraphQLInput<"timestamptz", string>`). An undeclared scalar is now
  validated against the argument's own app type: the literal must fit its
  primitive shape, a branded app type still requires a variable (as for
  `ID!`), and an `unknown` app type accepts any literal.
- **Compiler:** a nested field selected at interface/union level and again
  under a type condition (`node { owner { id } ... on User { owner { name } } }`)
  was inferred as `{ id } | { name }`, hiding `id` behind a narrowing even
  though every runtime type returns it. Overlapping type conditions now merge
  their sub-selections, with fields from the narrower condition optional —
  the same treatment scalar fields already got.
- **Compiler:** a nullable variable with a default value used at a non-null
  argument (`$limit: Int = 5` → `limit: Int!`) inferred `number | null`, but
  an explicit null there is an execution-time field error (spec §6.4.1). The
  variables type no longer widens with `| null` when any use is non-null.
- **Compiler:** list item nullability is kept in inferred variables:
  `$ids: [Int]` is `(number | null)[] | null`, `[Int!]` stays `number[]`.
- **Compiler:** two duplicate fields whose only difference was whitespace
  inside a list/object literal containing a string that ends in an escaped
  backslash (`"x\\"`), or a comment containing a quote, failed with
  FIELD_CONFLICT. The canonicalizer now walks the argument text once,
  escape-aware, recognising strings and comments in source order.
- **Hasura:** `max`/`min`/`avg`/`sum` aggregate results are typed nullable —
  Hasura resolves them to null when no row matches the filter.
- **Hasura:** `where({ _and: [] })` (or an `_and` made only of empty
  expressions) matches every row but passed the whole-table `update()`/
  `remove()` guard. It is now rejected like a missing filter.
- **Hasura:** `order()`, `insert()`, `update()` and `onConflict()` kept a
  reference to the caller's object, so mutating it after the call changed the
  request. They now snapshot plain containers the way `where()` does.

### Performance

- **Compiler:** the whitespace and balanced-group scanners infer each source
  character once and branch on it instead of trying up to six template
  patterns per character. Whole-suite instantiations drop by ~30%
  (1,093,900 → 766,924, with the new regression tests included); a
  40-field nested query drops from 85.5k to 51.9k instantiations.
- **Compiler:** the field-merge conflict check buckets fields by response
  key first (linear), so the pairwise comparison only runs for keys that
  actually repeat. A 40-field single selection set drops from 85.0k to 44.0k
  instantiations.

## [1.0.4] - 2026-07-25

### Fixed

- **Hasura:** class-instance filter values (`Date`, `Decimal.js`, `Buffer`, …)
  were rebuilt field by field when a condition was captured, which erased them
  — a `created_at > cutoff` filter reached the server as `{ _gt: {} }`. Only
  object literals are treated as containers now; class instances stay leaves.
- **Hasura:** an operator method that collided with a condition `where()` had
  already set on the same column overwrote it instead of conjoining, silently
  dropping a filter (and doing the opposite in the reverse call order).
  Repeated operator methods still replace their own earlier value.
- **Hasura:** two `where()` calls on the same nested relation merged into a
  single condition; on a to-many relation that asks for one related row
  matching everything rather than the conjunction the caller wrote. Relation
  filters are now conjoined via `_and`; column operator maps still merge.
- **Docs:** the README executor example predated the `{ data, error }`
  envelope and did not compile.

## [1.0.0] - 2026-07-02

First stable release.

### Core (type-only)

- Compile-time GraphQL validation, variables inference, and result-type
  inference driven entirely by the TypeScript type system — no runtime
  validation and no generated client.
- AST-less shallow compiler that walks the query source string directly,
  validates the selected operation plus referenced fragments, and returns
  structured `GraphQLError` diagnostics for invalid input.
- Public type API: `ValidateGraphQL`, `IsValidGraphQL`, `GetReturnType`,
  `GetVariables`, `ValidateSelection`, `GetSelectionType`, plus the
  `GraphQLSchema` and `GraphQLInput` schema-description helpers.
- Language support: anonymous shorthand and named `query` / `mutation` /
  `subscription` operations, operation selection by name, variables and
  variable type declarations, fields, arguments, aliases, nested selections,
  relation nullability and list wrappers, named and inline fragments,
  built-in `@skip` / `@include`, schema-declared custom directives, and
  scalar / object / list / enum / boolean / null / string / numeric literal
  arguments.
- Explicit diagnostics (including `QUERY_TOO_COMPLEX`) for unsupported or
  too-complex input instead of silently widening or accepting a prefix.

### Runtime (`@kuindji/typed-graphql/runtime`)

- Transport-neutral boundary: `GraphQLRequest`, `GraphQLExecutor`,
  `extractResult`, and document-assembly helpers.
- `unwrapResponse` / `extractErrors` for handling the standard
  `{ data, errors }` envelope, with `GraphQLResponseError` for error
  responses.

### Hasura (`@kuindji/typed-graphql/hasura`)

- `createHasuraClient` — an immutable, chainable Hasura query builder typed by
  the same schema, covering queries, aggregates, and insert / update / remove
  mutations.

[1.0.4]: https://github.com/kuindji/typed-graphql/releases/tag/v1.0.4
[1.0.0]: https://github.com/kuindji/typed-graphql/releases/tag/v1.0.0
