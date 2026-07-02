import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type { NoSelection } from "../../src/hasura/builder.js";
import { createHasuraClient } from "../../src/hasura/client.js";
import {
    createMockExecutor,
    type TestSchema,
    type UserId,
} from "./fixtures.js";

test("table() uses the configured default selection and primary key", async () => {
    const mock = createMockExecutor({ User: [ { id: "u1", email: null } ] });
    const client = createHasuraClient<TestSchema>()({
        executor: mock.executor,
        primaryKeys: { User: "id", Post: "id" },
        defaultSelections: { User: "id email" },
    });
    const row = await client.table("User").id("u1" as UserId).one();
    expect(row).toEqual({ id: "u1" as UserId, email: null });
    expectTypeOf(row).toEqualTypeOf<
        { id: UserId; email: string | null; } | null
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
    expectTypeOf(selected).toEqualTypeOf<{ id: string; title: string; }[]>();
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

    type Inserts = { User: { id: UserId; email?: string | null; }; };
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
