# Phase 3: Runtime Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a transport-independent typed request/executor boundary and a Hasura runtime builder to `@kuindji/typed-graphql`, per `docs/superpowers/specs/2026-07-02-phase3-runtime-construction-design.md`.

**Architecture:** Two new layers with subpath exports. `src/runtime/` holds the transport-neutral `GraphQLRequest`/`GraphQLExecutor` contract plus generic document assembly. `src/hasura/` holds schema-derived input types (`WhereInput`, `OrderBy`, aggregates), Hasura document generators that produce full `GraphQLRequest` values, an immutable chainable `HasuraTableBuilder`, and the `createHasuraClient` factory. The root package export stays type-only.

**Tech Stack:** TypeScript 6 (NodeNext ESM, `.js` extensions in relative imports), bun test for runtime assertions, `expect-type` for type-level assertions, no runtime dependencies.

## Global Constraints

- ESM only; every relative import uses an explicit `.js` extension.
- No new runtime dependencies; `src/index.ts` must remain type-only (its only runtime export stays `version`).
- All code must typecheck under `npm run typecheck` AND `npm run typecheck:snc` (`strictNullChecks: false`).
- Formatting follows the shared `dprint.json` in the parent `@kuindji` workspace (4-space indent, double quotes, trailing commas).
- Do not touch `src/compiler/` or `src/parsing/`.
- The executor owns transport, auth, retry, caching, error reporting, `__typename` stripping. The library never swallows or retries errors.
- After the final task, `npm run perf` must pass; if the added type-level *tests* push counters past the baseline headroom, run `npm run perf:update` and explain the delta in the commit message (per CONTRIBUTING.md).
- Work directly on `main` (no worktrees/branches — user preference).

## File Structure

```
src/
  runtime/
    request.ts     GraphQLRequest, GraphQLObserver, GraphQLExecutor, extractResult
    document.ts    VariableDefinition, buildOperationDocument, buildFieldArguments
    index.ts       runtime entry
  hasura/
    inputs.ts      HasuraTables, WhereInput, OrderBy, aggregate types
    documents.ts   buildListRequest/buildInsertRequest/... (GraphQLRequest producers)
    builder.ts     HasuraTableBuilder
    client.ts      createHasuraClient, HasuraClientConfig
    index.ts       hasura entry
tests/
  runtime/
    request.test.ts
    document.test.ts
  hasura/
    fixtures.ts          shared TestSchema + mock executor
    inputs.test.ts       type-level
    documents.test.ts
    builder.test.ts
    client.test.ts
```

---

### Task 1: Runtime request boundary (`src/runtime/request.ts`)

**Files:**
- Create: `src/runtime/request.ts`
- Test: `tests/runtime/request.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `GraphQLRequestKind`, `GraphQLRequest`, `GraphQLObserver`, `GraphQLExecutor` (types) and `extractResult(data: unknown, resultPath?: readonly string[]): unknown`. Tasks 4–6 import these from `../runtime/request.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/runtime/request.test.ts`:

```ts
import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type {
    GraphQLExecutor,
    GraphQLRequest,
} from "../../src/runtime/request.js";
import { extractResult } from "../../src/runtime/request.js";

test("extractResult returns data unchanged when no path is given", () => {
    const data = { User: [{ id: "1" }] };
    expect(extractResult(data)).toBe(data);
    expect(extractResult(data, [])).toBe(data);
});

test("extractResult unwraps along the result path", () => {
    const data = { insert_User: { returning: [{ id: "1" }] } };
    expect(extractResult(data, ["insert_User", "returning"]))
        .toEqual([{ id: "1" }]);
});

test("extractResult returns null for missing segments and non-objects", () => {
    expect(extractResult(null, ["User"])).toBeNull();
    expect(extractResult(undefined, ["User"])).toBeNull();
    expect(extractResult({}, ["User"])).toBeNull();
    expect(extractResult({ User: null }, ["User", "x"])).toBeNull();
    expect(extractResult("scalar", ["User"])).toBeNull();
});

test("request and executor types have the documented shape", () => {
    expectTypeOf<GraphQLRequest["kind"]>().toEqualTypeOf<
        "query" | "mutation" | "subscription"
    >();
    expectTypeOf<GraphQLRequest["variables"]>().toEqualTypeOf<
        Record<string, unknown>
    >();
    expectTypeOf<GraphQLExecutor["execute"]>().toEqualTypeOf<
        (request: GraphQLRequest) => Promise<unknown>
    >();
    expectTypeOf<NonNullable<GraphQLExecutor["subscribe"]>>().returns
        .toEqualTypeOf<() => void>();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/runtime/request.test.ts`
Expected: FAIL — cannot resolve `../../src/runtime/request.js`.

- [ ] **Step 3: Write the implementation**

Create `src/runtime/request.ts`:

```ts
// Transport-neutral request/executor boundary (GOALS.md phase 3).
//
// The library compiles builder state down to a GraphQLRequest; the consumer
// injects a GraphQLExecutor that owns transport, authentication, retry,
// caching, error reporting, and __typename stripping. Errors from the
// executor propagate untouched.

export type GraphQLRequestKind = "query" | "mutation" | "subscription";

export interface GraphQLRequest {
    document: string;
    variables: Record<string, unknown>;
    operationName?: string;
    kind: GraphQLRequestKind;
    /** Path from the response root data object to the payload the caller
     *  asked for, e.g. ["insert_User", "returning"]. */
    resultPath?: readonly string[];
}

export interface GraphQLObserver {
    next: (data: unknown) => void;
    error?: (error: unknown) => void;
}

export interface GraphQLExecutor {
    /** Resolves with the root `data` object of the GraphQL response. */
    execute: (request: GraphQLRequest) => Promise<unknown>;
    /** Required only when subscriptions are used. Returns unsubscribe. */
    subscribe?: (
        request: GraphQLRequest,
        observer: GraphQLObserver,
    ) => () => void;
}

/** Unwrap the executor's root data along resultPath. A missing or
 *  non-object segment yields null. */
export function extractResult(
    data: unknown,
    resultPath?: readonly string[],
): unknown {
    if (data === null || data === undefined) {
        return null;
    }
    if (!resultPath || resultPath.length === 0) {
        return data;
    }
    let current: unknown = data;
    for (const key of resultPath) {
        if (
            current === null || current === undefined
            || typeof current !== "object"
        ) {
            return null;
        }
        current = (current as Record<string, unknown>)[key];
    }
    return current ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/runtime/request.test.ts && npx tsc --noEmit`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/request.ts tests/runtime/request.test.ts
git commit -m "Add transport-neutral GraphQL request and executor boundary"
```

---

### Task 2: Generic document assembly (`src/runtime/document.ts`, `src/runtime/index.ts`)

**Files:**
- Create: `src/runtime/document.ts`
- Create: `src/runtime/index.ts`
- Test: `tests/runtime/document.test.ts`

**Interfaces:**
- Consumes: `GraphQLRequestKind` from `./request.js`.
- Produces: `VariableDefinition { name: string; type: string }`, `buildOperationDocument(options: { kind; name; variableDefinitions?; selection }): string`, `buildFieldArguments(args: readonly { name: string; variable: string }[]): string`. Task 4 imports these from `../runtime/document.js`. `src/runtime/index.ts` re-exports everything from both runtime modules.

- [ ] **Step 1: Write the failing test**

Create `tests/runtime/document.test.ts`:

```ts
import { expect, test } from "bun:test";

import {
    buildFieldArguments,
    buildOperationDocument,
} from "../../src/runtime/document.js";

test("buildOperationDocument renders kind, name, variables, selection", () => {
    const document = buildOperationDocument({
        kind: "query",
        name: "ListUsers",
        variableDefinitions: [
            { name: "where", type: "User_bool_exp" },
            { name: "limit", type: "Int" },
        ],
        selection: "User(where: $where, limit: $limit) { id email }",
    });
    expect(document).toBe(
        "query ListUsers($where: User_bool_exp, $limit: Int) "
            + "{ User(where: $where, limit: $limit) { id email } }",
    );
});

test("buildOperationDocument omits the variable list when empty", () => {
    expect(buildOperationDocument({
        kind: "subscription",
        name: "ListUsers",
        selection: "User { id }",
    })).toBe("subscription ListUsers { User { id } }");
    expect(buildOperationDocument({
        kind: "mutation",
        name: "DeleteUser",
        variableDefinitions: [],
        selection: "delete_User { affected_rows }",
    })).toBe("mutation DeleteUser { delete_User { affected_rows } }");
});

test("buildFieldArguments renders a parenthesized list or empty string", () => {
    expect(buildFieldArguments([
        { name: "where", variable: "where" },
        { name: "order_by", variable: "order" },
    ])).toBe("(where: $where, order_by: $order)");
    expect(buildFieldArguments([])).toBe("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/runtime/document.test.ts`
Expected: FAIL — cannot resolve `../../src/runtime/document.js`.

- [ ] **Step 3: Write the implementation**

Create `src/runtime/document.ts`:

```ts
// Generic operation-document assembly. Hasura (and future builders) compose
// these helpers; output whitespace is stable and minimal: a single line with
// single spaces, so tests and consumers can assert document text exactly.

import type { GraphQLRequestKind } from "./request.js";

export interface VariableDefinition {
    name: string;
    type: string;
}

export interface OperationOptions {
    kind: GraphQLRequestKind;
    name: string;
    variableDefinitions?: readonly VariableDefinition[];
    selection: string;
}

export function buildOperationDocument(options: OperationOptions): string {
    const defs = options.variableDefinitions ?? [];
    const header = defs.length === 0
        ? `${options.kind} ${options.name}`
        : `${options.kind} ${options.name}(${
            defs.map((d) => `$${d.name}: ${d.type}`).join(", ")
        })`;
    return `${header} { ${options.selection} }`;
}

export function buildFieldArguments(
    args: readonly { name: string; variable: string }[],
): string {
    if (args.length === 0) {
        return "";
    }
    return `(${args.map((a) => `${a.name}: $${a.variable}`).join(", ")})`;
}
```

Create `src/runtime/index.ts`:

```ts
// @kuindji/typed-graphql/runtime — transport-neutral typed requests and the
// executor boundary. See GOALS.md phase 3.

export type {
    GraphQLExecutor,
    GraphQLObserver,
    GraphQLRequest,
    GraphQLRequestKind,
} from "./request.js";
export { extractResult } from "./request.js";
export type { OperationOptions, VariableDefinition } from "./document.js";
export { buildFieldArguments, buildOperationDocument } from "./document.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/runtime/ && npx tsc --noEmit`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/document.ts src/runtime/index.ts tests/runtime/document.test.ts
git commit -m "Add generic operation document assembly and runtime entry"
```

---

### Task 3: Hasura input types (`src/hasura/inputs.ts`)

**Files:**
- Create: `src/hasura/inputs.ts`
- Create: `tests/hasura/fixtures.ts`
- Test: `tests/hasura/inputs.test.ts`

**Interfaces:**
- Consumes: `GraphQLSchema` from `../schema.js`.
- Produces (all types, no runtime code):
  - `Materialize<T>` — flatten intersections;
  - `NonEmptyArray<T> = [T, ...T[]]`;
  - `HasuraTables<S>`, `HasuraTableName<S>` (string keys), `TableRow<S, T>`, `TableColumn<S, T>` (string column keys), `StringColumn<S, T>` (columns whose non-null value is string);
  - `WhereField<V>`, `WhereInput<S, T>`, `OrderDirection`, `OrderBy<S, T>`;
  - `TableAggregateInput<S, T>`, `TableAggregateOutput<S, T, Input>`, `AggregateResult<S, T, Agg>`.
  Tasks 5–6 import these from `./inputs.js`.

- [ ] **Step 1: Write the shared fixture**

Create `tests/hasura/fixtures.ts`:

```ts
import type {
    GraphQLExecutor,
    GraphQLObserver,
    GraphQLRequest,
} from "../../src/runtime/request.js";

export type UserId = string & { readonly __table: "User" };

export type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {};
            User: {
                id: UserId;
                email: string | null;
                age: number;
                active: boolean;
            };
            Post: {
                id: string;
                title: string;
                userId: UserId;
                rating: number | null;
            };
        };
    };
    relations: {
        public: {
            Query: {
                user: { type: "User"; nullable: true };
            };
            User: {
                posts: { type: "Post"; multiple: true };
            };
            Post: {
                user: { type: "User" };
            };
        };
    };
};

export function createMockExecutor(result: unknown = null) {
    const requests: GraphQLRequest[] = [];
    const observers: GraphQLObserver[] = [];
    let unsubscribed = false;
    const executor: GraphQLExecutor = {
        execute: async (request) => {
            requests.push(request);
            return result;
        },
        subscribe: (request, observer) => {
            requests.push(request);
            observers.push(observer);
            return () => {
                unsubscribed = true;
            };
        },
    };
    return {
        executor,
        requests,
        emit: (data: unknown) => {
            for (const observer of observers) {
                observer.next(data);
            }
        },
        wasUnsubscribed: () => unsubscribed,
    };
}
```

- [ ] **Step 2: Write the failing type-level test**

Create `tests/hasura/inputs.test.ts`:

```ts
import { test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type {
    HasuraTableName,
    OrderBy,
    TableAggregateOutput,
    TableRow,
    WhereInput,
} from "../../src/hasura/inputs.js";
import type { TestSchema, UserId } from "./fixtures.js";

test("HasuraTableName excludes operation roots", () => {
    expectTypeOf<HasuraTableName<TestSchema>>()
        .toEqualTypeOf<"User" | "Post">();
});

test("TableRow resolves the default-schema row type", () => {
    expectTypeOf<TableRow<TestSchema, "User">["id"]>()
        .toEqualTypeOf<UserId>();
});

test("WhereInput narrows operator values by column type", () => {
    type W = WhereInput<TestSchema, "User">;
    const ok: W = {
        id: { _eq: "u1" as UserId },
        age: { _gte: 18 },
        email: { _ilike: "%@x.com", _is_null: false },
        _or: [{ active: { _eq: true } }],
        posts: { title: { _like: "a%" } },
    };
    void ok;
    // @ts-expect-error _eq value must match the column type
    const badValue: W = { age: { _eq: "18" } };
    void badValue;
    // @ts-expect-error string operators are unavailable on number columns
    const badLike: W = { age: { _ilike: "1%" } };
    void badLike;
    // @ts-expect-error unknown columns are rejected
    const badColumn: W = { nope: { _eq: 1 } };
    void badColumn;
});

test("OrderBy covers columns and one relation level", () => {
    type O = OrderBy<TestSchema, "User">;
    const ok: O = { age: "desc", posts: { title: "asc_nulls_last" } };
    void ok;
    // @ts-expect-error direction strings are constrained
    const bad: O = { age: "downwards" };
    void bad;
});

test("TableAggregateOutput derives from the aggregate input", () => {
    type Out = TableAggregateOutput<
        TestSchema,
        "User",
        { count: true; max: ["age"] }
    >;
    expectTypeOf<Out>().toEqualTypeOf<{
        count: number;
        max: { age: number };
    }>();
});
```

- [ ] **Step 3: Run typecheck to verify it fails**

Run: `npx tsc --noEmit`
Expected: FAIL — cannot find module `../../src/hasura/inputs.js`.

- [ ] **Step 4: Write the implementation**

Create `src/hasura/inputs.ts`:

```ts
// Hasura input types derived from the compiler's GraphQLSchema: one schema
// source of truth. Tables come from schemas[defaultSchema] minus the
// operation roots; where/order relation nesting comes from relations.

import type { GraphQLSchema } from "../schema.js";

export type Materialize<T> = { [K in keyof T]: T[K] } & {};

export type NonEmptyArray<T> = readonly [T, ...T[]];

// Optional schema sections are read with the conditional-infer pattern
// (S extends { rootTypes: infer R }), matching src/compiler/compile.ts —
// indexed access on an absent optional property does not resolve.
type RootName<
    S extends GraphQLSchema,
    K extends "query" | "mutation" | "subscription",
    D extends string,
> = S extends { rootTypes: { [P in K]: infer N } }
    ? N extends string ? N : D
    : D;

type RootTypeNames<S extends GraphQLSchema> =
    | RootName<S, "query", "Query">
    | RootName<S, "mutation", "Mutation">
    | RootName<S, "subscription", "Subscription">;

export type HasuraTables<S extends GraphQLSchema> = Omit<
    S["schemas"][S["defaultSchema"]],
    RootTypeNames<S>
>;

export type HasuraTableName<S extends GraphQLSchema> =
    & string
    & keyof HasuraTables<S>;

export type TableRow<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = HasuraTables<S>[T];

export type TableColumn<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = string & keyof TableRow<S, T>;

export type StringColumn<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [K in TableColumn<S, T>]: NonNullable<TableRow<S, T>[K]> extends string
        ? K
        : never;
}[TableColumn<S, T>];

type SchemaRelations<S extends GraphQLSchema> = S extends
    { relations: infer R }
    ? S["defaultSchema"] extends keyof R ? R[S["defaultSchema"]] : {}
    : {};

type TableRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = T extends keyof SchemaRelations<S> ? SchemaRelations<S>[T] : {};

type StringOperators = {
    _like?: string;
    _nlike?: string;
    _ilike?: string;
    _nilike?: string;
    _regex?: string;
    _iregex?: string;
    _nregex?: string;
    _niregex?: string;
    _similar?: string;
    _nsimilar?: string;
};

export type WhereField<V> =
    & {
        _eq?: V;
        _neq?: V;
        _in?: V[];
        _nin?: V[];
        _gt?: V;
        _gte?: V;
        _lt?: V;
        _lte?: V;
        _is_null?: boolean;
    }
    & (V extends string ? StringOperators : {});

type WhereColumns<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [K in TableColumn<S, T>]?: WhereField<NonNullable<TableRow<S, T>[K]>>;
};

type WhereRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [R in string & keyof TableRelations<S, T>]?:
        TableRelations<S, T>[R] extends { type: infer RT }
            ? RT extends HasuraTableName<S> ? WhereInput<S, RT>
            : never
            : never;
};

export type WhereInput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> =
    & {
        _and?: WhereInput<S, T> | WhereInput<S, T>[];
        _or?: WhereInput<S, T> | WhereInput<S, T>[];
        _not?: WhereInput<S, T> | WhereInput<S, T>[];
    }
    & WhereColumns<S, T>
    & WhereRelations<S, T>;

export type OrderDirection =
    | "asc"
    | "desc"
    | "asc_nulls_first"
    | "asc_nulls_last"
    | "desc_nulls_first"
    | "desc_nulls_last";

type OrderRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [R in string & keyof TableRelations<S, T>]?:
        TableRelations<S, T>[R] extends { type: infer RT }
            ? RT extends HasuraTableName<S>
                ? { [K in TableColumn<S, RT>]?: OrderDirection }
            : never
            : never;
};

export type OrderBy<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> =
    & { [K in TableColumn<S, T>]?: OrderDirection }
    & OrderRelations<S, T>;

export type TableAggregateInput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    count?: true | {
        columns?: TableColumn<S, T>;
        distinct?: boolean;
    };
    max?: NonEmptyArray<TableColumn<S, T>>;
    min?: NonEmptyArray<TableColumn<S, T>>;
    avg?: NonEmptyArray<TableColumn<S, T>>;
    sum?: NonEmptyArray<TableColumn<S, T>>;
};

type AggregateColumns<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Columns,
> = Columns extends readonly (infer C)[]
    ? { [K in C & TableColumn<S, T>]: TableRow<S, T>[K] }
    : never;

export type TableAggregateOutput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Input,
> = Materialize<
    & (Input extends { count: {} | true } ? { count: number } : {})
    & (Input extends { max: infer M } ? { max: AggregateColumns<S, T, M> }
        : {})
    & (Input extends { min: infer M } ? { min: AggregateColumns<S, T, M> }
        : {})
    & (Input extends { avg: infer M } ? { avg: AggregateColumns<S, T, M> }
        : {})
    & (Input extends { sum: infer M } ? { sum: AggregateColumns<S, T, M> }
        : {})
>;

export type AggregateResult<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Agg,
> = Materialize<
    & (Agg extends { aggregate: infer A }
        ? { aggregate: TableAggregateOutput<S, T, A> }
        : {})
    & (Agg extends { nodes: infer N }
        ? N extends readonly (infer C)[]
            ? { nodes: { [K in C & TableColumn<S, T>]: TableRow<S, T>[K] }[] }
        : {}
        : {})
>;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsc --noEmit && npm run typecheck:snc && bun test tests/hasura/inputs.test.ts`
Expected: typechecks clean (both configs), test file PASSes (assertions are compile-time; bun run confirms no import errors).

- [ ] **Step 6: Commit**

```bash
git add src/hasura/inputs.ts tests/hasura/fixtures.ts tests/hasura/inputs.test.ts
git commit -m "Add schema-derived Hasura where/order/aggregate input types"
```

---

### Task 4: Hasura document generators (`src/hasura/documents.ts`)

**Files:**
- Create: `src/hasura/documents.ts`
- Test: `tests/hasura/documents.test.ts`

**Interfaces:**
- Consumes: `GraphQLRequest` from `../runtime/request.js`; `buildOperationDocument`, `buildFieldArguments`, `VariableDefinition` from `../runtime/document.js`.
- Produces (runtime functions returning complete `GraphQLRequest` values):
  - `ConflictSpec { constraint: string; update_columns: readonly string[] }`;
  - `AggregateSelectionInput { count?; max?; min?; avg?; sum? }`;
  - `generateAggregateSelection(input?: AggregateSelectionInput, nodes?: readonly string[]): string`;
  - `buildListRequest({ table, selection, where?, order?, offset?, limit?, distinctOn?, kind? })`;
  - `buildInsertRequest({ table, selection, data, conflict? })`;
  - `buildUpdateRequest({ table, where, data })`;
  - `buildDeleteRequest({ table, where })`;
  - `buildAggregateRequest({ table, aggregate?, nodes?, where?, order?, distinctOn?, kind? })`.
  Task 5 imports all of these from `./documents.js`.

- [ ] **Step 1: Write the failing test**

Create `tests/hasura/documents.test.ts`:

```ts
import { expect, test } from "bun:test";

import {
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    generateAggregateSelection,
} from "../../src/hasura/documents.js";

test("buildListRequest declares only the variables that are set", () => {
    const request = buildListRequest({
        table: "User",
        selection: "id email",
        where: { active: { _eq: true } },
        limit: 10,
    });
    expect(request.document).toBe(
        "query ListUsers($where: User_bool_exp, $limit: Int) "
            + "{ User(where: $where, limit: $limit) { id email } }",
    );
    expect(request.variables).toEqual({
        where: { active: { _eq: true } },
        limit: 10,
    });
    expect(request.kind).toBe("query");
    expect(request.operationName).toBe("ListUsers");
    expect(request.resultPath).toEqual(["User"]);
});

test("buildListRequest supports every list variable and subscriptions", () => {
    const request = buildListRequest({
        table: "Post",
        selection: "id",
        where: {},
        order: { title: "asc" },
        offset: 5,
        limit: 2,
        distinctOn: "title",
        kind: "subscription",
    });
    expect(request.document).toBe(
        "subscription ListPosts($where: Post_bool_exp, "
            + "$order: [Post_order_by!], $offset: Int, $limit: Int, "
            + "$distinct_on: [Post_select_column!]) "
            + "{ Post(where: $where, order_by: $order, offset: $offset, "
            + "limit: $limit, distinct_on: $distinct_on) { id } }",
    );
    expect(request.variables.distinct_on).toBe("title");
    expect(request.kind).toBe("subscription");
});

test("buildInsertRequest normalizes data and handles conflict variants", () => {
    const single = buildInsertRequest({
        table: "User",
        selection: "id",
        data: { id: "1" },
    });
    expect(single.document).toBe(
        "mutation InsertUser($input: [User_insert_input!]!) "
            + "{ insert_User(objects: $input) { returning { id } } }",
    );
    expect(single.variables).toEqual({ input: [{ id: "1" }] });
    expect(single.kind).toBe("mutation");
    expect(single.resultPath).toEqual(["insert_User", "returning"]);

    const ignore = buildInsertRequest({
        table: "User",
        selection: "id",
        data: [{ id: "1" }, { id: "2" }],
        conflict: false,
    });
    expect(ignore.document).toBe(
        "mutation InsertUser($input: [User_insert_input!]!, "
            + "$conflict: User_on_conflict) "
            + "{ insert_User(objects: $input, on_conflict: $conflict) "
            + "{ returning { id } } }",
    );
    expect(ignore.variables.conflict).toEqual({
        constraint: "User_pkey",
        update_columns: [],
    });
    expect(ignore.variables.input).toEqual([{ id: "1" }, { id: "2" }]);
});

test("buildUpdateRequest and buildDeleteRequest target affected_rows", () => {
    const update = buildUpdateRequest({
        table: "User",
        where: { id: { _eq: "1" } },
        data: { email: "a@b.c" },
    });
    expect(update.document).toBe(
        "mutation UpdateUser($where: User_bool_exp!, $input: User_set_input!) "
            + "{ update_User(where: $where, _set: $input) { affected_rows } }",
    );
    expect(update.variables).toEqual({
        where: { id: { _eq: "1" } },
        input: { email: "a@b.c" },
    });
    expect(update.resultPath).toEqual(["update_User"]);

    const remove = buildDeleteRequest({
        table: "User",
        where: { id: { _eq: "1" } },
    });
    expect(remove.document).toBe(
        "mutation DeleteUser($where: User_bool_exp!) "
            + "{ delete_User(where: $where) { affected_rows } }",
    );
    expect(remove.resultPath).toEqual(["delete_User"]);
});

test("generateAggregateSelection ports TheFloorr behavior", () => {
    expect(generateAggregateSelection({ count: true })).toBe(
        "aggregate { count }",
    );
    expect(generateAggregateSelection(
        { count: { columns: "id", distinct: true }, max: ["age"] },
        ["id", "email"],
    )).toBe(
        "aggregate { count(columns: id, distinct: true) max { age } } "
            + "nodes { id email }",
    );
    expect(() => generateAggregateSelection({ max: [] as never }))
        .toThrow("max must have at least one column");
});

test("buildAggregateRequest wraps the aggregate selection", () => {
    const request = buildAggregateRequest({
        table: "User",
        aggregate: { count: true },
        where: { active: { _eq: true } },
        kind: "subscription",
    });
    expect(request.document).toBe(
        "subscription AggregateUser($where: User_bool_exp) "
            + "{ User_aggregate(where: $where) { aggregate { count } } }",
    );
    expect(request.kind).toBe("subscription");
    expect(request.resultPath).toEqual(["User_aggregate"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/hasura/documents.test.ts`
Expected: FAIL — cannot resolve `../../src/hasura/documents.js`.

- [ ] **Step 3: Write the implementation**

Create `src/hasura/documents.ts`:

```ts
// Hasura document generators. Each produces a complete GraphQLRequest:
// document text (stable single-line whitespace), variables, operation name,
// kind, and resultPath. Payloads (where/order/input/conflict) always travel
// as variables, never inline; only selection structure is generated text.

import {
    buildFieldArguments,
    buildOperationDocument,
    type VariableDefinition,
} from "../runtime/document.js";
import type { GraphQLRequest } from "../runtime/request.js";

export interface ConflictSpec {
    constraint: string;
    update_columns: readonly string[];
}

export interface AggregateSelectionInput {
    count?: true | { columns?: string; distinct?: boolean };
    max?: readonly string[];
    min?: readonly string[];
    avg?: readonly string[];
    sum?: readonly string[];
}

type FieldArgument = { name: string; variable: string };

type ListRequestArgs = {
    table: string;
    selection: string;
    where?: unknown;
    order?: unknown;
    offset?: number;
    limit?: number;
    distinctOn?: string;
    kind?: "query" | "subscription";
};

export function buildListRequest(args: ListRequestArgs): GraphQLRequest {
    const kind = args.kind ?? "query";
    const defs: VariableDefinition[] = [];
    const fieldArgs: FieldArgument[] = [];
    const variables: Record<string, unknown> = {};
    if (args.where !== undefined) {
        defs.push({ name: "where", type: `${args.table}_bool_exp` });
        fieldArgs.push({ name: "where", variable: "where" });
        variables.where = args.where;
    }
    if (args.order !== undefined) {
        defs.push({ name: "order", type: `[${args.table}_order_by!]` });
        fieldArgs.push({ name: "order_by", variable: "order" });
        variables.order = args.order;
    }
    if (args.offset !== undefined) {
        defs.push({ name: "offset", type: "Int" });
        fieldArgs.push({ name: "offset", variable: "offset" });
        variables.offset = args.offset;
    }
    if (args.limit !== undefined) {
        defs.push({ name: "limit", type: "Int" });
        fieldArgs.push({ name: "limit", variable: "limit" });
        variables.limit = args.limit;
    }
    if (args.distinctOn !== undefined) {
        defs.push({
            name: "distinct_on",
            type: `[${args.table}_select_column!]`,
        });
        fieldArgs.push({ name: "distinct_on", variable: "distinct_on" });
        variables.distinct_on = args.distinctOn;
    }
    const name = `List${args.table}s`;
    return {
        document: buildOperationDocument({
            kind,
            name,
            variableDefinitions: defs,
            selection: `${args.table}${buildFieldArguments(fieldArgs)} { ${
                args.selection
            } }`,
        }),
        variables,
        operationName: name,
        kind,
        resultPath: [args.table],
    };
}

type InsertRequestArgs = {
    table: string;
    selection: string;
    data: unknown;
    /** `false` = insert-or-ignore: primary-key constraint with empty
     *  update_columns. `undefined` = no on_conflict clause. */
    conflict?: ConflictSpec | false;
};

export function buildInsertRequest(args: InsertRequestArgs): GraphQLRequest {
    const objects = Array.isArray(args.data) ? args.data : [args.data];
    const conflict: ConflictSpec | undefined = args.conflict === false
        ? { constraint: `${args.table}_pkey`, update_columns: [] }
        : args.conflict;
    const defs: VariableDefinition[] = [
        { name: "input", type: `[${args.table}_insert_input!]!` },
    ];
    const fieldArgs: FieldArgument[] = [
        { name: "objects", variable: "input" },
    ];
    const variables: Record<string, unknown> = { input: objects };
    if (conflict !== undefined) {
        defs.push({ name: "conflict", type: `${args.table}_on_conflict` });
        fieldArgs.push({ name: "on_conflict", variable: "conflict" });
        variables.conflict = conflict;
    }
    const name = `Insert${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: defs,
            selection: `insert_${args.table}${
                buildFieldArguments(fieldArgs)
            } { returning { ${args.selection} } }`,
        }),
        variables,
        operationName: name,
        kind: "mutation",
        resultPath: [`insert_${args.table}`, "returning"],
    };
}

export function buildUpdateRequest(args: {
    table: string;
    where: unknown;
    data: unknown;
}): GraphQLRequest {
    const name = `Update${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: [
                { name: "where", type: `${args.table}_bool_exp!` },
                { name: "input", type: `${args.table}_set_input!` },
            ],
            selection: `update_${args.table}(where: $where, _set: $input) `
                + `{ affected_rows }`,
        }),
        variables: { where: args.where, input: args.data },
        operationName: name,
        kind: "mutation",
        resultPath: [`update_${args.table}`],
    };
}

export function buildDeleteRequest(args: {
    table: string;
    where: unknown;
}): GraphQLRequest {
    const name = `Delete${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: [
                { name: "where", type: `${args.table}_bool_exp!` },
            ],
            selection: `delete_${args.table}(where: $where) `
                + `{ affected_rows }`,
        }),
        variables: { where: args.where },
        operationName: name,
        kind: "mutation",
        resultPath: [`delete_${args.table}`],
    };
}

export function generateAggregateSelection(
    input: AggregateSelectionInput = {},
    nodes?: readonly string[],
): string {
    const aggParts: string[] = [];
    if (input.count === true) {
        aggParts.push("count");
    }
    else if (input.count !== undefined) {
        const parts: string[] = [];
        if (input.count.columns !== undefined) {
            parts.push(`columns: ${input.count.columns}`);
        }
        if (input.count.distinct !== undefined) {
            parts.push(`distinct: ${input.count.distinct ? "true" : "false"}`);
        }
        aggParts.push(`count(${parts.join(", ")})`);
    }
    for (const key of ["max", "min", "avg", "sum"] as const) {
        const columns = input[key];
        if (columns === undefined) {
            continue;
        }
        if (columns.length === 0) {
            throw new Error(`${key} must have at least one column`);
        }
        aggParts.push(`${key} { ${columns.join(" ")} }`);
    }
    const outputParts: string[] = [];
    if (aggParts.length > 0) {
        outputParts.push(`aggregate { ${aggParts.join(" ")} }`);
    }
    if (nodes !== undefined && nodes.length > 0) {
        outputParts.push(`nodes { ${nodes.join(" ")} }`);
    }
    return outputParts.join(" ");
}

type AggregateRequestArgs = {
    table: string;
    aggregate?: AggregateSelectionInput;
    nodes?: readonly string[];
    where?: unknown;
    order?: unknown;
    distinctOn?: string;
    kind?: "query" | "subscription";
};

export function buildAggregateRequest(
    args: AggregateRequestArgs,
): GraphQLRequest {
    const kind = args.kind ?? "query";
    const defs: VariableDefinition[] = [];
    const fieldArgs: FieldArgument[] = [];
    const variables: Record<string, unknown> = {};
    if (args.where !== undefined) {
        defs.push({ name: "where", type: `${args.table}_bool_exp` });
        fieldArgs.push({ name: "where", variable: "where" });
        variables.where = args.where;
    }
    if (args.distinctOn !== undefined) {
        defs.push({
            name: "distinct_on",
            type: `[${args.table}_select_column!]`,
        });
        fieldArgs.push({ name: "distinct_on", variable: "distinct_on" });
        variables.distinct_on = args.distinctOn;
    }
    if (args.order !== undefined) {
        defs.push({ name: "order", type: `[${args.table}_order_by!]` });
        fieldArgs.push({ name: "order_by", variable: "order" });
        variables.order = args.order;
    }
    const name = `Aggregate${args.table}`;
    return {
        document: buildOperationDocument({
            kind,
            name,
            variableDefinitions: defs,
            selection: `${args.table}_aggregate${
                buildFieldArguments(fieldArgs)
            } { ${generateAggregateSelection(args.aggregate, args.nodes)} }`,
        }),
        variables,
        operationName: name,
        kind,
        resultPath: [`${args.table}_aggregate`],
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/hasura/documents.test.ts && npx tsc --noEmit`
Expected: all tests PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/hasura/documents.ts tests/hasura/documents.test.ts
git commit -m "Add Hasura document generators producing typed requests"
```

---

### Task 5: Hasura table builder (`src/hasura/builder.ts`)

**Files:**
- Create: `src/hasura/builder.ts`
- Test: `tests/hasura/builder.test.ts`

**Interfaces:**
- Consumes: `extractResult`, `GraphQLExecutor`, `GraphQLRequest` from `../runtime/request.js`; all `build*Request` functions and `ConflictSpec`, `AggregateSelectionInput` from `./documents.js`; input types from `./inputs.js`; `GetSelectionType`, `ValidateSelection` from `../index.js` (type-only); `GraphQLError` from `../diagnostics.js` (type-only).
- Produces:
  - `NoSelection` — `GraphQLError<"NO_SELECTION", "...">` brand;
  - `BuilderState` (internal shape, exported for the client factory): `{ table: string; executor: GraphQLExecutor; mode: "list" | "single" | "aggregate" | "insert" | "update" | "remove"; selection: string | null; primaryKey: string | null; where?: Record<string, unknown>; order?: unknown; offset?: number; limit?: number; distinctOn?: string; agg?: { aggregate?: AggregateSelectionInput; nodes?: readonly string[] }; data?: unknown; conflict?: ConflictSpec | false }`;
  - `class HasuraTableBuilder<S, T, V, Insert, PK, IsSingle extends boolean = false, IsNullable extends boolean = false, Result = ...> implements PromiseLike<Result>` with `constructor(state: BuilderState)`.
  Task 6 constructs it via `new HasuraTableBuilder(state)`.

- [ ] **Step 1: Write the failing test**

Create `tests/hasura/builder.test.ts`:

```ts
import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import { HasuraTableBuilder } from "../../src/hasura/builder.js";
import type { GraphQLExecutor } from "../../src/runtime/request.js";
import { createMockExecutor, type TestSchema, type UserId } from "./fixtures.js";

function userBuilder(executor: GraphQLExecutor) {
    return new HasuraTableBuilder<
        TestSchema,
        "User",
        { id: UserId; email: string | null },
        Partial<{ id: UserId; email: string | null; age: number; active: boolean }>,
        UserId
    >({
        table: "User",
        executor,
        mode: "list",
        selection: "id email",
        primaryKey: "id",
    });
}

test("await on a list builder resolves [] for a null payload", async () => {
    const mock = createMockExecutor(null);
    const result = await userBuilder(mock.executor);
    expect(result).toEqual([]);
    expect(mock.requests[0]!.document).toBe(
        "query ListUsers { User { id email } }",
    );
});

test("filters merge into where and land in variables", async () => {
    const mock = createMockExecutor({ User: [] });
    await userBuilder(mock.executor)
        .eq("active", true)
        .gt("age", 18, true)
        .like("email", "%@x.com")
        .isNull("email", false)
        .limit(10);
    expect(mock.requests[0]!.variables).toEqual({
        where: {
            active: { _eq: true },
            age: { _gte: 18 },
            email: { _ilike: "%@x.com", _is_null: false },
        },
        limit: 10,
    });
});

test("one() forces limit 1 and resolves the first row or null", async () => {
    const row = { id: "u1", email: null };
    const mock = createMockExecutor({ User: [row] });
    const single = await userBuilder(mock.executor).eq("active", true).one();
    expect(single).toEqual(row);
    expect(mock.requests[0]!.variables.limit).toBe(1);

    const empty = createMockExecutor({ User: [] });
    const missing = await userBuilder(empty.executor).one();
    expect(missing).toBeNull();
});

test("id() uses the configured primary key and throws without one", async () => {
    const mock = createMockExecutor({ User: [] });
    await userBuilder(mock.executor).id("u1" as UserId).one();
    expect(mock.requests[0]!.variables.where).toEqual({
        id: { _eq: "u1" },
    });

    const noPk = new HasuraTableBuilder({
        table: "User",
        executor: mock.executor,
        mode: "list",
        selection: "id",
        primaryKey: null,
    });
    expect(() => noPk.id("u1")).toThrow(
        "User has no primary key configured",
    );
});

test("insert resolves the returning list", async () => {
    const mock = createMockExecutor({
        insert_User: { returning: [{ id: "u1", email: null }] },
    });
    const rows = await userBuilder(mock.executor)
        .insert({ id: "u1" as UserId })
        .onConflict(false);
    expect(rows).toEqual([{ id: "u1", email: null }]);
    expect(mock.requests[0]!.variables.conflict).toEqual({
        constraint: "User_pkey",
        update_columns: [],
    });
});

test("update and remove require a where filter and resolve affected_rows", async () => {
    const mock = createMockExecutor({ update_User: { affected_rows: 3 } });
    const updated = await userBuilder(mock.executor)
        .eq("active", false)
        .update({ email: null });
    expect(updated).toEqual({ affected_rows: 3 });
    expectTypeOf(updated).toEqualTypeOf<{ affected_rows: number }>();

    // Promise.resolve() adopts the thenable so bun's .rejects sees a Promise
    await expect(Promise.resolve(userBuilder(mock.executor).update({ email: null })))
        .rejects.toThrow("update() requires a where filter");
    await expect(Promise.resolve(userBuilder(mock.executor).remove()))
        .rejects.toThrow("remove() requires a where filter");
});

test("count() resolves the aggregate count object", async () => {
    const mock = createMockExecutor({
        User_aggregate: { aggregate: { count: 7 } },
    });
    const result = await userBuilder(mock.executor).count();
    expect(result).toEqual({ aggregate: { count: 7 } });
    expectTypeOf(result).toEqualTypeOf<{ aggregate: { count: number } }>();
});

test("select() re-types the result from the literal selection", async () => {
    const mock = createMockExecutor({ User: [{ id: "u1" }] });
    const rows = await userBuilder(mock.executor).select("id");
    expectTypeOf(rows).toEqualTypeOf<{ id: UserId }[]>();
    expect(mock.requests[0]!.document).toBe(
        "query ListUsers { User { id } }",
    );
});

test("select() rejects invalid selections at compile time", () => {
    const mock = createMockExecutor(null);
    // @ts-expect-error "nope" is not a User field
    userBuilder(mock.executor).select("nope");
});

test("executing without a selection throws", async () => {
    const mock = createMockExecutor(null);
    const builder = new HasuraTableBuilder({
        table: "User",
        executor: mock.executor,
        mode: "list",
        selection: null,
        primaryKey: null,
    });
    await expect(Promise.resolve(builder as PromiseLike<unknown>)).rejects
        .toThrow('No selection for table "User"');
});

test("subscribe() unwraps payloads and returns unsubscribe", () => {
    const mock = createMockExecutor();
    const seen: unknown[] = [];
    const unsubscribe = userBuilder(mock.executor)
        .eq("active", true)
        .subscribe((rows) => seen.push(rows));
    expect(mock.requests[0]!.kind).toBe("subscription");
    mock.emit({ User: [{ id: "u1", email: null }] });
    expect(seen).toEqual([[{ id: "u1", email: null }]]);
    unsubscribe();
    expect(mock.wasUnsubscribed()).toBe(true);
});

test("subscribe() with an aggregate emits a subscription document", () => {
    const mock = createMockExecutor();
    userBuilder(mock.executor).count().subscribe(() => {});
    expect(mock.requests[0]!.document).toBe(
        "subscription AggregateUser { User_aggregate { aggregate { count } } }",
    );
});

test("subscribe() without executor.subscribe throws", () => {
    const bare: GraphQLExecutor = { execute: async () => null };
    expect(() => userBuilder(bare).subscribe(() => {})).toThrow(
        "executor.subscribe is not configured",
    );
});

test("builders are immutable — chaining never mutates the source", async () => {
    const mock = createMockExecutor({ User: [] });
    const base = userBuilder(mock.executor);
    const filtered = base.eq("active", true);
    expect(filtered).not.toBe(base);
    await base;
    expect(mock.requests[0]!.variables).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/hasura/builder.test.ts`
Expected: FAIL — cannot resolve `../../src/hasura/builder.js`.

- [ ] **Step 3: Write the implementation**

Create `src/hasura/builder.ts`:

```ts
// Immutable chainable Hasura table builder — a cleaned-up port of
// TheFloorr's ApiConstructor. Every method returns a new builder; awaiting
// the builder compiles state into a GraphQLRequest and runs it through the
// injected executor. Deviations from TheFloorr are documented in
// docs/superpowers/specs/2026-07-02-phase3-runtime-construction-design.md:
// one() sets limit 1, update/remove require a where filter, subscriptions
// always emit subscription documents, and there is no self()/isAggregate().

import type { GraphQLError } from "../diagnostics.js";
import type { GetSelectionType, ValidateSelection } from "../index.js";
import {
    extractResult,
    type GraphQLExecutor,
    type GraphQLRequest,
} from "../runtime/request.js";
import {
    type AggregateSelectionInput,
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    type ConflictSpec,
} from "./documents.js";
import type {
    AggregateResult,
    HasuraTableName,
    NonEmptyArray,
    OrderBy,
    StringColumn,
    TableAggregateInput,
    TableColumn,
    TableRow,
    WhereInput,
} from "./inputs.js";
import type { GraphQLSchema } from "../schema.js";

export type NoSelection = GraphQLError<
    "NO_SELECTION",
    "Call select()/customSelect() or configure a default selection for this table"
>;

type BuilderMode =
    | "list"
    | "single"
    | "aggregate"
    | "insert"
    | "update"
    | "remove";

export interface BuilderState {
    table: string;
    executor: GraphQLExecutor;
    mode: BuilderMode;
    selection: string | null;
    primaryKey: string | null;
    where?: Record<string, unknown>;
    order?: unknown;
    offset?: number;
    limit?: number;
    distinctOn?: string;
    agg?: { aggregate?: AggregateSelectionInput; nodes?: readonly string[] };
    data?: unknown;
    conflict?: ConflictSpec | false;
}

export class HasuraTableBuilder<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    V,
    Insert,
    PK,
    IsSingle extends boolean = false,
    IsNullable extends boolean = false,
    Result = IsSingle extends true ? IsNullable extends true ? V | null : V
        : V[],
> implements PromiseLike<Result> {
    private readonly state: BuilderState;

    constructor(state: BuilderState) {
        this.state = state;
    }

    private next<
        V2 = V,
        S2 extends boolean = IsSingle,
        N2 extends boolean = IsNullable,
    >(patch: Partial<BuilderState>) {
        return new HasuraTableBuilder<S, T, V2, Insert, PK, S2, N2>({
            ...this.state,
            ...patch,
        });
    }

    private mergeWhere(condition: Record<string, unknown>) {
        return { ...this.state.where, ...condition };
    }

    where(where: WhereInput<S, T>) {
        return this.next({
            where: this.mergeWhere(where as Record<string, unknown>),
        });
    }

    eq<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
    ) {
        return this.next({
            where: this.mergeWhere({ [field]: { _eq: value } }),
        });
    }

    neq<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
    ) {
        return this.next({
            where: this.mergeWhere({ [field]: { _neq: value } }),
        });
    }

    in<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>[],
    ) {
        return this.next({
            where: this.mergeWhere({ [field]: { _in: value } }),
        });
    }

    nin<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>[],
    ) {
        return this.next({
            where: this.mergeWhere({ [field]: { _nin: value } }),
        });
    }

    gt<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
        including: boolean = false,
    ) {
        const op = including ? "_gte" : "_gt";
        return this.next({
            where: this.mergeWhere({ [field]: { [op]: value } }),
        });
    }

    lt<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
        including: boolean = false,
    ) {
        const op = including ? "_lte" : "_lt";
        return this.next({
            where: this.mergeWhere({ [field]: { [op]: value } }),
        });
    }

    like(
        field: StringColumn<S, T>,
        value: string,
        caseSensitive: boolean = false,
    ) {
        const op = caseSensitive ? "_like" : "_ilike";
        return this.next({
            where: this.mergeWhere({ [field]: { [op]: value } }),
        });
    }

    nlike(
        field: StringColumn<S, T>,
        value: string,
        caseSensitive: boolean = false,
    ) {
        const op = caseSensitive ? "_nlike" : "_nilike";
        return this.next({
            where: this.mergeWhere({ [field]: { [op]: value } }),
        });
    }

    isNull(field: TableColumn<S, T>, value: boolean) {
        const existing = this.state.where?.[field];
        return this.next({
            where: this.mergeWhere({
                [field]: {
                    ...(typeof existing === "object" ? existing : undefined),
                    _is_null: value,
                },
            }),
        });
    }

    id(value: PK) {
        if (this.state.primaryKey === null) {
            throw new Error(
                `${this.state.table} has no primary key configured`,
            );
        }
        return this.next({
            where: this.mergeWhere({
                [this.state.primaryKey]: { _eq: value },
            }),
        });
    }

    order(order: OrderBy<S, T>) {
        return this.next({ order });
    }

    offset(offset: number) {
        return this.next({ offset });
    }

    limit(limit: number) {
        return this.next({ limit });
    }

    distinctOn(column: TableColumn<S, T>) {
        return this.next({ distinctOn: column });
    }

    select<G extends string>(
        graph: G & (ValidateSelection<G, S, T> extends true ? unknown
            : never),
    ) {
        return this.next<GetSelectionType<G, S, T>>({ selection: graph });
    }

    customSelect<Custom extends object>(graph: string) {
        return this.next<Custom>({ selection: graph });
    }

    all() {
        return this.next<V, false, false>({ mode: "list" });
    }

    one() {
        return this.next<V, true, true>({ mode: "single" });
    }

    insert(data: Insert | Insert[]) {
        return this.next<V, false, false>({ mode: "insert", data });
    }

    onConflict(conflict: ConflictSpec | false) {
        return this.next({ conflict });
    }

    update(data: Partial<Insert>) {
        return this.next<{ affected_rows: number }, true, false>({
            mode: "update",
            data,
        });
    }

    remove() {
        return this.next<{ affected_rows: number }, true, false>({
            mode: "remove",
        });
    }

    aggregate<
        const Agg extends {
            aggregate?: TableAggregateInput<S, T>;
            nodes?: NonEmptyArray<TableColumn<S, T>>;
        },
    >(agg: Agg) {
        return this.next<AggregateResult<S, T, Agg>, true, false>({
            mode: "aggregate",
            agg: agg as BuilderState["agg"],
        });
    }

    count() {
        return this.aggregate({ aggregate: { count: true } });
    }

    subscribe(next: (data: Result) => void): () => void {
        const subscribeFn = this.state.executor.subscribe;
        if (!subscribeFn) {
            throw new Error("executor.subscribe is not configured");
        }
        if (
            this.state.mode === "insert" || this.state.mode === "update"
            || this.state.mode === "remove"
        ) {
            throw new Error("subscribe() supports list and aggregate modes");
        }
        const request = this.buildRequest("subscription");
        return subscribeFn(request, {
            next: (data) => {
                next(
                    this.unwrap(
                        extractResult(data, request.resultPath),
                    ) as Result,
                );
            },
        });
    }

    then<TResult1 = Result, TResult2 = never>(
        onfulfilled?:
            | ((value: Result) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.run().then(onfulfilled, onrejected);
    }

    private async run(): Promise<Result> {
        const request = this.buildRequest();
        const data = await this.state.executor.execute(request);
        return this.unwrap(extractResult(data, request.resultPath)) as Result;
    }

    private unwrap(payload: unknown): unknown {
        switch (this.state.mode) {
            case "single":
                return Array.isArray(payload) ? payload[0] ?? null : null;
            case "list":
            case "insert":
                return payload ?? [];
            default:
                return payload ?? null;
        }
    }

    private requireSelection(): string {
        if (this.state.selection === null) {
            throw new Error(
                `No selection for table "${this.state.table}": call `
                    + "select()/customSelect() or configure defaultSelections",
            );
        }
        return this.state.selection;
    }

    private buildRequest(
        listKind: "query" | "subscription" = "query",
    ): GraphQLRequest {
        const state = this.state;
        switch (state.mode) {
            case "list":
            case "single":
                return buildListRequest({
                    table: state.table,
                    selection: this.requireSelection(),
                    where: state.where,
                    order: state.order,
                    offset: state.offset,
                    limit: state.mode === "single" ? 1 : state.limit,
                    distinctOn: state.distinctOn,
                    kind: listKind,
                });
            case "aggregate":
                return buildAggregateRequest({
                    table: state.table,
                    aggregate: state.agg?.aggregate,
                    nodes: state.agg?.nodes,
                    where: state.where,
                    order: state.order,
                    distinctOn: state.distinctOn,
                    kind: listKind,
                });
            case "insert":
                return buildInsertRequest({
                    table: state.table,
                    selection: this.requireSelection(),
                    data: state.data,
                    conflict: state.conflict,
                });
            case "update":
                if (state.where === undefined) {
                    throw new Error("update() requires a where filter");
                }
                return buildUpdateRequest({
                    table: state.table,
                    where: state.where,
                    data: state.data,
                });
            case "remove":
                if (state.where === undefined) {
                    throw new Error("remove() requires a where filter");
                }
                return buildDeleteRequest({
                    table: state.table,
                    where: state.where,
                });
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/hasura/builder.test.ts && npx tsc --noEmit && npm run typecheck:snc`
Expected: all tests PASS, both typechecks clean.

- [ ] **Step 5: Commit**

```bash
git add src/hasura/builder.ts tests/hasura/builder.test.ts
git commit -m "Add immutable Hasura table builder with typed execution"
```

---

### Task 6: Client factory and hasura entry (`src/hasura/client.ts`, `src/hasura/index.ts`)

**Files:**
- Create: `src/hasura/client.ts`
- Create: `src/hasura/index.ts`
- Test: `tests/hasura/client.test.ts`

**Interfaces:**
- Consumes: `HasuraTableBuilder`, `BuilderState`, `NoSelection` from `./builder.js`; `GraphQLExecutor` from `../runtime/request.js`; `HasuraTableName`, `TableColumn`, `TableRow` from `./inputs.js`; `GetSelectionType` from `../index.js` (type-only).
- Produces:
  - `HasuraClientConfig<S>` — `{ executor: GraphQLExecutor; primaryKeys?: { [T]?: column }; defaultSelections?: { [T]?: string } }`;
  - `HasuraClient<S, InsertTypes, C>` — `{ table<T>(name: T): HasuraTableBuilder<...> }`;
  - `createHasuraClient<S, InsertTypes = {}>(): <const C extends HasuraClientConfig<S>>(config: C) => HasuraClient<S, InsertTypes, C>`;
  - `src/hasura/index.ts` re-exports the whole hasura public surface.

- [ ] **Step 1: Write the failing test**

Create `tests/hasura/client.test.ts`:

```ts
import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type { NoSelection } from "../../src/hasura/builder.js";
import { createHasuraClient } from "../../src/hasura/client.js";
import { createMockExecutor, type TestSchema, type UserId } from "./fixtures.js";

test("table() uses the configured default selection and primary key", async () => {
    const mock = createMockExecutor({ User: [{ id: "u1", email: null }] });
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
        primaryKeys: { User: "id", Post: "id" },
        defaultSelections: { User: "id email" },
    });
    const row = await client.table("User").id("u1" as UserId).one();
    expect(row).toEqual({ id: "u1", email: null });
    expectTypeOf(row).toEqualTypeOf<
        { id: UserId; email: string | null } | null
    >();
    expect(mock.requests[0]!.document).toBe(
        "query ListUsers($where: User_bool_exp, $limit: Int) "
            + "{ User(where: $where, limit: $limit) { id email } }",
    );
});

test("table() names are constrained to schema tables", () => {
    const mock = createMockExecutor(null);
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
    });
    // @ts-expect-error Query is an operation root, not a table
    client.table("Query");
    // @ts-expect-error unknown table
    client.table("Nope");
});

test("without a default selection the result type is NoSelection", async () => {
    const mock = createMockExecutor(null);
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
    });
    const builder = client.table("Post");
    // type-only assertion; awaiting the builder would reject before asserting
    expectTypeOf(builder).resolves.toEqualTypeOf<NoSelection[]>();
    await expect(Promise.resolve(builder as PromiseLike<unknown>)).rejects
        .toThrow('No selection for table "Post"');
    const selected = await client.table("Post").select("id title");
    expectTypeOf(selected).toEqualTypeOf<{ id: string; title: string }[]>();
});

test("insert data defaults to Partial<Row> and honors InsertTypes", () => {
    const mock = createMockExecutor(null);
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
        defaultSelections: { User: "id", Post: "id" },
    });
    // Partial<Row> default: any subset compiles
    client.table("User").insert({ email: "a@b.c" });
    // @ts-expect-error unknown insert column
    client.table("User").insert({ nope: 1 });

    type Inserts = { User: { id: UserId; email?: string | null } };
    const strict = createHasuraClient<TestSchema, Inserts>()({
        executor: mock.executor,
        defaultSelections: { User: "id" },
    });
    strict.table("User").insert({ id: "u1" as UserId });
    // @ts-expect-error id is required by the InsertTypes override
    strict.table("User").insert({ email: "a@b.c" });
});

test("id() value type follows the configured primary key column", () => {
    const mock = createMockExecutor(null);
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
        primaryKeys: { User: "id" },
        defaultSelections: { User: "id" },
    });
    client.table("User").id("u1" as UserId);
    // @ts-expect-error plain string is not a UserId
    client.table("User").id("u1");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/hasura/client.test.ts`
Expected: FAIL — cannot resolve `../../src/hasura/client.js`.

- [ ] **Step 3: Write the implementation**

Create `src/hasura/client.ts`:

```ts
// createHasuraClient — binds a GraphQLSchema, an injected executor, and
// Hasura-specific metadata (primary keys, default selections, insert
// shapes) into per-table builders. The factory is curried so Schema (and
// optionally InsertTypes) stay explicit while config literals are inferred;
// `const C` preserves defaultSelections literals for lazy per-table
// GetSelectionType evaluation.

import type { GetSelectionType } from "../index.js";
import type { GraphQLExecutor } from "../runtime/request.js";
import type { GraphQLSchema } from "../schema.js";
import {
    HasuraTableBuilder,
    type NoSelection,
} from "./builder.js";
import type {
    HasuraTableName,
    TableColumn,
    TableRow,
} from "./inputs.js";

export interface HasuraClientConfig<S extends GraphQLSchema> {
    executor: GraphQLExecutor;
    /** Runtime primary-key column names; enables .id() per table. */
    primaryKeys?: { [T in HasuraTableName<S>]?: TableColumn<S, T> };
    /** Default selection per table, validated lazily against the schema
     *  when the table is used. */
    defaultSelections?: { [T in HasuraTableName<S>]?: string };
}

type InsertTypesShape<S extends GraphQLSchema> = {
    [T in HasuraTableName<S>]?: object;
};

type DefaultSelectionOf<C, T> = C extends
    { defaultSelections: infer DS extends Record<string, unknown> }
    ? T extends keyof DS ? DS[T] : undefined
    : undefined;

type SelectionResultOf<
    S extends GraphQLSchema,
    C,
    T extends HasuraTableName<S>,
> = DefaultSelectionOf<C, T> extends infer G extends string
    ? GetSelectionType<G, S, T>
    : NoSelection;

type InsertTypeOf<
    S extends GraphQLSchema,
    InsertTypes,
    T extends HasuraTableName<S>,
> = T extends keyof InsertTypes
    ? InsertTypes[T] extends object ? InsertTypes[T]
    : Partial<TableRow<S, T>>
    : Partial<TableRow<S, T>>;

type PrimaryKeyValueOf<
    S extends GraphQLSchema,
    C,
    T extends HasuraTableName<S>,
> = C extends { primaryKeys: infer PKs }
    ? T extends keyof PKs
        ? PKs[T] extends infer K extends string & keyof TableRow<S, T>
            ? TableRow<S, T>[K]
        : never
    : never
    : never;

export type HasuraClient<
    S extends GraphQLSchema,
    InsertTypes,
    C extends HasuraClientConfig<S>,
> = {
    table<T extends HasuraTableName<S>>(name: T): HasuraTableBuilder<
        S,
        T,
        SelectionResultOf<S, C, T>,
        InsertTypeOf<S, InsertTypes, T>,
        PrimaryKeyValueOf<S, C, T>
    >;
};

export function createHasuraClient<
    S extends GraphQLSchema,
    InsertTypes extends InsertTypesShape<S> = {},
>() {
    return function create<const C extends HasuraClientConfig<S>>(
        config: C,
    ): HasuraClient<S, InsertTypes, C> {
        const primaryKeys = (config.primaryKeys ?? {}) as Record<
            string,
            string | undefined
        >;
        const defaultSelections = (config.defaultSelections ?? {}) as Record<
            string,
            string | undefined
        >;
        const client = {
            table(name: HasuraTableName<S>) {
                return new HasuraTableBuilder({
                    table: name,
                    executor: config.executor,
                    mode: "list",
                    selection: defaultSelections[name] ?? null,
                    primaryKey: primaryKeys[name] ?? null,
                });
            },
        };
        // The runtime object is untyped w.r.t. the per-table generics (they
        // only exist at the type level), so widen through unknown once here.
        return client as unknown as HasuraClient<S, InsertTypes, C>;
    };
}
```

Create `src/hasura/index.ts`:

```ts
// @kuindji/typed-graphql/hasura — runtime Hasura builder over the
// transport-neutral executor boundary. See GOALS.md phase 3.

export type { BuilderState, NoSelection } from "./builder.js";
export { HasuraTableBuilder } from "./builder.js";
export type { HasuraClient, HasuraClientConfig } from "./client.js";
export { createHasuraClient } from "./client.js";
export type {
    AggregateSelectionInput,
    ConflictSpec,
} from "./documents.js";
export {
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    generateAggregateSelection,
} from "./documents.js";
export type {
    AggregateResult,
    HasuraTableName,
    HasuraTables,
    Materialize,
    NonEmptyArray,
    OrderBy,
    OrderDirection,
    StringColumn,
    TableAggregateInput,
    TableAggregateOutput,
    TableColumn,
    TableRow,
    WhereField,
    WhereInput,
} from "./inputs.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test tests/hasura/ && npx tsc --noEmit && npm run typecheck:snc`
Expected: all tests PASS, both typechecks clean.

Note: if `SelectionResultOf` fails to resolve the literal (result types come out as `NoSelection` despite a configured default selection), the likely cause is `const C` not propagating literals through the optional index — verify with `expectTypeOf<DefaultSelectionOf<C, "User">>().toEqualTypeOf<"id email">()` in a scratch assertion before changing the implementation.

- [ ] **Step 5: Commit**

```bash
git add src/hasura/client.ts src/hasura/index.ts tests/hasura/client.test.ts
git commit -m "Add createHasuraClient factory and hasura entry point"
```

---

### Task 7: Packaging — subpath exports, dist smoke, README

**Files:**
- Modify: `package.json` (exports map)
- Modify: `scripts/dist-smoke.mjs`
- Modify: `README.md` (add runtime section)

**Interfaces:**
- Consumes: built `dist/runtime/index.js` and `dist/hasura/index.js` (from Tasks 2 and 6 via `npm run build`).
- Produces: consumer-visible `@kuindji/typed-graphql/runtime` and `@kuindji/typed-graphql/hasura` entries.

- [ ] **Step 1: Extend the dist smoke test**

In `scripts/dist-smoke.mjs`, after the existing `dist/index.d.ts` check (line 45) and before the `failures.length` check, add:

```js
// 3. Subpath entries (runtime + hasura) resolve and expose their runtime
//    surface, and their .d.ts entries exist.
for (
    const [subpath, expected] of [
        ["runtime", ["extractResult", "buildOperationDocument", "buildFieldArguments"]],
        ["hasura", [
            "createHasuraClient",
            "HasuraTableBuilder",
            "generateAggregateSelection",
            "buildListRequest",
            "buildInsertRequest",
            "buildUpdateRequest",
            "buildDeleteRequest",
            "buildAggregateRequest",
        ]],
    ]
) {
    let sub;
    try {
        sub = await import(resolve(root, `dist/${subpath}/index.js`));
    }
    catch {
        fail(`could not import dist/${subpath}/index.js`);
        continue;
    }
    for (const name of expected) {
        if (typeof sub[name] !== "function") {
            fail(`dist/${subpath} missing function export: ${name}`);
        }
    }
    const subDts = resolve(root, `dist/${subpath}/index.d.ts`);
    if (!existsSync(subDts)) {
        fail(`dist/${subpath}/index.d.ts is missing`);
    }
}
```

Also update the final success message to `"dist smoke test passed: root + runtime + hasura entries OK"`.

- [ ] **Step 2: Run to verify current state**

Run: `npm run test:dist`
Expected: build succeeds; smoke test PASSES already (dist/runtime and dist/hasura are emitted by tsc since Tasks 2/6 — this step verifies the build layout matches the exports we are about to add; if it FAILS, fix the smoke-test paths before touching package.json).

- [ ] **Step 3: Add the subpath exports**

In `package.json`, replace the `"exports"` object with:

```json
"exports": {
    ".": {
        "types": "./dist/index.d.ts",
        "import": "./dist/index.js",
        "default": "./dist/index.js"
    },
    "./runtime": {
        "types": "./dist/runtime/index.d.ts",
        "import": "./dist/runtime/index.js",
        "default": "./dist/runtime/index.js"
    },
    "./hasura": {
        "types": "./dist/hasura/index.d.ts",
        "import": "./dist/hasura/index.js",
        "default": "./dist/hasura/index.js"
    }
},
```

- [ ] **Step 4: Document the runtime layer in README.md**

In `README.md`, after the "Public API" section's closing code block and before "## Development", add:

````markdown
## Runtime construction

The core stays type-only. Runtime query building ships as separate entries:

- `@kuindji/typed-graphql/runtime` — the transport-neutral boundary:
  `GraphQLRequest`, `GraphQLExecutor`, `extractResult`, and document
  assembly helpers. You inject an executor that owns transport,
  authentication, retry, and error reporting.
- `@kuindji/typed-graphql/hasura` — an immutable, chainable Hasura builder
  typed by the same schema:

```ts
import { createHasuraClient } from "@kuindji/typed-graphql/hasura";

const client = createHasuraClient<Schema>()({
    executor: { execute: async (request) => runRequestSomehow(request) },
    primaryKeys: { User: "id" },
    defaultSelections: { User: "id email" },
});

const users = await client.table("User").eq("email", "a@b.c").limit(10);
const one = await client.table("User").id(userId).one();
const count = await client.table("User").count();
```
````

- [ ] **Step 5: Run the full dist test**

Run: `npm run test:dist`
Expected: build + smoke test PASS with the new success message.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/dist-smoke.mjs README.md
git commit -m "Export runtime and hasura subpaths with dist smoke coverage"
```

---

### Task 8: Full verification and perf gate

**Files:**
- Possibly modify: `scripts/perf-baseline.json` (only via `npm run perf:update`)

**Interfaces:**
- Consumes: everything above.
- Produces: green `npm test`, `npm run test:dist`, `npm run perf`.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: `tsc --noEmit` clean, `typecheck:snc` clean, all bun tests PASS (existing compiler tests plus the new `tests/runtime/` and `tests/hasura/` suites).

- [ ] **Step 2: Run the dist smoke test**

Run: `npm run test:dist`
Expected: PASS.

- [ ] **Step 3: Run the perf gate**

Run: `npm run perf`
Expected: PASS within the recorded baseline headroom (10%). The new code adds type-level surface mainly through its *tests* (GetSelectionType/ValidateSelection instantiations against the small `TestSchema`).

If it FAILS on instantiation/type counters: confirm the regression comes from the new test files (temporarily `mv tests/hasura /tmp && npm run perf` to isolate, then move back), then run `npm run perf:update` and mention in the commit message that the delta is added type-test surface for phase 3, not compiler regression. If the regression comes from `src/` types instead, stop and investigate before updating the baseline.

- [ ] **Step 4: Commit (only if the baseline was updated)**

```bash
git add scripts/perf-baseline.json
git commit -m "Update perf baseline for phase 3 type-test surface"
```

- [ ] **Step 5: Final review**

Run: `git log --oneline main -8` and `git status`
Expected: one commit per task, clean tree. Confirm GOALS.md phase 3 bullets are all covered: reusable runtime builder helpers (`src/runtime/`), transport-independent typed request and executor boundary (`request.ts`), stable Hasura builder with list, mutation, aggregate, and subscription behavior (`src/hasura/`).
