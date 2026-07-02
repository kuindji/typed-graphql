# Real-life GraphQL tests ported from TheFloorr

**Date:** 2026-07-02
**Status:** Approved design — pending implementation plan

## Goal

Exercise `@kuindji/typed-graphql` against the real GraphQL shapes used in the
TheFloorr production monorepo, so the library is validated on genuine usage
rather than only hand-authored fixtures. Every case is derived from a real
call site and ported onto an anonymized schema.

## Scope

**In scope:** the Hasura GraphQL surface used in `TheFloorr/monorepo` via its
custom `api.<table>` / `g.<table>` builder — the direct predecessor of this
library's `createHasuraClient`. That surface is two shapes:

1. **Selection graphs** — `.select(\`…\`)` and `GraphType<"Table", typeof graph>`
   template strings (~130 sites across ~20 files).
2. **Builder chains** — `.where` / `.order` / `.limit` / `.offset` /
   `.distinctOn` / `.aggregate` / `.count` / `.insert` / `.onConflict` /
   `.update().id()` / `.remove().where()`.

**Out of scope:**

- Raw-SQL access via `db.main.select(...)` / `db.catalogue.select(...)` — these
  are Knex-style SQL strings, not GraphQL.
- The Shopify Admin API queries under `shopify/` — a separate schema with no
  anonymized fixture. Could be a follow-up.
- Generated `*.generated.d.ts` / `*.types.d.ts`.
- Runtime concerns: react-query hooks, `useSubscription` wiring, the WebSocket
  transport. We test the document/type the builder produces, not the transport.
- Hasura Actions — `hasura/main/metadata/actions.graphql` is empty.

There are **no hand-authored operation documents** (`query Name($v: T!)`) in
the app code; the builder generates all documents internally. So full-document
inference (`GetReturnType` / `GetVariables` / `ValidateGraphQL`) is exercised
through the builder path and through a few representative wrapped documents,
not through app-authored operation strings.

## Anonymization

Use the **migration-compat naming style** already established in
`tests/compiler/migration-compat.test.ts`: real-ish Hasura table names
(`Consultation`, `User`, `Look`, `Moodboard`, `Chat_Message`, …) with generic
field names. Readable, serves as living documentation, keeps business-specific
semantics out. No `T0/f0/r0` remapping.

## Fixture

Add one shared schema fixture: `tests/fixtures/thefloorr-schema.ts`, exporting
`TheFloorrSchema`. It extends the inline schema currently in
`migration-compat.test.ts` to cover the tables the representative cases need,
and `migration-compat.test.ts` is refactored to import it (removing the
duplicated inline schema).

The fixture models the topology the real usages exercise:

- **Tables:** `Consultation`, `User`, `User_PaymentDetails`, `Look`,
  `Look_aggregate` + `Look_aggregate_fields`, `Moodboard`,
  `Moodboard_ProductReference`, `Catalogue_ProductReference`,
  `Moodboard_aggregate` + `Moodboard_aggregate_fields`, `Chat`, `Chat_Message`,
  `Chat_Participant`, `Chat_Message_Notification`, `Connection`, `Team`,
  `Team_Member`, `Product`. (Final table set determined during implementation
  by the chosen representative cases.)
- **Relations:** object (1:1, nullable) and list (1:many); nesting to ≥4 levels
  (chat → message → look/product → …) to mirror the deepest real graphs.
- **Arguments:** field-level `where` / `order_by` / `limit` on relation fields
  (`looks(where: …)`, `images(order_by: …)`, `participantInChats(limit: 1,
  order_by: …)`, `messages(where: …, order_by: …, limit: 1)`).
- **Inputs:** `*_bool_exp`, `*_comparison_exp` (`_eq`/`_neq`/`_in`/`_ilike`/
  `_is_null`/`_gt`/`_lte`), `*_order_by`, `*_insert_input`, `*_on_conflict`.
- **Enums:** `*_select_column`, `order_by` (`asc`/`desc`/`desc_nulls_last`).
- **Branded ids** where the real code uses them (`User_id`, `Chat_id`, …).

Custom scalars/JSON columns modeled as `unknown`, matching migration-compat.

## Test files

Mirror the existing test conventions (`expect-type` + `bun:test`).

### 1. `tests/compiler/real-usages.test.ts`

Selection-graph cases fed to `GetSelectionType` / `ValidateSelection` /
`ValidateGraphQL`, each traceable to a real site. Representative coverage —
one or two cases per distinct shape:

- Plain flat selection (`id title`).
- Object relation, nullable (`customer { id email }`).
- List relation (`looks { id updatedAt }`).
- Deep nesting ≥4 levels (chat message notification graph).
- Aliased field (`looksCount: looks_aggregate(...) { aggregate { count } }`).
- Inline `_aggregate` with `where` argument and `count(columns:…, distinct:…)`.
- Field arguments: `looks(where: {deleted:{_eq:false}})`,
  `images(order_by: {position: asc})`,
  `participantInChats(limit: 1, order_by: {lastOnlineAt: desc})`,
  `messages(where:…, order_by:…, limit: 1)`.
- Fragment composition: graph assembled from `${Fragment}` interpolated
  `as const` strings (reproduced as composed string literals).
- A couple of full documents wrapping a real graph
  (`query { Consultation { …graph } }`) for `GetReturnType` / `ValidateGraphQL`.
- Negative cases: unknown field → `UNKNOWN_FIELD`, missing selection on a
  relation → `MISSING_SELECTION`, selection on a scalar → `UNEXPECTED_SELECTION`.

`#userId` runtime placeholders are replaced with a literal string when porting
(they are substituted before the query is a real GraphQL document).

### 2. `tests/hasura/real-usages.test.ts`

Real builder chains rebuilt on `createHasuraClient`, asserting the generated
`document` string and `variables` (like `builder.test.ts` / `client.test.ts`)
plus the inferred result type. Representative coverage:

- `.select(graph)` + `.where({ userId: { _eq } })` + `.order` + `.limit` /
  `.offset` / `.one()` / `.all()`.
- Nested-relation where filter (`{ chat: { participants: { userId: {_eq} } } }`).
- `_and` array conjunction; `_or`; `_in`/`_nin`; `_ilike`.
- `.aggregate({ nodes: […] }).distinctOn(col)` and `.count()`.
- Shorthands: `.eq` / `.neq` / `.gt` / `.lt` / `.like` / `.isNull` / `.id`.
- Mutations: `.insert(payload)`, `.select("id").insert(payload)` (typed
  returning), `.onConflict(false)`, `.update(data).id(id)`,
  `.remove().where({ id: { _in } })`.

## Verification

- `npm run typecheck` — whole project incl. tests.
- `npm test` — full typecheck, `strictNullChecks:false` pass, then `bun test`.
- `npm run perf` — new type-level asserts raise instantiation counts. If the
  perf gate trips, rebaseline with `npm run perf:update` and explain the delta
  in the commit message (per CONTRIBUTING.md). New tests should be the only
  cause of the increase.

## Non-goals / accepted gaps

- Not exhaustively porting all ~130 sites — representative per shape only.
- Shopify schema and subscription transport are follow-ups.
- No new library behavior; if a real shape exposes a genuine library gap, that
  is recorded separately and fixed one-per-go per the existing campaign
  workflow, not folded into this test-authoring pass.
