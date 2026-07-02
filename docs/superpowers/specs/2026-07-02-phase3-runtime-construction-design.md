# Phase 3: runtime construction design

Status: proposed design, pending user review.
Scope: GOALS.md phase 3 — reusable runtime builder helpers, a
transport-independent typed request and executor boundary, and a stable Hasura
builder based on TheFloorr's list, mutation, aggregate, and subscription
behavior.

Source material: `TheFloorr/monorepo/packages/common/src/graphql/api.ts`,
`aggregate.ts`, and `subscription.ts`. Per the porting-latitude decision, this
is a behavioral port with cleanups, not a verbatim copy.

## Decision

Runtime construction lives inside `typed-graphql` as two new layers with
separate subpath exports. The root export stays type-only, preserving the
"no runtime dependency" property of the core compiler.

```
src/
  runtime/
    request.ts     GraphQLRequest, GraphQLExecutor, extractResult
    document.ts    generic operation/variable-definition assembly helpers
    index.ts       runtime entry (exported as @kuindji/typed-graphql/runtime)
  hasura/
    inputs.ts      WhereInput, OrderBy, ListInput, aggregate input/output types
    documents.ts   Hasura document generators (list, insert, update, delete,
                   aggregate, subscription)
    builder.ts     immutable chainable table builder
    client.ts      createHasuraClient factory
    index.ts       hasura entry (exported as @kuindji/typed-graphql/hasura)
```

`package.json` gains `./runtime` and `./hasura` subpath exports. The dist
smoke test asserts the new entries load and expose the documented surface.

### Alternatives considered

- **Single flat runtime module exported from the root.** Rejected: couples the
  type-only core entry to runtime code and mixes Hasura-specific inputs into
  the generic API surface.
- **Separate `@kuindji/typed-graphql-hasura` package.** Rejected: GOALS.md
  explicitly places runtime construction inside `typed-graphql`; a second
  package adds release overhead without isolating anything the subpath export
  does not already isolate.

## Layer 1: typed request and executor boundary (`src/runtime`)

The transport-neutral contract every builder compiles down to:

```ts
type GraphQLRequest = {
    document: string;
    variables: Record<string, unknown>;
    operationName?: string;
    kind: "query" | "mutation" | "subscription";
    /** Path from the response root data object to the payload the caller
     *  asked for, e.g. ["insert_User", "returning"]. */
    resultPath?: readonly string[];
};

type GraphQLObserver = {
    next: (data: unknown) => void;
    error?: (error: unknown) => void;
};

type GraphQLExecutor = {
    /** Resolves with the root `data` object of the GraphQL response. */
    execute: (request: GraphQLRequest) => Promise<unknown>;
    /** Required only when subscriptions are used. Returns unsubscribe. */
    subscribe?: (
        request: GraphQLRequest,
        observer: GraphQLObserver,
    ) => () => void;
};
```

Responsibility split, per GOALS.md:

- **Executor (consumer-owned):** transport, Apollo/fetch/ws ownership,
  authentication and JWT refresh, retry, caching policy, error reporting,
  `__typename` stripping.
- **Library:** document text, variables object, operation metadata, result
  path, and unwrapping the executor's root data along `resultPath`
  (`extractResult(data, path)`; a missing segment yields `null`).

Executor errors propagate as promise rejections or `observer.error` calls.
The library never swallows, reports, or retries errors. TheFloorr's JWT
refresh-and-retry, transient-network retry, Sentry reporting, `#userId`
placeholder rewriting, and `removeTypename` are intentionally NOT ported —
they move into TheFloorr's executor implementation during migration.

`document.ts` provides the reusable assembly helpers the Hasura layer (and
future builders) compose:

- `buildOperationDocument({ kind, name, variableDefinitions, selection })`
  where `variableDefinitions` is a flat `{ name, type }[]` — produces the
  operation header plus body with stable, minimal whitespace;
- a field-arguments helper for wiring variable references into a field's
  argument list (e.g. `user(where: $where, limit: $limit)`).

## Layer 2: Hasura builder (`src/hasura`)

### Schema knowledge

The builder is generic over the same `GraphQLSchema` type the compiler uses —
one schema source of truth:

- table row types: `Schema["schemas"][Schema["defaultSchema"]]`, excluding the
  operation root types named by `rootTypes` (default `Query`/`Mutation`/
  `Subscription`);
- relation topology for nested `where`/`order_by`:
  `Schema["relations"][Schema["defaultSchema"]]` (`type`, `multiple`,
  `nullable` metadata).

Hasura-specific knowledge that `GraphQLSchema` does not carry is supplied at
client creation. The factory is curried so `Schema` is explicit while the
config literals are inferred:

```ts
const client = createHasuraClient<Schema>()({
    executor,
    // Runtime primary-key names; also typed so .id() accepts the branded
    // application type of that column.
    primaryKeys: { User: "id", Post: "id" },
    // Optional default selections, validated lazily per table against the
    // schema when used. Literal types are preserved via const inference.
    defaultSelections: { User: "id email" },
});

const user = client.table("User"); // immutable builder, reusable
```

There is deliberately no `api.camelCasedTable` property map and no runtime
table-name list: `client.table(name)` is typed by `keyof` the schema's table
map, so no runtime registry is needed. TheFloorr migrates with a one-line
wrapper per table (or its own property map) — noted as an intentional
deviation.

Insert shapes cannot be derived from output row types (database defaults make
columns optional on insert). The factory takes an optional second type
parameter:

```ts
createHasuraClient<Schema, InsertTypes>()
// InsertTypes: { [Table]?: object }, default Partial<Row> per table
```

### Builder surface

Ported from `ApiConstructor`, immutable (every method returns a new builder),
`PromiseLike` (executes on `await`):

- **Filters:** `where`, `eq`, `neq`, `in`, `nin`, `gt`, `lt` (with
  `including` flag), `like`, `nlike` (with `caseSensitive` flag), `isNull`,
  `id`. Comparison value types derive from the column type (stricter than
  TheFloorr's `string | number | boolean`).
- **List shaping:** `order`, `limit`, `offset`, `distinctOn`, `all`, `one`.
- **Selection:** `select(graph)` — literal validated with
  `ValidateSelection<G, Schema, Table>` and result typed with
  `GetSelectionType`; `customSelect<T>(graph)` escape hatch.
- **Mutations:** `insert(data)` (single or array), `onConflict(spec | false)`
  (`false` = primary-key constraint with empty `update_columns`, i.e.
  insert-or-ignore), `update(data)`, `remove()`.
- **Aggregates:** `aggregate({ aggregate, nodes })`, `count()`; output object
  type derived from the input as in TheFloorr's `TableAggregateOutput`.
- **Subscriptions:** `subscribe(next)` — requires `executor.subscribe`,
  returns the unsubscribe function.

Dropped from the port: `self()` (meaningless once the builder is genuinely
immutable), `isAggregate()`, the `mode || "list"` juggling (mode transitions
are explicit), and the `then()` implementation bug where an error was thrown
after `resolve` (the new thenable is a straightforward async dispatch).

### Result semantics

- list: resolves `V[]`; a null payload resolves `[]`;
- `one()`: resolves `V | null`; the generated document sets `limit: 1`
  (deviation from TheFloorr, which fetched the full list and took `[0]`);
- `insert`: resolves `V[]` from `insert_<T>.returning`;
- `update`/`remove`: resolve `{ affected_rows: number }`;
- `aggregate`/`count`: resolve the derived aggregate output object;
- when a table has no default selection and neither `select` nor
  `customSelect` was called, the result type is a branded
  `GraphQLError<"NO_SELECTION">` (compile-time signal) and execution throws.

### Generated documents

Same shapes as TheFloorr, with fixes:

- `query List<T>s($where: <T>_bool_exp, $order: [<T>_order_by!], $offset: Int,
  $limit: Int, $distinct_on: [<T>_select_column!])` — `distinct_on` is
  declared and passed when set (TheFloorr's `getMany` silently dropped it);
- `mutation Insert<T>($input: [<T>_insert_input!]!, $conflict:
  <T>_on_conflict)` with `insert_<T>(objects, on_conflict) { returning }`;
- `mutation Update<T>($where: <T>_bool_exp!, $input: <T>_set_input!)` with
  `update_<T> { affected_rows }`;
- `mutation Delete<T>($where: <T>_bool_exp!)` with
  `delete_<T> { affected_rows }`;
- `query Aggregate<T>` over `<T>_aggregate` with the selection produced by the
  ported `generateAggregate` (count/max/min/avg/sum + nodes; empty column
  lists throw);
- `subscribe()` emits `kind: "subscription"` documents for both list and
  aggregate shapes (TheFloorr generated a `query` document for aggregate
  subscriptions; fixed here).

Variable payloads (`where`, `order`, pagination, `input`, `conflict`) travel
as runtime variables and are never serialized inline. The only generated
inline text is selection structure (field lists, aggregate selections).

### Hasura input types

Derived from the schema instead of TheFloorr's generated DB types:

- `WhereField<T>`: `_eq`/`_neq`/`_in`/`_nin`/ordering/string/regex/`_is_null`
  operators, value types narrowed by the column type (string operators only on
  string columns);
- `WhereInput<Schema, Table>`: column operators + `_and`/`_or`/`_not` +
  relation nesting into the related table's `WhereInput`;
- `OrderBy<Schema, Table>`: column → direction, plus one relation level as in
  TheFloorr;
- `TableAggregateInput` / `TableAggregateOutput`: ported with schema-derived
  column keys.

## Error handling

- Invalid selection literals fail at compile time via `ValidateSelection`.
- Builder misuse that cannot be prevented by construction (executing without
  a selection, subscribing without `executor.subscribe`, aggregate with empty
  column list) throws a plain `Error` with a stable message.
- Everything transport-related rejects through the executor untouched.

## Testing

- **Runtime (bun):** mock executor capturing `GraphQLRequest`; assert
  document text (whitespace-normalized), variables, `kind`, `resultPath`,
  result unwrapping (list/one/null/aggregate/affected_rows), onConflict
  handling, subscribe wiring and unsubscribe passthrough.
- **Type-level (expect-type, checked by tsc):** `WhereInput`/`OrderBy`
  derivation including relation nesting, `select()` rejection of invalid
  selections, result types for every mode, branded-id preservation through
  `.id()`/`.eq()` and insert types, `InsertTypes` override.
- **Dist smoke test:** extend `scripts/dist-smoke.mjs` to import
  `./runtime` and `./hasura` subpaths from `dist`.
- **Perf:** `npm run perf` must stay within baseline; the new input types are
  evaluated per call site, not eagerly over all tables (no TheFloorr-style
  whole-API mapped type).

## Out of scope

Apollo/ws client management, React hooks (`useSubscription`), JWT/session
lifecycle, Sentry reporting, `removeTypename`, `#userId` rewriting,
camelCase API property map, and TheFloorr's generated `defaultGraphs` files.
All remain consumer-side, behind the executor boundary or migration glue.
