# Contributing to @kuindji/typed-graphql

This document is for contributors and reviewers. Consumer-facing documentation
lives in [README.md](./README.md).

## Working in the repo

- **Typecheck:** `npm run typecheck` — runs `tsc --noEmit` over the whole
  project, tests included.
- **Tests:** `npm test` — full typecheck first, then `tsc` under
  `strictNullChecks: false`, then `bun test`. The runtime suite requires
  [Bun](https://bun.sh). Tests live in `tests/`; type-level assertions are
  regular `.test.ts` files checked by `tsc`.
- **Build:** `npm run build` — `tsc -p tsconfig.build.json` into `dist/`.
- **Dist smoke test:** `npm run test:dist` — builds, then imports the built
  artifact from `dist/` exactly as a consumer would and asserts the public
  surface is intact.
- **Perf budget:** `npm run perf` — runs `tsc --extendedDiagnostics` and gates
  deterministic counters against `scripts/perf-baseline.json`.

## Conventions

- ESM only (`"type": "module"`); use explicit `.js` extensions in relative
  imports (NodeNext module resolution).
- Formatting is handled by the shared `dprint.json` in the parent `@kuindji`
  workspace directory.
- Public type-level errors use `GraphQLError` from `src/diagnostics.ts`.

## Type-level compiler constraints

The core compiler is intentionally AST-less. Do not reintroduce a tokenizer,
token array, or public AST layer unless there is a measured reason and an
updated design decision.

Use the same performance discipline as `@kuindji/typed-sql`:

- walk source strings directly;
- take balanced source slices for argument lists, selection sets, lists, and
  input objects;
- keep recursive workers chunked and resume them through a driver type;
- accumulate field results as flat unions, then materialize object shapes with
  mapped types;
- return explicit diagnostics for unsupported or too-complex input instead of
  silently widening or accepting a prefix;
- run `npm run perf` after non-trivial compiler changes.

If a change intentionally increases deterministic compiler counters, update the
baseline with `npm run perf:update` and explain why in the change summary.
