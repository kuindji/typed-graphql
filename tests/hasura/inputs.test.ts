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
        _or: [ { active: { _eq: true } } ],
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
        { count: true; max: [ "age" ]; }
    >;
    expectTypeOf<Out>().toEqualTypeOf<{
        count: number;
        max: { age: number; };
    }>();
});
