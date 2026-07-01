# Phase 1 core parsing plan

Status: superseded.

The original phase-1 plan described a port of TheFloorr's tokenizer/parser into
`src/parsing/` with a public AST. That approach was replaced by the AST-less
compiler described in
[`../specs/2026-07-01-typed-graphql-design.md`](../specs/2026-07-01-typed-graphql-design.md).

Historical reason for the change: the AST approach creates avoidable
TypeScript tuple/object churn and is more likely to hit recursion-depth limits.
The current implementation walks source strings directly, validates against the
schema while compiling, and exposes validation/inference APIs rather than parse
APIs.
