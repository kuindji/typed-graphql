import { test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type {
    HasuraTableName,
    OrderBy,
    TableAggregateInput,
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
        _or: [ { active: { _eq: true } } ],
        _not: { active: { _eq: false } },
        posts: { title: { _like: "a%" } },
    };
    void ok;
    // @ts-expect-error _not takes a single expression, not an array
    const badNot: W = { _not: [ { active: { _eq: false } } ] };
    void badNot;
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

test("OrderBy covers columns and object-relation columns", () => {
    type O = OrderBy<TestSchema, "Post">;
    const ok: O = { title: "desc", user: { age: "asc_nulls_last" } };
    void ok;
    // @ts-expect-error direction strings are constrained
    const bad: O = { title: "downwards" };
    void bad;
});

test("OrderBy orders array relations by aggregates only", () => {
    type O = OrderBy<TestSchema, "User">;
    const ok: O = {
        age: "desc",
        posts_aggregate: { count: "desc", avg: { rating: "asc" } },
    };
    void ok;
    // @ts-expect-error array relations cannot order by columns
    const badColumns: O = { posts: { title: "asc_nulls_last" } };
    void badColumns;
    // @ts-expect-error avg aggregate ordering is numeric-only
    const badAvg: O = { posts_aggregate: { avg: { title: "asc" } } };
    void badAvg;
});

test("aggregate avg/sum inputs are numeric-only", () => {
    type A = TableAggregateInput<TestSchema, "User">;
    const ok: A = { avg: [ "age" ], sum: [ "age" ], max: [ "email" ] };
    void ok;
    // @ts-expect-error avg requires numeric columns
    const badAvg: A = { avg: [ "email" ] };
    void badAvg;
    // @ts-expect-error sum requires numeric columns
    const badSum: A = { sum: [ "active" ] };
    void badSum;
});

test("TableAggregateOutput derives from the aggregate input", () => {
    type Out = TableAggregateOutput<
        TestSchema,
        "User",
        { count: true; max: [ "age" ]; }
    >;
    // max/min/avg/sum resolve to null when no row matches the filter.
    expectTypeOf<Out>().toEqualTypeOf<{
        count: number;
        max: { age: number | null; };
    }>();
});
