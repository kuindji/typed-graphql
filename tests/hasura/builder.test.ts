import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import { HasuraTableBuilder } from "../../src/hasura/builder.js";
import type { GraphQLExecutor } from "../../src/runtime/request.js";
import {
    createMockExecutor,
    type TestSchema,
    type UserId,
} from "./fixtures.js";

function userBuilder(executor: GraphQLExecutor) {
    return new HasuraTableBuilder<
        TestSchema,
        "User",
        { id: UserId; email: string | null; },
        Partial<
            { id: UserId; email: string | null; age: number; active: boolean; }
        >,
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

test("chaining filters on the same column merges operators instead of dropping them", async () => {
    const mock = createMockExecutor({ User: [] });
    await userBuilder(mock.executor)
        .gt("age", 18)
        .lt("age", 65, true);
    expect(mock.requests[0]!.variables).toEqual({
        where: {
            age: { _gt: 18, _lte: 65 },
        },
    });
});

test("where() conjoins repeated logical and column filters instead of overwriting", async () => {
    const andMerge = createMockExecutor({ User: [] });
    await userBuilder(andMerge.executor)
        .where({ _and: [ { active: { _eq: true } } ] })
        .where({ _and: [ { age: { _gt: 18 } } ] });
    expect(andMerge.requests[0]!.variables.where).toEqual({
        _and: [ { active: { _eq: true } }, { age: { _gt: 18 } } ],
    });

    const opMerge = createMockExecutor({ User: [] });
    await userBuilder(opMerge.executor)
        .gt("age", 18)
        .where({ age: { _lt: 65 } });
    expect(opMerge.requests[0]!.variables.where).toEqual({
        age: { _gt: 18, _lt: 65 },
    });

    const orMerge = createMockExecutor({ User: [] });
    await userBuilder(orMerge.executor)
        .where({ _or: [ { active: { _eq: true } } ] })
        .where({ _or: [ { age: { _gt: 65 } } ] });
    expect(orMerge.requests[0]!.variables.where).toEqual({
        _or: [ { active: { _eq: true } } ],
        _and: [ { _or: [ { age: { _gt: 65 } } ] } ],
    });

    const opConflict = createMockExecutor({ User: [] });
    await userBuilder(opConflict.executor)
        .where({ age: { _gt: 18 } })
        .where({ age: { _gt: 21 } });
    expect(opConflict.requests[0]!.variables.where).toEqual({
        age: { _gt: 18 },
        _and: [ { age: { _gt: 21 } } ],
    });

    const notMerge = createMockExecutor({ User: [] });
    await userBuilder(notMerge.executor)
        .where({ _not: { active: { _eq: true } } })
        .where({ _not: { age: { _gt: 65 } } });
    expect(notMerge.requests[0]!.variables.where).toEqual({
        _not: { active: { _eq: true } },
        _and: [ { _not: { age: { _gt: 65 } } } ],
    });
});

test("mutating condition objects after passing them in does not affect the builder", async () => {
    const mock = createMockExecutor({ User: [] });
    const condition = { age: { _gt: 18 } };
    const filtered = userBuilder(mock.executor).where(condition);
    condition.age._gt = 99;
    await filtered;
    expect(mock.requests[0]!.variables.where).toEqual({ age: { _gt: 18 } });

    const inMock = createMockExecutor({ User: [] });
    const ids = [ "u1" as UserId ];
    const inFiltered = userBuilder(inMock.executor).in("id", ids);
    ids.push("u2" as UserId);
    await inFiltered;
    expect(inMock.requests[0]!.variables.where).toEqual({
        id: { _in: [ "u1" ] },
    });
});

test("one() forces limit 1 and resolves the first row or null", async () => {
    const row = { id: "u1" as UserId, email: null };
    const mock = createMockExecutor({ User: [ row ] });
    const single = await userBuilder(mock.executor).eq("active", true).one();
    expect(single).toEqual(row);
    expect(mock.requests[0]!.variables.limit).toBe(1);

    const empty = createMockExecutor({ User: [] });
    const missing = await userBuilder(empty.executor).one();
    expect(missing).toBeNull();
});

test("one() returns a bare object payload instead of dropping it", async () => {
    const row = { id: "u1" as UserId, email: null };
    const mock = createMockExecutor({ User: row });
    const single = await userBuilder(mock.executor).one();
    expect(single).toEqual(row);
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
        insert_User: { returning: [ { id: "u1", email: null } ] },
    });
    const rows = await userBuilder(mock.executor)
        .insert({ id: "u1" as UserId })
        .onConflict(false);
    expect(rows).toEqual([ { id: "u1" as UserId, email: null } ]);
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
    expectTypeOf(updated).toEqualTypeOf<{ affected_rows: number; }>();

    // Promise.resolve() adopts the thenable so bun's .rejects sees a Promise
    await expect(
        Promise.resolve(userBuilder(mock.executor).update({ email: null })),
    )
        .rejects.toThrow("update() requires a where filter");
    await expect(Promise.resolve(userBuilder(mock.executor).remove()))
        .rejects.toThrow("remove() requires a where filter");
});

test("an empty where filter does not bypass the update/remove guard", async () => {
    const mock = createMockExecutor({ delete_User: { affected_rows: 1 } });
    await expect(
        Promise.resolve(
            userBuilder(mock.executor).where({}).update({ email: null }),
        ),
    )
        .rejects.toThrow("update() requires a where filter");
    await expect(Promise.resolve(userBuilder(mock.executor).where({}).remove()))
        .rejects.toThrow("remove() requires a where filter");
    expect(mock.requests).toEqual([]);
});

test("null mutation and aggregate payloads reject instead of resolving null", async () => {
    const mock = createMockExecutor(null);
    await expect(
        Promise.resolve(
            userBuilder(mock.executor).eq("active", false).update({
                email: null,
            }),
        ),
    ).rejects.toThrow('update on table "User" returned no payload');
    await expect(
        Promise.resolve(userBuilder(mock.executor).eq("active", false).remove()),
    ).rejects.toThrow('remove on table "User" returned no payload');
    await expect(Promise.resolve(userBuilder(mock.executor).count()))
        .rejects.toThrow('aggregate on table "User" returned no payload');
});

test("count() resolves the aggregate count object", async () => {
    const mock = createMockExecutor({
        User_aggregate: { aggregate: { count: 7 } },
    });
    const result = await userBuilder(mock.executor).count();
    expect(result).toEqual({ aggregate: { count: 7 } });
    expectTypeOf(result).toEqualTypeOf<{ aggregate: { count: number; }; }>();
});

test("aggregate mode threads limit and offset instead of dropping them", async () => {
    const mock = createMockExecutor({
        User_aggregate: { aggregate: { count: 2 } },
    });
    await userBuilder(mock.executor).limit(5).offset(10).count();
    expect(mock.requests[0]!.variables).toEqual({ limit: 5, offset: 10 });
    expect(mock.requests[0]!.document).toContain("offset: $offset");
    expect(mock.requests[0]!.document).toContain("limit: $limit");
});

test("aggregate({}) rejects with a stable error instead of sending a malformed document", async () => {
    const mock = createMockExecutor({
        User_aggregate: { aggregate: { count: 7 } },
    });
    await expect(Promise.resolve(userBuilder(mock.executor).aggregate({})))
        .rejects.toThrow(
            "aggregate requires at least one aggregate function or nodes selection",
        );
});

test("select() re-types the result from the literal selection", async () => {
    const mock = createMockExecutor({ User: [ { id: "u1" } ] });
    const rows = await userBuilder(mock.executor).select("id");
    expectTypeOf(rows).toEqualTypeOf<{ id: UserId; }[]>();
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
    mock.emit({ User: [ { id: "u1", email: null } ] });
    expect(seen).toEqual([ [ { id: "u1", email: null } ] ]);
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

test("subscribe() forwards executor errors to the optional error callback", () => {
    const mock = createMockExecutor();
    const errors: unknown[] = [];
    userBuilder(mock.executor)
        .eq("active", true)
        .subscribe(() => {}, (err) => errors.push(err));
    const boom = new Error("boom");
    mock.emitError(boom);
    expect(errors).toEqual([ boom ]);
});

test("subscribe() without executor.subscribe throws", () => {
    const bare: GraphQLExecutor = { execute: async () => null };
    expect(() => userBuilder(bare).subscribe(() => {})).toThrow(
        "executor.subscribe is not configured",
    );
});

test("isAggregate() reflects the builder mode across the chain", () => {
    const mock = createMockExecutor(null);
    const b = userBuilder(mock.executor);
    expect(b.select("id").all().isAggregate()).toBe(false); // list
    expect(b.select("id").one().isAggregate()).toBe(false); // single
    expect(b.aggregate({ aggregate: { count: true } }).isAggregate()).toBe(
        true,
    );
    expect(b.count().isAggregate()).toBe(true);
    expect(b.count().where({ active: { _eq: false } }).isAggregate()).toBe(
        true,
    ); // rides the chain
});

test("builders are immutable — chaining never mutates the source", async () => {
    const mock = createMockExecutor({ User: [] });
    const base = userBuilder(mock.executor);
    const filtered = base.eq("active", true);
    expect(filtered).not.toBe(base);
    await base;
    expect(mock.requests[0]!.variables).toEqual({});
});
