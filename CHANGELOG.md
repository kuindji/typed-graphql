# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
