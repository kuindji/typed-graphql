# Contributing to @kuindji/typed-graphql

This document is for contributors and reviewers. Consumer-facing documentation
lives in [README.md](./README.md).

> This project is in the scaffold stage. The notes below describe the toolchain;
> design contracts for the type-level engine will be added as it is built.

## Working in the repo

- **Typecheck:** `npm run typecheck` — runs `tsc --noEmit` over the whole
  project, tests included.
- **Tests:** `npm test` — full typecheck first, then `tsc` under
  `strictNullChecks: false`, then `bun test`. The runtime suite requires
  [Bun](https://bun.sh). Tests live in `tests/` (type-level assertions are
  regular `.test.ts` files checked by `tsc`; runtime behavior is executed by
  Bun).
- **Build:** `npm run build` — `tsc -p tsconfig.build.json` into `dist/`.
- **Dist smoke test:** `npm run test:dist` — builds, then imports the built
  artifact from `dist/` exactly as a consumer would and asserts the public
  surface is intact.

## Conventions

- ESM only (`"type": "module"`); use explicit `.js` extensions in relative
  imports (NodeNext module resolution).
- Formatting is handled by the shared `dprint.json` in the parent `@kuindji`
  workspace directory.
