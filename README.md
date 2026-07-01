# @kuindji/typed-graphql

**A compile-time GraphQL query validator and result-type inferrer for TypeScript.**

You write a GraphQL query as a normal TypeScript string. The library parses and
checks it **entirely in the type system** — against a schema you describe as a
type — and infers the shape of the data the query returns. Nothing runs at
runtime for the validation/inference: the work happens while `tsc`
type-checks your code.

This is a sibling of [`@kuindji/typed-sql`](https://github.com/kuindji/typed-sql),
applying the same type-level approach to GraphQL instead of SQL.

> **Status: work in progress.** Phase 1 — the type-level parser — has landed:
> `ParseGraphQL` (and `ParseSelection`) tokenize and parse an executable
> document entirely in the type system, returning a typed AST or a
> `GraphQLError`. Schema-aware validation and result-type inference — the
> intended public API `ValidateGraphQL`, `GetReturnType`, and a `GraphQLSchema`
> type — will land in subsequent work.

See [GOALS.md](./GOALS.md) for the intended scope, migration plan, and design
decisions.

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Ivan Kuindzhi
